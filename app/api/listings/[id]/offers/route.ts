import {z} from 'zod';
import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {computeOfferExpiration} from '@/lib/server/market-offers';
import {sendMarketEmail} from '@/lib/server/market-notifications';

const schema=z.object({type:z.enum(['BUY','SELL']),items:z.array(z.object({printingId:z.string().min(1),quantity:z.number().int().positive().max(99),unitAmount:z.number().int().positive().optional()})).min(1).max(30),amount:z.number().int().positive(),currency:z.string().length(3)});

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{
  const actor=await user();const {id}=await params;
  const row=await db().prepare(`SELECT o.id,o.type,o.items,o.amount,o.currency,o.expires_at AS expiresAt
    FROM listing_offers o JOIN listings l ON l.id=o.listing_id
    WHERE o.listing_id=? AND o.actor_id=? AND o.actor_id!=l.seller_id AND o.status='PENDING'
      AND (o.expires_at IS NULL OR o.expires_at>CURRENT_TIMESTAMP)
      AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)
    ORDER BY o.created_at DESC,o.rowid DESC LIMIT 1`).bind(id,actor.id).first<{id:string;type:string;items:string;amount:number;currency:string;expiresAt:string|null}>();
  let items:Array<{printingId:string;quantity:number;unitAmount?:number}>=[];
  if(row){try{const parsed=JSON.parse(row.items) as unknown;if(Array.isArray(parsed))items=parsed.filter((item):item is {printingId:string;quantity:number;unitAmount?:number}=>Boolean(item&&typeof item==='object'&&typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&item.quantity>0));}catch{}}
  return Response.json({offer:row?{id:row.id,type:row.type,items,amount:row.amount,currency:row.currency,expiresAt:row.expiresAt}:null},{headers:{'Cache-Control':'private, no-store'}});
}catch(error){return errorResponse(error)}}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
  guard(request);const actor=await user();const {id}=await params;const value=schema.parse(await request.json());
  const listing=await db().prepare('SELECT seller_id,printing_id,quantity,currency,type,status,items,title,expires_at,negotiable FROM listings WHERE id=?').bind(id).first<{seller_id:string;printing_id:string;quantity:number;currency:string;type:string;status:string;items:string|null;title:string;expires_at:string|null;negotiable:number}>();
  if(!listing||listing.status!=='ACTIVE')throw new HttpError(404,'This listing is no longer active.');
  if(listing.expires_at&&new Date(`${listing.expires_at.replace(' ','T')}Z`).getTime()<=Date.now())throw new HttpError(404,'This listing has expired.');
  if(listing.seller_id===actor.id)throw new HttpError(403,'You cannot make an offer on your own listing.');
  if(listing.type==='WTS'&&!listing.negotiable)throw new HttpError(409,'The seller set a firm price. This listing does not accept offers.');
  if(value.currency!==listing.currency)throw new HttpError(400,'Offer currency must match the listing.');
  if(value.items.some(item=>!Number.isSafeInteger(item.unitAmount??0)||!item.unitAmount)||value.items.reduce((sum,item)=>sum+item.quantity*(item.unitAmount??0),0)!==value.amount)throw new HttpError(400,'Offer total must match the per-card prices.');
  if(listing.type==='WTS'&&value.type!=='BUY')throw new HttpError(400,'Use a purchase offer for a selling listing.');
  if(listing.type==='WTB'&&value.type!=='SELL')throw new HttpError(400,'Use a sell offer for a wanted listing.');
  const count=value.items.reduce((total,item)=>total+item.quantity,0);
  if(listing.type==='WTS'){
    let available:Map<string,number>;
    try{
      const bundle=listing.items?JSON.parse(listing.items) as {printingId?:unknown;quantity?:unknown}[]:[];
      available=new Map([[listing.printing_id,listing.quantity]]);
      if(bundle.length){
        available.clear();
        for(const item of bundle){
          if(typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&Number(item.quantity)>0){
            available.set(item.printingId,(available.get(item.printingId)??0)+Number(item.quantity));
          }
        }
      }
    }catch{available=new Map([[listing.printing_id,listing.quantity]])}
    const requested=new Map<string,number>();
    for(const item of value.items)requested.set(item.printingId,(requested.get(item.printingId)??0)+item.quantity);
    if(count>listing.quantity||Array.from(requested).some(([printingId,quantity])=>quantity>(available.get(printingId)??0)))throw new HttpError(400,'Select only the available cards in this bundle.');
  }
  if(listing.type==='WTB')for(const item of value.items){const owned=await db().prepare('SELECT COALESCE(SUM(quantity),0) AS quantity FROM collectible_instances WHERE owner_id=? AND printing_id=? AND deleted_at IS NULL').bind(actor.id,item.printingId).first<{quantity:number}>();if((owned?.quantity??0)<item.quantity)throw new HttpError(400,'Add the offered cards to your Vault before submitting.');}
  const offerId=crypto.randomUUID();const expiresAt=computeOfferExpiration(listing.expires_at);await db().prepare('INSERT INTO listing_offers (id,listing_id,actor_id,type,items,amount,currency,expires_at) VALUES (?,?,?,?,?,?,?,?)').bind(offerId,id,actor.id,value.type,JSON.stringify(value.items),value.amount,value.currency,expiresAt).run();
  await sendMarketEmail(listing.seller_id,'new-offer',listing.title,offerId);
  return Response.json({id:offerId,status:'PENDING',expiresAt},{status:201});
}catch(error){return errorResponse(error)}}
