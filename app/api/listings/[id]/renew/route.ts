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
      'SELECT id,seller_id,status,expires_at FROM listings WHERE id=? AND seller_id=?'
    ).bind(id,p.id).first<{id:string;seller_id:string;status:string;expires_at:string|null}>();

    if(!listing){
      throw new HttpError(404,'Listing not found or you are not authorized to renew it.');
    }

    if(listing.status==='SOLD'){
      throw new HttpError(400,'Sold listings cannot be renewed.');
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
