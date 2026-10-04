import {user,db,errorResponse,guard,HttpError} from '@/lib/server/store';
import {getDynamicListingPolicy,computeListingExpiration} from '@/lib/market/policy';

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    guard(req);
    const p=await user();
    const {id}=await params;
    const d=db();
    const policy=await getDynamicListingPolicy(p.tier,d);

    const listing=await d.prepare(
      'SELECT id,seller_id,status,expires_at,instance_id AS instanceId,quantity,items FROM listings WHERE id=? AND seller_id=?'
    ).bind(id,p.id).first<{id:string;seller_id:string;status:string;expires_at:string|null;instanceId:string;quantity:number;items:string|null}>();

    if(!listing){
      throw new HttpError(404,'Listing not found or you are not authorized to renew it.');
    }

    if(listing.status==='SOLD'){
      throw new HttpError(400,'Sold listings cannot be renewed.');
    }

    const entries=listing.items?JSON.parse(listing.items) as {instanceId?:string;quantity?:number}[]:[];
    const needed=new Map<string,number>();
    for(const entry of entries){if(entry.instanceId&&entry.quantity)needed.set(entry.instanceId,(needed.get(entry.instanceId)??0)+entry.quantity)}
    if(!needed.size)needed.set(listing.instanceId,listing.quantity);
    for(const [instanceId,quantity] of needed){
      const owned=await d.prepare('SELECT quantity FROM collectible_instances WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(instanceId,p.id).first<{quantity:number}>();
      if(!owned||quantity>owned.quantity)throw new HttpError(409,'The Vault no longer has enough copies to renew this listing.');
      const reserved=await d.prepare(`SELECT
        COALESCE((SELECT SUM(CASE WHEN items IS NULL THEN quantity ELSE 0 END) FROM listings WHERE instance_id=? AND status='ACTIVE' AND id!=? AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)),0)
        + COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM listings l,json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=? AND l.status='ACTIVE' AND l.id!=? AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0) AS quantity`).bind(instanceId,id,instanceId,id).first<{quantity:number}>();
      if(quantity+(reserved?.quantity??0)>owned.quantity)throw new HttpError(409,'Some copies are already reserved by another active listing.');
    }

    const newExpiresAt=computeListingExpiration(policy.durationDays);

    await db().prepare(
      "UPDATE listings SET status='ACTIVE', expires_at=? WHERE id=? AND seller_id=?"
    ).bind(newExpiresAt,id,p.id).run();

    return Response.json({
      ok:true,
      id,
      status:'ACTIVE',
      expiresAt:newExpiresAt,
      durationDays:policy.durationDays,
      tier:policy.tier,
    });
  }catch(e){
    return errorResponse(e);
  }
}
