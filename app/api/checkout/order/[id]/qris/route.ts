import {db,errorResponse,user,HttpError} from '@/lib/server/store';
import {ipaymuExpiryTimestamp} from '@/lib/server/ipaymu';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();
    const {id}=await params;
    const order=await db().prepare('SELECT buyer_id AS buyerId,status,details FROM checkout_orders WHERE id=?').bind(id).first<{buyerId:string;status:string;details:string}>();
    if(!order||order.buyerId!==profile.id)throw new HttpError(404,'Payment code was not found.');
    if(order.status!=='PENDING_PAYMENT')throw new HttpError(404,'This payment code is no longer active.');
    let details:Record<string,unknown>={};
    try{const parsed=JSON.parse(order.details) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
    const source=details.ipaymuPaymentQrImage;
    if(details.ipaymuPaymentMethod!=='qris'||typeof source!=='string'||ipaymuExpiryTimestamp(details.ipaymuPaymentExpiresAt)===null||ipaymuExpiryTimestamp(details.ipaymuPaymentExpiresAt)!<=Date.now())throw new HttpError(404,'This payment code has expired.');
    const target=new URL(source);
    const allowedHosts=process.env.IPAYMU_MODE==='sandbox'?['sandbox-payment.ipaymu.com','sandbox.ipaymu.com']:['my.ipaymu.com','payment.ipaymu.com'];
    if(target.protocol!=='https:'||!allowedHosts.includes(target.hostname))throw new HttpError(502,'The payment code could not be loaded.');
    const upstream=await fetch(target,{cache:'no-store',redirect:'error'});
    const contentType=(upstream.headers.get('content-type')??'').split(';')[0].trim().toLowerCase();
    if(!upstream.ok||!['image/png','image/jpeg','image/webp'].includes(contentType))throw new HttpError(502,'The payment code could not be loaded.');
    return new Response(upstream.body,{status:200,headers:{'Content-Type':contentType,'Cache-Control':'private, max-age=30','X-Content-Type-Options':'nosniff'}});
  }catch(error){return errorResponse(error)}
}
