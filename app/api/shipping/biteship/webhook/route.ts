import {db} from '@/lib/server/store';

export async function POST(request:Request){
  const secret=process.env.BITESHIP_WEBHOOK_SECRET?.trim()||process.env.BITESHIP_API_KEY?.trim();
  if(!secret)return Response.json({error:'Webhook authentication is not configured.'},{status:503});
  const supplied=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()??'';
  const [providedHash,expectedHash]=await Promise.all([crypto.subtle.digest('SHA-256',new TextEncoder().encode(supplied)),crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret))]);
  const left=new Uint8Array(providedHash);const right=new Uint8Array(expectedHash);let mismatch=0;for(let index=0;index<left.length;index++)mismatch|=left[index]^right[index];
  if(mismatch!==0)return Response.json({error:'Unauthorized.'},{status:401});
  try{
    const body=await request.json() as {event?:string;order_id?:string;courier_tracking_id?:string;courier_waybill_id?:string;courier_company?:string;courier_type?:string;courier_link?:string;status?:string;price?:number;order_price?:number};
    if(!['order.status','order.price','order.waybill_id'].includes(body.event??''))return Response.json({ok:true,ignored:true});
    const trackingId=body.courier_tracking_id;const waybill=body.courier_waybill_id;
    const order=await db().prepare('SELECT id,details FROM checkout_orders WHERE biteship_order_id=? OR biteship_tracking_id=? OR shipping_waybill_id=? LIMIT 1').bind(body.order_id??'',trackingId??'',waybill??'').first<{id:string;details:string|null}>();
    if(!order)return Response.json({ok:true,ignored:true});
    let details:Record<string,unknown>={};try{details=JSON.parse(order.details||'{}') as Record<string,unknown>}catch{}
    const next={...details,trackingStatus:body.status??details.trackingStatus,trackingNumber:waybill??details.trackingNumber,waybillId:waybill??details.waybillId,trackingUrl:body.courier_link??details.trackingUrl,courier:body.courier_company??details.courier,shippingPrice:body.order_price??body.price??details.shippingPrice};
    await db().prepare('UPDATE checkout_orders SET details=?,shipping_waybill_id=COALESCE(?,shipping_waybill_id),shipping_tracking_url=COALESCE(?,shipping_tracking_url),shipping_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(JSON.stringify(next),waybill??null,body.courier_link??null,order.id).run();
    return Response.json({ok:true});
  }catch{return Response.json({error:'Webhook payload could not be processed.'},{status:400})}
}
