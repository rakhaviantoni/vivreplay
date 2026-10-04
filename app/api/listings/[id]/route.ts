import {user,db,errorResponse,guard,HttpError} from '@/lib/server/store';
import {getDynamicListingPolicy,computeListingExpiration} from '@/lib/market/policy';

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    guard(req);
    const p=await user();
    const {id}=await params;

    const result=await db().prepare(
      "UPDATE listings SET status='CLOSED' WHERE id=? AND seller_id=? AND status!='SOLD'"
    ).bind(id,p.id).run();

    if(!result.meta.changes){
      throw new HttpError(404,'Listing not found, already sold, or you do not have permission to close it.');
    }

    return Response.json({ok:true,id,status:'CLOSED'});
  }catch(e){
    return errorResponse(e);
  }
}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    guard(req);
    const p=await user();
    const {id}=await params;
    const body=await req.json() as {action?:unknown};
    if(body.action!=='pause'&&body.action!=='resume')throw new HttpError(400,'Choose pause or resume.');
    const d=db();
    const listing=await d.prepare('SELECT id,status,expires_at,instance_id AS instanceId,quantity,items FROM listings WHERE id=? AND seller_id=?').bind(id,p.id).first<{id:string;status:string;expires_at:string|null;instanceId:string;quantity:number;items:string|null}>();
    if(!listing)throw new HttpError(404,'Listing not found or you do not have permission to manage it.');
    if(body.action==='pause'){
      if(listing.status!=='ACTIVE')throw new HttpError(400,'Only active listings can be paused.');
      await d.prepare("UPDATE listings SET status='PAUSED' WHERE id=? AND seller_id=? AND status='ACTIVE'").bind(id,p.id).run();
      return Response.json({ok:true,id,status:'PAUSED'});
    }
    if(listing.status!=='PAUSED'&&listing.status!=='CLOSED')throw new HttpError(400,'Only paused or closed listings can be resumed.');
    const entries=listing.items?JSON.parse(listing.items) as {instanceId?:string;quantity?:number}[]:[];
    const needed=new Map<string,number>();
    for(const entry of entries){if(entry.instanceId&&entry.quantity)needed.set(entry.instanceId,(needed.get(entry.instanceId)??0)+entry.quantity)}
    if(!needed.size)needed.set(listing.instanceId,listing.quantity);
    for(const [instanceId,quantity] of needed){
      const owned=await d.prepare('SELECT quantity FROM collectible_instances WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(instanceId,p.id).first<{quantity:number}>();
      if(!owned||quantity>owned.quantity)throw new HttpError(409,'The Vault no longer has enough copies to resume this listing.');
      const reserved=await d.prepare(`SELECT
        COALESCE((SELECT SUM(CASE WHEN items IS NULL THEN quantity ELSE 0 END) FROM listings WHERE instance_id=? AND status='ACTIVE' AND id!=? AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)),0)
        + COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM listings l,json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=? AND l.status='ACTIVE' AND l.id!=? AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0) AS quantity`).bind(instanceId,id,instanceId,id).first<{quantity:number}>();
      if(quantity+(reserved?.quantity??0)>owned.quantity)throw new HttpError(409,'Some copies are already reserved by another active listing.');
    }
    const policy=await getDynamicListingPolicy(p.tier,d);
    const expiresAt=listing.expires_at&&new Date(`${listing.expires_at.replace(' ','T')}Z`).getTime()>Date.now()?listing.expires_at:computeListingExpiration(policy.durationDays);
    await d.prepare("UPDATE listings SET status='ACTIVE',expires_at=? WHERE id=? AND seller_id=? AND status IN ('PAUSED','CLOSED')").bind(expiresAt,id,p.id).run();
    return Response.json({ok:true,id,status:'ACTIVE',expiresAt});
  }catch(error){return errorResponse(error)}
}
