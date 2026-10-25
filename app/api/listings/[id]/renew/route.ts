import {user,db,errorResponse,guard,HttpError} from '@/lib/server/store';
import {getDynamicListingPolicy,computeListingExpiration} from '@/lib/market/policy';
import {listingLimitMessage} from '@/lib/market/listing-limits';
import {enforceMarketListingLimits} from '@/lib/server/market-listing-limits';

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    guard(req);
    const p=await user();
    const {id}=await params;
    const d=db();
    const policy=await getDynamicListingPolicy(p.tier,d,p.pro_billing_period);

    const listing=await d.prepare(
      'SELECT id,seller_id,status,expires_at,instance_id AS instanceId,quantity,items FROM listings WHERE id=? AND seller_id=?'
    ).bind(id,p.id).first<{id:string;seller_id:string;status:string;expires_at:string|null;instanceId:string;quantity:number;items:string|null}>();

    if(!listing){
      throw new HttpError(404,'Listing not found or you are not authorized to renew it.');
    }

    if(listing.status==='SOLD'){
      throw new HttpError(400,'Sold listings cannot be renewed.');
    }

    const currentExpires = listing.expires_at ? new Date(listing.expires_at.includes('T') ? listing.expires_at : `${listing.expires_at.replace(' ', 'T')}Z`).getTime() : 0;
    const msLeft = currentExpires - Date.now();
    const maxEarlyExtendDays = policy.tier === 'pro' ? 5 : 2;
    const maxEarlyRenewMs = maxEarlyExtendDays * 24 * 60 * 60 * 1000;

    if (listing.status === 'ACTIVE' && msLeft > maxEarlyRenewMs) {
      const daysRemaining = Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
      throw new HttpError(400, `Listings can only be extended when nearing expiration (${maxEarlyExtendDays} days or less remaining). This listing currently has ${daysRemaining} days left.`);
    }

    const activeCount=await d.prepare("SELECT COUNT(*) AS total FROM listings WHERE seller_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) AND id<>?").bind(p.id,id).first<{total:number}>();
    if((activeCount?.total??0)>=policy.maxActiveListings)throw new HttpError(400,`You have reached the limit of ${policy.maxActiveListings} active listings for your account.`);

    const entries=listing.items?JSON.parse(listing.items) as {instanceId?:string;quantity?:number}[]:[];
    if(entries.length)await enforceMarketListingLimits(d,entries as {printingId:string;quantity:number}[],policy);
    else if(listing.quantity>policy.maxCopiesPerCard)throw new HttpError(400,listingLimitMessage('too-many-copies-of-card','EN',policy));
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
