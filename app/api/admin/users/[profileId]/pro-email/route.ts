import {db,errorResponse,HttpError} from '@/lib/server/store';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';
import {resendProActivationEmail} from '@/lib/server/market-notifications';

export async function POST(_request:Request,{params}:{params:Promise<{profileId:string}>}){
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  try{
    const {profileId}=await params;
    const order=await db().prepare(`SELECT id FROM checkout_orders WHERE kind='PRO' AND buyer_id=? AND status='PAID' ORDER BY paid_at DESC LIMIT 1`).bind(profileId).first<{id:string}>();
    if(!order)throw new HttpError(404,'No paid Market Pro order was found for this account.');
    await resendProActivationEmail(profileId,order.id);
    return Response.json({sent:true},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
