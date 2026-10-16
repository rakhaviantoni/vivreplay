import {db,errorResponse,HttpError,user} from '@/lib/server/store';
import {biteshipRequest} from '@/lib/server/biteship';

type Tracking={status?:string;waybill_id?:string;courier?:{company?:string;name?:string};origin?:unknown;destination?:unknown;history?:Array<{note?:string;updated_at?:string;status?:string}>};
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();const {id}=await params;const row=await db().prepare('SELECT buyer_id AS buyerId,seller_id AS sellerId,biteship_tracking_id AS trackingId,details,status,delivered_at AS deliveredAt FROM checkout_orders WHERE id=? AND kind=\'MARKET\'').bind(id).first<{buyerId:string;sellerId:string|null;trackingId:string|null;details:string;status:string;deliveredAt:string|null}>();
    if(!row||(row.buyerId!==profile.id&&row.sellerId!==profile.id))throw new HttpError(404,'Order not found.');
    if(!row.trackingId)throw new HttpError(409,'Tracking is available after the seller arranges shipping.');
    const result=await biteshipRequest<{tracking?:Tracking}&Tracking>(`/trackings/${encodeURIComponent(row.trackingId)}`);
    const tracking=result.tracking??result;
    const status=tracking.status?.trim().toLowerCase().replace(/[\s-]+/g,'_')??'';
    let deliveredAt=row.deliveredAt;
    if(status&&(row.status==='SHIPPED')){
      let details:Record<string,unknown>={};try{const parsed=JSON.parse(row.details||'{}') as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
      const carrierDelivered=['delivered','complete','completed'].includes(status);
      if(details.trackingStatus!==status||(carrierDelivered&&!deliveredAt)){
        details.trackingStatus=status;
        await db().prepare("UPDATE checkout_orders SET details=?,delivered_at=CASE WHEN ?=1 THEN COALESCE(delivered_at,CURRENT_TIMESTAMP) ELSE delivered_at END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='SHIPPED'").bind(JSON.stringify(details),carrierDelivered?1:0,id).run();
        if(carrierDelivered&&!deliveredAt)deliveredAt=new Date().toISOString();
      }
    }
    return Response.json({tracking,deliveredAt},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
