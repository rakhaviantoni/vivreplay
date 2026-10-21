import {db,errorResponse,HttpError,user} from '@/lib/server/store';
import {biteshipRequest} from '@/lib/server/biteship';

type Tracking={status?:string;waybill_id?:string;courier?:{company?:string;name?:string};origin?:unknown;destination?:unknown;history?:Array<{note?:string;updated_at?:string;status?:string}>};
type TrackingScan={note?:string;updated_at?:string;status?:string};
function scans(value:unknown):TrackingScan[]{if(!Array.isArray(value))return[];return value.flatMap(scan=>{if(!scan||typeof scan!=='object'||Array.isArray(scan))return[];const item=scan as Record<string,unknown>;const result:TrackingScan={};if(typeof item.note==='string')result.note=item.note;if(typeof item.updated_at==='string')result.updated_at=item.updated_at;if(typeof item.status==='string')result.status=item.status;return result.note||result.updated_at||result.status?[result]:[]})}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();const {id}=await params;const row=await db().prepare('SELECT buyer_id AS buyerId,seller_id AS sellerId,biteship_tracking_id AS trackingId,shipping_waybill_id AS waybillId,shipping_tracking_url AS trackingUrl,details,status,delivered_at AS deliveredAt FROM checkout_orders WHERE id=? AND kind=\'MARKET\'').bind(id).first<{buyerId:string;sellerId:string|null;trackingId:string|null;waybillId:string|null;trackingUrl:string|null;details:string;status:string;deliveredAt:string|null}>();
    if(!row||(row.buyerId!==profile.id&&row.sellerId!==profile.id))throw new HttpError(404,'Order not found.');
    let savedDetails:Record<string,unknown>={};try{const parsed=JSON.parse(row.details||'{}') as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))savedDetails=parsed as Record<string,unknown>}catch{}
    if(!row.trackingId&&savedDetails.shippingMethod==='manual')return Response.json({tracking:{status:'manual_shipped',waybill_id:row.waybillId,courier:{name:savedDetails.courierName},link:row.trackingUrl,history:[]},trackingHistory:[],deliveredAt:row.deliveredAt},{headers:{'Cache-Control':'private, no-store'}});
    if(!row.trackingId)throw new HttpError(409,'Tracking is available after the seller arranges shipping.');
    const result=await biteshipRequest<{tracking?:Tracking}&Tracking>(`/trackings/${encodeURIComponent(row.trackingId)}`);
    const tracking=result.tracking??result;
    const status=tracking.status?.trim().toLowerCase().replace(/[\s-]+/g,'_')??'';
    let deliveredAt=row.deliveredAt;let details:Record<string,unknown>={};try{const parsed=JSON.parse(row.details||'{}') as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
    const carrierDelivered=['delivered','complete','completed'].includes(status);const incoming=scans(tracking.history);const saved=scans(details.trackingHistory);const merged=new Map<string,TrackingScan>();for(const scan of [...saved,...incoming])merged.set(`${scan.updated_at??''}|${scan.status??''}|${scan.note??''}`,scan);const history=[...merged.values()].sort((a,b)=>Date.parse(a.updated_at??'')-Date.parse(b.updated_at??'')).slice(-100);
    const changed=JSON.stringify(saved)!==JSON.stringify(history)||Boolean(status&&details.trackingStatus!==status);
    if(status)details.trackingStatus=status;if(history.length)details.trackingHistory=history;
    if(changed||carrierDelivered&&!deliveredAt){await db().prepare('UPDATE checkout_orders SET details=?,delivered_at=CASE WHEN ?=1 THEN COALESCE(delivered_at,CURRENT_TIMESTAMP) ELSE delivered_at END WHERE id=?').bind(JSON.stringify(details),carrierDelivered?1:0,id).run();if(carrierDelivered&&!deliveredAt)deliveredAt=new Date().toISOString()}
    return Response.json({tracking:{...tracking,history},trackingHistory:history,deliveredAt},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
