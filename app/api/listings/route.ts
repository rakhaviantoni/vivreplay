import {after} from 'next/server';
import {notifyListingWatchers} from '@/lib/server/market-watch-alerts';
import {z} from 'zod';
import {user,db,errorResponse,guard,market,HttpError} from '@/lib/server/store';
import {getDynamicListingPolicy,computeListingExpiration} from '@/lib/market/policy';
import {MARKET_MAX_COPIES_PER_CARD,MARKET_ABSOLUTE_MAX_LISTING_COPIES,listingLimitMessage} from '@/lib/market/listing-limits';
import {enforceMarketListingLimits} from '@/lib/server/market-listing-limits';

const itemSchema=z.object({instanceId:z.string().uuid().optional(),printingId:z.string(),quantity:z.number().int().positive().max(MARKET_MAX_COPIES_PER_CARD),condition:z.string().optional(),unitAmount:z.number().int().nonnegative().optional()});
const schema=z.object({instanceId:z.string().uuid().optional(),amount:z.number().int().positive().max(100000000000),quantity:z.number().int().positive().max(MARKET_ABSOLUTE_MAX_LISTING_COPIES),city:z.string().trim().min(2).max(60),title:z.string().trim().min(3).max(100),type:z.enum(['WTS','WTB']).default('WTS'),negotiable:z.boolean().default(true),items:z.array(itemSchema).min(1).max(MARKET_ABSOLUTE_MAX_LISTING_COPIES).optional()});

async function ensureMarketPrintings(database:ReturnType<typeof db>,printingIds:string[]){
  const placeholders=printingIds.map(()=>'?').join(',');
  const existing=await database.prepare(`SELECT id FROM card_printings WHERE id IN (${placeholders})`).bind(...printingIds).all<{id:string}>();
  const present=new Set((existing.results??[]).map(row=>row.id));
  const missing=printingIds.filter(id=>!present.has(id));
  if(!missing.length)return;

  const missingPlaceholders=missing.map(()=>'?').join(',');
  const catalog=await database.prepare(`SELECT id FROM tcg_card_printings WHERE id IN (${missingPlaceholders})`).bind(...missing).all<{id:string}>();
  if((catalog.results??[]).length!==missing.length)throw new HttpError(400,'One or more selected printings are no longer available. Refresh the catalog and add them again.');

  await database.batch([
    database.prepare(`INSERT OR IGNORE INTO card_identities (id,game_id,code,name,color,type,cost,power,effect,implementation)
      SELECT identity.id,game.id,identity.code,identity.name,identity.color,identity.card_type,identity.cost,identity.power,identity.effect_text,'DATA_ONLY'
      FROM tcg_card_printings printing
      JOIN tcg_card_identities identity ON identity.id=printing.identity_id
      JOIN tcg_games catalog_game ON catalog_game.id=identity.game_id
      JOIN games game ON lower(game.slug)=lower(catalog_game.slug)
      WHERE printing.id IN (${missingPlaceholders})`).bind(...missing),
    database.prepare(`INSERT OR IGNORE INTO card_printings (id,identity_id,language,set_code,rarity,variant,image_url,printing_code)
      SELECT printing.id,identity.id,printing.language,printing.set_code,printing.rarity,printing.variant,printing.card_image_url,printing.printing_code
      FROM tcg_card_printings printing
      JOIN tcg_card_identities catalog_identity ON catalog_identity.id=printing.identity_id
      JOIN tcg_games catalog_game ON catalog_game.id=catalog_identity.game_id
      JOIN games game ON lower(game.slug)=lower(catalog_game.slug)
      JOIN card_identities identity ON identity.game_id=game.id AND upper(identity.code)=upper(catalog_identity.code)
      WHERE printing.id IN (${missingPlaceholders})`).bind(...missing),
  ]);

  const verified=await database.prepare(`SELECT id FROM card_printings WHERE id IN (${placeholders})`).bind(...printingIds).all<{id:string}>();
  if((verified.results??[]).length!==printingIds.length)throw new HttpError(400,'One or more selected printings are not available in Market yet. Refresh the catalog and try again.');
}
export async function GET(request:Request){
  try{
    const idsParam=new URL(request.url).searchParams.get('ids');
    let ids:string[]|undefined;
    if(idsParam!==null){ids=[...new Set(idsParam.split(',').filter(Boolean))];if(!ids.length||ids.length>10||ids.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))throw new HttpError(400,'Choose up to 10 valid listings.')}
    let viewerId:string|undefined;try{viewerId=(await user()).id}catch{}
    const requestedGame=new URL(request.url).searchParams.get('game');
    const game=requestedGame==='pokemon'?'pokemon':requestedGame==='one-piece'?'one-piece':undefined;
    return Response.json({listings:await market(viewerId,ids,game)},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}})
  }
  catch(error){if(error instanceof HttpError)return errorResponse(error);console.error('listings_load_failed',error);return Response.json({error:'Live listings are temporarily unavailable. Please retry.'},{status:503})}
}

export async function POST(request:Request){
  try{
    guard(request);
    const profile=await user();
    if(profile.region!=='ID')throw new HttpError(403,'Seller listings currently require an Indonesian profile. Global collection and deck access remain available.');
    const database=db();
    const policy=await getDynamicListingPolicy(profile.tier,database,profile.pro_billing_period);
    const activeCount=await database.prepare("SELECT COUNT(*) AS total FROM listings WHERE seller_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)").bind(profile.id).first<{total:number}>();
    if((activeCount?.total??0)>=policy.maxActiveListings)throw new HttpError(400,`You have reached the limit of ${policy.maxActiveListings} active listings for your account.`);

    const value=schema.parse(await request.json());
    const bundle=value.items?.length?value.items:null;
    if(value.type==='WTB'){
      if(!bundle)throw new HttpError(400,'Add at least one card to your buying request.');
      if(value.instanceId||bundle.some(item=>item.instanceId))throw new HttpError(400,'A buying request cannot reserve a Vault item.');
      const delivery=await database.prepare('SELECT city FROM seller_shipping_origins WHERE owner_id=?').bind(profile.id).first<{city:string}>();
      const buyerCity=delivery?.city?.trim();
      if(!buyerCity)throw new HttpError(400,'Add a delivery address before posting a buying request.');
      const bundleQuantity=bundle.reduce((sum,item)=>sum+item.quantity,0);
      const bundleAmount=bundle.reduce((sum,item)=>sum+(item.unitAmount??0)*item.quantity,0);
      if(bundleQuantity!==value.quantity)throw new HttpError(400,'The wanted quantity must match the combined card quantities.');
      if(bundle.some(item=>!item.unitAmount||item.unitAmount<1)||bundleAmount!==value.amount)throw new HttpError(400,'Set a price for each card and make sure the total matches.');
      const printingIds=[...new Set(bundle.map(item=>item.printingId))];
      await ensureMarketPrintings(database,printingIds);
      await enforceMarketListingLimits(database,bundle,policy);
      const placeholders=printingIds.map(()=>'?').join(',');
      const known=await database.prepare(`SELECT id FROM card_printings WHERE id IN (${placeholders})`).bind(...printingIds).all<{id:string}>();
      if((known.results??[]).length!==printingIds.length)throw new HttpError(400,'One or more selected printings are not available in Market yet. Refresh the catalog and try again.');
      const id=crypto.randomUUID();
      const expiresAt=computeListingExpiration(policy.durationDays);
      const first=bundle[0];
      await database.prepare(`INSERT INTO listings (id,seller_id,printing_id,instance_id,title,amount,currency,quantity,condition,type,city,expires_at,items,negotiable)
        VALUES (?,?,?,NULL,?,?,'IDR',?,?,?,?,?,?,?)`).bind(id,profile.id,first.printingId,value.title,value.amount,value.quantity,first.condition??'NM','WTB',buyerCity,expiresAt,JSON.stringify(bundle),value.negotiable?1:0).run();
      after(()=>notifyListingWatchers(id));
      return Response.json({id,expiresAt,durationDays:policy.durationDays},{status:201});
    }
    if(!bundle&&value.quantity>policy.maxCopiesPerCard){
      throw new HttpError(400,listingLimitMessage('too-many-copies-of-card','EN',policy));
    }
    if(!value.instanceId)throw new HttpError(400,'Choose an owned item and available quantity.');
    const primary=await database.prepare('SELECT printing_id,quantity,condition FROM collectible_instances WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(value.instanceId,profile.id).first<{printing_id:string;quantity:number;condition:string}>();
    if(!primary)throw new HttpError(400,'Choose an owned item and available quantity.');

    if(bundle){
      await enforceMarketListingLimits(database,bundle,policy);
      if(bundle[0].instanceId!==value.instanceId||bundle[0].printingId!==primary.printing_id)throw new HttpError(400,'The first bundle card must match the selected Vault item.');
      const bundleQuantity=bundle.reduce((sum,item)=>sum+item.quantity,0);
      if(bundleQuantity!==value.quantity)throw new HttpError(400,'The listing quantity must match the combined bundle quantity.');
      const byInstance=new Map<string,{printingId:string;quantity:number}>();
      for(const item of bundle){
        if(!item.instanceId)throw new HttpError(400,'Add every bundled card to your Vault before publishing the listing.');
        const current=byInstance.get(item.instanceId);
        if(current&&current.printingId!==item.printingId)throw new HttpError(400,'A Vault item cannot represent multiple printings in one bundle.');
        byInstance.set(item.instanceId,{printingId:item.printingId,quantity:(current?.quantity??0)+item.quantity});
      }
      for(const [instanceId,item] of byInstance){
        const owned=await database.prepare('SELECT printing_id,quantity FROM collectible_instances WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(instanceId,profile.id).first<{printing_id:string;quantity:number}>();
        if(!owned||owned.printing_id!==item.printingId||item.quantity>owned.quantity)throw new HttpError(400,'One or more items in the bundle exceeds your available Vault quantity.');
        const alreadyListed=await database.prepare(`SELECT
          COALESCE((SELECT SUM(CASE WHEN items IS NULL THEN quantity ELSE 0 END) FROM listings WHERE instance_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)),0)
          + COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM listings l,json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=? AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0) AS total`).bind(instanceId,instanceId).first<{total:number}>();
        if((alreadyListed?.total??0)+item.quantity>owned.quantity)throw new HttpError(409,'One or more items in the bundle is already listed.');
      }
    }else if(value.quantity>primary.quantity){
      throw new HttpError(400,'Choose an owned item and available quantity.');
    }

    const primaryQuantity=bundle?byInstanceQuantity(bundle,value.instanceId):value.quantity;
    const id=crypto.randomUUID();
    const expiresAt=computeListingExpiration(policy.durationDays);
    const itemsJson=bundle?JSON.stringify(bundle):null;
    const result=await database.prepare(`
      INSERT INTO listings (id,seller_id,printing_id,instance_id,title,amount,currency,quantity,condition,type,city,expires_at,items,negotiable)
      SELECT ?,?,?,?,?,?,'IDR',?,?,?,?,?,?,?
      WHERE ? <= ? - (
        COALESCE((SELECT SUM(CASE WHEN items IS NULL THEN quantity ELSE 0 END) FROM listings WHERE instance_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)),0)
        + COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM listings l,json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=? AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0)
      )
      AND NOT EXISTS (
        SELECT 1 FROM (
          SELECT json_extract(value,'$.instanceId') AS instanceId,SUM(CAST(json_extract(value,'$.quantity') AS INTEGER)) AS quantity
          FROM json_each(?) GROUP BY json_extract(value,'$.instanceId')
        ) requested LEFT JOIN collectible_instances owned ON owned.id=requested.instanceId
        WHERE owned.id IS NULL OR owned.owner_id!=? OR owned.deleted_at IS NOT NULL OR requested.quantity > owned.quantity - (
          COALESCE((SELECT SUM(CASE WHEN l.items IS NULL THEN l.quantity ELSE 0 END) FROM listings l WHERE l.instance_id=requested.instanceId AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0)
          + COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM listings l,json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=requested.instanceId AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0)
        )
      )
    `).bind(id,profile.id,primary.printing_id,value.instanceId,value.title,value.amount,value.quantity,primary.condition,value.type,value.city,expiresAt,itemsJson,value.negotiable?1:0,primaryQuantity,primary.quantity,value.instanceId,value.instanceId,itemsJson,profile.id).run();
    if(!result.meta.changes)throw new HttpError(409,'That quantity is already listed.');
    after(()=>notifyListingWatchers(id));
    return Response.json({id,expiresAt,durationDays:policy.durationDays},{status:201});
  }catch(error){
    if(error instanceof Error&&/foreign key|constraint/i.test(error.message))return Response.json({error:'This Vault card is no longer available. Refresh your Vault and try again.'},{status:409});
    return errorResponse(error);
  }
}

function byInstanceQuantity(items:z.infer<typeof itemSchema>[],instanceId:string){
  return items.reduce((sum,item)=>sum+(item.instanceId===instanceId?item.quantity:0),0);
}
