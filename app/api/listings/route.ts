import {z} from 'zod';
import {user,db,errorResponse,guard,market,HttpError} from '@/lib/server/store';
import {getDynamicListingPolicy,computeListingExpiration} from '@/lib/market/policy';

const itemSchema=z.object({instanceId:z.string().uuid().optional(),printingId:z.string(),quantity:z.number().int().positive().max(999),condition:z.string().optional(),unitAmount:z.number().int().nonnegative().optional()});
const schema=z.object({instanceId:z.string().uuid(),amount:z.number().int().positive().max(100000000000),quantity:z.number().int().positive().max(999),city:z.string().trim().min(2).max(60),title:z.string().trim().min(3).max(100),type:z.enum(['WTS','WTB']).default('WTS'),negotiable:z.boolean().default(true),items:z.array(itemSchema).max(30).optional()});

export async function GET(){
  try{return Response.json({listings:await market()})}
  catch(error){console.error('listings_load_failed',error);return Response.json({error:'Live listings are temporarily unavailable. Please retry.'},{status:503})}
}

export async function POST(request:Request){
  try{
    guard(request);
    const profile=await user();
    if(profile.region!=='ID')throw new HttpError(403,'Seller listings currently require an Indonesian profile. Global collection and deck access remain available.');
    const database=db();
    const policy=await getDynamicListingPolicy(profile.tier,database);
    const activeCount=await database.prepare("SELECT COUNT(*) AS total FROM listings WHERE seller_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)").bind(profile.id).first<{total:number}>();
    if((activeCount?.total??0)>=policy.maxActiveListings)throw new HttpError(400,`You have reached the limit of ${policy.maxActiveListings} active listings for your account.`);

    const value=schema.parse(await request.json());
    const primary=await database.prepare('SELECT printing_id,quantity,condition FROM collectible_instances WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(value.instanceId,profile.id).first<{printing_id:string;quantity:number;condition:string}>();
    if(!primary)throw new HttpError(400,'Choose an owned item and available quantity.');

    const bundle=value.items?.length?value.items:null;
    if(bundle){
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
    return Response.json({id,expiresAt,durationDays:policy.durationDays},{status:201});
  }catch(error){
    if(error instanceof Error&&/foreign key|constraint/i.test(error.message))return Response.json({error:'This Vault card is no longer available. Refresh your Vault and try again.'},{status:409});
    return errorResponse(error);
  }
}

function byInstanceQuantity(items:z.infer<typeof itemSchema>[],instanceId:string){
  return items.reduce((sum,item)=>sum+(item.instanceId===instanceId?item.quantity:0),0);
}
