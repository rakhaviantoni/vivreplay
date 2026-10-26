import {z} from 'zod';
import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {computeOfferExpiration,parseOfferItems} from '@/lib/server/market-offers';
import {sendMarketEmail} from '@/lib/server/market-notifications';
import {MARKET_MAX_CARD_TYPES,MARKET_MAX_COPIES_PER_CARD} from '@/lib/market/listing-limits';
import {enforceMarketListingLimits} from '@/lib/server/market-listing-limits';
import {enabledShippingCouriers} from '@/lib/shipping/couriers';
import {isBiteshipAreaId} from '@/lib/shipping/biteship-area';

const parcelSchema=z.object({weight:z.number().int().min(10).max(30000),length:z.number().int().min(1).max(100),width:z.number().int().min(1).max(100),height:z.number().int().min(1).max(100)});
const offerItemSchema=z.object({printingId:z.string().min(1),quantity:z.number().int().positive().max(MARKET_MAX_COPIES_PER_CARD),unitAmount:z.number().int().positive().optional(),sealedProductId:z.string().optional(),productType:z.enum(['RAW','GRADED','SEALED']).optional(),condition:z.string().max(40).optional(),notes:z.string().max(1000).optional(),photoIds:z.array(z.string().uuid()).max(6).optional(),parcel:parcelSchema.optional()});
const schema=z.object({type:z.enum(['BUY','SELL']),items:z.array(offerItemSchema).min(1).max(MARKET_MAX_CARD_TYPES),amount:z.number().int().positive(),currency:z.string().length(3)});

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{
  const actor=await user();const {id}=await params;
  const row=await db().prepare(`SELECT o.id,o.actor_id AS actorId,o.type,o.items,o.amount,o.currency,o.expires_at AS expiresAt
    FROM listing_offers o JOIN listings l ON l.id=o.listing_id
    WHERE o.listing_id=? AND o.status='PENDING'
      AND (o.expires_at IS NULL OR o.expires_at>CURRENT_TIMESTAMP)
      AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)
      AND EXISTS(SELECT 1 FROM listing_offers participant WHERE participant.listing_id=o.listing_id
        AND COALESCE(participant.thread_id,participant.id)=COALESCE(o.thread_id,o.id)
        AND participant.actor_id=? AND participant.actor_id!=l.seller_id)
    ORDER BY o.created_at DESC,o.rowid DESC LIMIT 1`).bind(id,actor.id).first<{id:string;actorId:string;type:string;items:string;amount:number;currency:string;expiresAt:string|null}>();
  const items=row?parseOfferItems(row.items):[];
  return Response.json({offer:row?{id:row.id,actorId:row.actorId,viewerIsActor:row.actorId===actor.id,type:row.type,items,amount:row.amount,currency:row.currency,expiresAt:row.expiresAt}:null},{headers:{'Cache-Control':'private, no-store'}});
}catch(error){return errorResponse(error)}}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
  guard(request);const actor=await user();const {id}=await params;const value=schema.parse(await request.json());
  const listing=await db().prepare('SELECT seller_id,printing_id,sealed_product_id AS sealedProductId,quantity,currency,type,status,items,title,expires_at,negotiable FROM listings WHERE id=?').bind(id).first<{seller_id:string;printing_id:string|null;sealedProductId:string|null;quantity:number;currency:string;type:string;status:string;items:string|null;title:string;expires_at:string|null;negotiable:number}>();
  if(!listing||listing.status!=='ACTIVE')throw new HttpError(404,'This listing is no longer active.');
  if(listing.expires_at&&new Date(`${listing.expires_at.replace(' ','T')}Z`).getTime()<=Date.now())throw new HttpError(404,'This listing has expired.');
  if(listing.seller_id===actor.id)throw new HttpError(403,'You cannot make an offer on your own listing.');
  if(listing.type==='WTS'&&!listing.negotiable)throw new HttpError(409,'The seller set a firm price. This listing does not accept offers.');
  if(value.currency!==listing.currency)throw new HttpError(400,'Offer currency must match the listing.');
  if(value.items.some(item=>!Number.isSafeInteger(item.unitAmount??0)||!item.unitAmount)||value.items.reduce((sum,item)=>sum+item.quantity*(item.unitAmount??0),0)!==value.amount)throw new HttpError(400,'Offer total must match the per-card prices.');
  if(listing.type==='WTS'&&value.type!=='BUY')throw new HttpError(400,'Use a purchase offer for a selling listing.');
  if(listing.type==='WTB'&&value.type!=='SELL')throw new HttpError(400,'Use a sell offer for a wanted listing.');
  if(listing.type==='WTB'){
    const accepted=await db().prepare("SELECT id,expires_at AS expiresAt FROM listing_offers WHERE listing_id=? AND status='ACCEPTED' ORDER BY created_at DESC,rowid DESC LIMIT 1").bind(id).first<{id:string;expiresAt:string|null}>();
    if(accepted){
      const activeOrder=await db().prepare("SELECT 1 AS ok FROM checkout_orders WHERE offer_id=? AND kind='MARKET' AND (status IN ('PROCESSING','PAID','SHIPPED','RECEIVED','COMPLETED','FULFILLED') OR (status='PENDING_PAYMENT' AND expires_at>CURRENT_TIMESTAMP)) LIMIT 1").bind(accepted.id).first();
      const end=accepted.expiresAt?new Date(`${accepted.expiresAt.replace(' ','T')}Z`).getTime():0;
      if(activeOrder||end>Date.now())throw new HttpError(409,'A seller offer is already accepted. Finish checkout before reopening this request.');
      await db().prepare("UPDATE listing_offers SET status='EXPIRED' WHERE id=? AND status='ACCEPTED'").bind(accepted.id).run();
    }
  }
  const count=value.items.reduce((total,item)=>total+item.quantity,0);
  const sealedWanted=listing.type==='WTB'&&Boolean(listing.sealedProductId);
  if(sealedWanted){
    if(value.items.length!==1)throw new HttpError(400,'Offer one sealed product at a time.');
    const item=value.items[0];
    if(item.printingId!==listing.sealedProductId||item.sealedProductId!==listing.sealedProductId||item.productType!=='SEALED')throw new HttpError(400,'Choose the sealed product named in this request.');
    if(!['SEALED','SEALED_DAMAGED'].includes(item.condition??'')||!item.parcel||!item.photoIds?.length)throw new HttpError(400,'Add the package condition, a photo, and packed dimensions.');
    const origin=await db().prepare('SELECT address_line AS addressLine,city,postal_code AS postalCode,area_id AS areaId,phone,label FROM seller_shipping_origins WHERE owner_id=?').bind(actor.id).first<{addressLine:string;city:string;postalCode:string;areaId:string|null;phone:string|null;label:string|null}>();
    let shippingMethods:string[]=[];try{const parsed=JSON.parse(origin?.label??'{}');if(Array.isArray(parsed.methods))shippingMethods=parsed.methods.filter((method:unknown):method is string=>typeof method==='string')}catch{}
    if(!origin?.addressLine||!origin.city||!origin.phone||(!/^\d{5}$/.test(origin.postalCode)&&!isBiteshipAreaId(origin.areaId))||!enabledShippingCouriers(shippingMethods).length)throw new HttpError(400,'Add a delivery address and choose a courier in your shipping settings before offering this product.');
    const photoIds=[...new Set(item.photoIds)];
    const photos=await db().prepare(`SELECT id FROM market_product_photos WHERE owner_id=? AND id IN (${photoIds.map(()=>'?').join(',')})`).bind(actor.id,...photoIds).all<{id:string}>();
    if(photos.results.length!==photoIds.length)throw new HttpError(400,'Choose photos uploaded from your account.');
  }else await enforceMarketListingLimits(db(),value.items);
  if(count>listing.quantity)throw new HttpError(400,'Select no more cards than this listing requests.');
  if(listing.type==='WTS'){
    let available:Map<string,number>;
    try{
      const bundle=listing.items?JSON.parse(listing.items) as {printingId?:unknown;quantity?:unknown}[]:[];
      available=new Map([[listing.printing_id??'',listing.quantity]]);
      if(bundle.length){
        available.clear();
        for(const item of bundle){
          if(typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&Number(item.quantity)>0){
            available.set(item.printingId,(available.get(item.printingId)??0)+Number(item.quantity));
          }
        }
      }
    }catch{available=new Map([[listing.printing_id??'',listing.quantity]])}
    const requested=new Map<string,number>();
    for(const item of value.items)requested.set(item.printingId,(requested.get(item.printingId)??0)+item.quantity);
    if(Array.from(requested).some(([printingId,quantity])=>quantity>(available.get(printingId)??0)))throw new HttpError(400,'Select only the available cards in this bundle.');
  }
  if(listing.type==='WTB'&&!sealedWanted)for(const item of value.items){const owned=await db().prepare('SELECT COALESCE(SUM(quantity),0) AS quantity FROM collectible_instances WHERE owner_id=? AND printing_id=? AND deleted_at IS NULL').bind(actor.id,item.printingId).first<{quantity:number}>();if((owned?.quantity??0)<item.quantity)throw new HttpError(400,'Add the offered cards to your Vault before submitting.');}
  const offerId=crypto.randomUUID();const expiresAt=computeOfferExpiration(listing.expires_at);
  const inserted=await db().prepare(`INSERT INTO listing_offers (id,listing_id,actor_id,type,items,amount,currency,expires_at)
    SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(
      SELECT 1 FROM listing_offers pending WHERE pending.listing_id=? AND pending.status='PENDING'
        AND (pending.expires_at IS NULL OR pending.expires_at>CURRENT_TIMESTAMP)
        AND (pending.actor_id=? OR COALESCE(pending.thread_id,pending.id) IN (
          SELECT COALESCE(existing.thread_id,existing.id) FROM listing_offers existing
          WHERE existing.listing_id=? AND existing.actor_id=? AND existing.actor_id!=?
        ))
    )`).bind(offerId,id,actor.id,value.type,JSON.stringify(value.items),value.amount,value.currency,expiresAt,id,actor.id,id,actor.id,listing.seller_id).run();
  if(!inserted.meta.changes){
    const current=await db().prepare(`SELECT pending.id,pending.actor_id AS actorId FROM listing_offers pending
      WHERE pending.listing_id=? AND pending.status='PENDING' AND (pending.expires_at IS NULL OR pending.expires_at>CURRENT_TIMESTAMP)
        AND (pending.actor_id=? OR COALESCE(pending.thread_id,pending.id) IN (
          SELECT COALESCE(existing.thread_id,existing.id) FROM listing_offers existing
          WHERE existing.listing_id=? AND existing.actor_id=? AND existing.actor_id!=?
        )) ORDER BY pending.created_at DESC,pending.rowid DESC LIMIT 1`).bind(id,actor.id,id,actor.id,listing.seller_id).first<{id:string;actorId:string}>();
    return Response.json({error:'You already have an open offer for this listing. Continue in its conversation.',offerId:current?.id,actorId:current?.actorId},{status:409,headers:{'Cache-Control':'private, no-store'}});
  }
  await sendMarketEmail(listing.seller_id,'new-offer',listing.title,offerId);
  return Response.json({id:offerId,actorId:actor.id,status:'PENDING',expiresAt},{status:201});
}catch(error){return errorResponse(error)}}
