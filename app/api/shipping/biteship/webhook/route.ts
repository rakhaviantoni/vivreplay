import {db} from '@/lib/server/store';
import {sendMarketEmail} from '@/lib/server/market-notifications';

const notificationStatuses=new Set(['picking_up','picked','in_transit','dropping_off','delivered','on_hold','rejected','cancelled','return_in_transit','returned','disposed','courier_not_found']);
const webhookProbeResponse=()=>new Response('ok',{status:200,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});

export async function GET(){
  return webhookProbeResponse();
}

export async function HEAD(){
  return new Response(null,{status:200,headers:{'Cache-Control':'no-store'}});
}

export async function OPTIONS(){
  return webhookProbeResponse();
}

export async function POST(request:Request){
  if(process.env.BITESHIP_WEBHOOK_INSTALLATION_MODE==='true')return webhookProbeResponse();
  let rawBody='';
  let body:{event?:string;order_id?:string;courier_tracking_id?:string;courier_waybill_id?:string;courier_company?:string;courier_type?:string;courier_link?:string;status?:string;price?:number;order_price?:number};
  try{
    rawBody=await request.text();
    if(!rawBody.trim())return webhookProbeResponse();
    body=JSON.parse(rawBody);
    if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Webhook payload must be a JSON object.'},{status:400});
    // Biteship may send an empty JSON object while checking a new endpoint.
    if(!body.event)return webhookProbeResponse();
  }catch{return Response.json({error:'Webhook payload must be valid JSON.'},{status:400})}

  const supplied=request.headers.get('x-vivreplay-webhook-secret')?.trim()??'';
  if(!supplied)return Response.json({error:'Unauthorized.'},{status:401});
  const secret=process.env.BITESHIP_WEBHOOK_SECRET?.trim();
  if(!secret)return Response.json({error:'Webhook authentication is not configured.'},{status:503});
  const [providedHash,expectedHash]=await Promise.all([crypto.subtle.digest('SHA-256',new TextEncoder().encode(supplied)),crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret))]);
  const left=new Uint8Array(providedHash);const right=new Uint8Array(expectedHash);let mismatch=0;for(let index=0;index<left.length;index++)mismatch|=left[index]^right[index];
  if(mismatch!==0)return Response.json({error:'Unauthorized.'},{status:401});
  try{
    if(!['order.status','order.price','order.waybill_id'].includes(body.event??''))return Response.json({ok:true,ignored:true});
    const trackingId=body.courier_tracking_id;const waybill=body.courier_waybill_id;
    const order=await db().prepare('SELECT id,buyer_id AS buyerId,details FROM checkout_orders WHERE biteship_order_id=? OR biteship_tracking_id=? OR shipping_waybill_id=? LIMIT 1').bind(body.order_id??'',trackingId??'',waybill??'').first<{id:string;buyerId:string;details:string|null}>();
    if(!order)return Response.json({ok:true,ignored:true});
    let details:Record<string,unknown>={};try{details=JSON.parse(order.details||'{}') as Record<string,unknown>}catch{}
    const trackingStatus=body.status?.trim().toLowerCase().replace(/\s+/g,'_');
    const previousStatus=typeof details.trackingStatus==='string'?details.trackingStatus.toLowerCase().replace(/\s+/g,'_'):'';
    const next={...details,trackingStatus:trackingStatus??details.trackingStatus,trackingNumber:waybill??details.trackingNumber,waybillId:waybill??details.waybillId,trackingUrl:body.courier_link??details.trackingUrl,courier:body.courier_company??details.courier,shippingPrice:body.order_price??body.price??details.shippingPrice};
    if(['picked','in_transit','dropping_off','delivered'].includes(trackingStatus??''))await db().prepare('UPDATE checkout_orders SET dispatched_at=COALESCE(dispatched_at,CURRENT_TIMESTAMP) WHERE id=?').bind(order.id).run();
    if(trackingStatus==='delivered')await db().prepare('UPDATE checkout_orders SET delivered_at=COALESCE(delivered_at,CURRENT_TIMESTAMP) WHERE id=?').bind(order.id).run();
    await db().prepare('UPDATE checkout_orders SET details=?,shipping_waybill_id=COALESCE(?,shipping_waybill_id),shipping_tracking_url=COALESCE(?,shipping_tracking_url),shipping_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(JSON.stringify(next),waybill??null,body.courier_link??null,order.id).run();
    if(body.event==='order.status'&&trackingStatus&&trackingStatus!==previousStatus&&notificationStatuses.has(trackingStatus)){
      await sendMarketEmail(order.buyerId,'order-tracking','Market order',order.id);
    }
    return Response.json({ok:true});
  }catch{return Response.json({error:'Webhook payload could not be processed.'},{status:400})}
}
