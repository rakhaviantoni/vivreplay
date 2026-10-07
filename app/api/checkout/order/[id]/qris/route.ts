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
    const upstream=await fetch(target,{cache:'no-store',redirect:'follow',headers:{Accept:'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',Referer:`${target.origin}/`}});
    const finalUrl=new URL(upstream.url||target.toString());
    const trustedFinalHost=finalUrl.hostname==='storage.googleapis.com'||finalUrl.hostname==='ipaymu.com'||finalUrl.hostname.endsWith('.ipaymu.com');
    if(!trustedFinalHost)throw new HttpError(502,'The payment code could not be loaded.');
    if(!upstream.ok)throw new HttpError(502,'The payment code could not be loaded.');
    const image=await upstream.arrayBuffer();
    if(image.byteLength===0||image.byteLength>1_500_000)throw new HttpError(502,'The payment code could not be loaded.');
    const bytes=new Uint8Array(image);
    const signature=(...values:number[])=>values.every((value,index)=>bytes[index]===value);
    const prefix=new TextDecoder().decode(bytes.slice(0,512)).trimStart();
    const contentType=signature(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)?'image/png':signature(0xff,0xd8,0xff)?'image/jpeg':bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&prefix.slice(8,12)==='WEBP'?'image/webp':/<svg[\s>]/i.test(prefix)?'image/svg+xml':null;
    if(!contentType)throw new HttpError(502,'The payment code could not be loaded.');
    return new Response(image,{status:200,headers:{'Content-Type':contentType,'Cache-Control':'private, max-age=30','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }catch(error){return errorResponse(error)}
}
