import {db,errorResponse,HttpError,user} from '@/lib/server/store';
import {biteshipRequest} from '@/lib/server/biteship';

type Tracking={status?:string;waybill_id?:string;courier?:{company?:string;name?:string};origin?:unknown;destination?:unknown;history?:Array<{note?:string;updated_at?:string;status?:string}>};
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();const {id}=await params;const row=await db().prepare('SELECT buyer_id AS buyerId,seller_id AS sellerId,biteship_tracking_id AS trackingId FROM checkout_orders WHERE id=? AND kind=\'MARKET\'').bind(id).first<{buyerId:string;sellerId:string|null;trackingId:string|null}>();
    if(!row||(row.buyerId!==profile.id&&row.sellerId!==profile.id))throw new HttpError(404,'Order not found.');
    if(!row.trackingId)throw new HttpError(409,'Tracking is available after the seller arranges shipping.');
    const result=await biteshipRequest<{tracking?:Tracking}&Tracking>(`/trackings/${encodeURIComponent(row.trackingId)}`);
    return Response.json({tracking:result.tracking??result},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
