import {db,errorResponse,user,HttpError} from '@/lib/server/store';
import {ipaymuExpiryTimestamp,ipaymuQrImageUrl} from '@/lib/server/ipaymu';

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
    const target=ipaymuQrImageUrl(source,details.ipaymuMode);
    if(!target)throw new HttpError(502,'The payment provider returned an invalid QR code address.');
    return new Response(null,{status:302,headers:{Location:target,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
  }catch(error){return errorResponse(error)}
}
