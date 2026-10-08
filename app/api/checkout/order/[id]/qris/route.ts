import {db,errorResponse,user,HttpError} from '@/lib/server/store';
import {ipaymuExpiryTimestamp,ipaymuQrImageUrl} from '@/lib/server/ipaymu';

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();
    const {id}=await params;
    const order=await db().prepare('SELECT buyer_id AS buyerId,status,details,updated_at AS updatedAt FROM checkout_orders WHERE id=?').bind(id).first<{buyerId:string;status:string;details:string;updatedAt:string|null}>();
    if(!order||order.buyerId!==profile.id)throw new HttpError(404,'Payment code was not found.');
    if(order.status!=='PENDING_PAYMENT')throw new HttpError(404,'This payment code is no longer active.');
    let details:Record<string,unknown>={};
    try{const parsed=JSON.parse(order.details) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
    const source=details.ipaymuPaymentQrImage;
    const paymentExpiry=details.ipaymuPaymentMethod==='qris'?ipaymuExpiryTimestamp(details.ipaymuPaymentExpiresAt,details.ipaymuPaymentCreatedAt,order.updatedAt):null;
    if(details.ipaymuPaymentMethod!=='qris'||typeof source!=='string'||paymentExpiry===null||paymentExpiry<=Date.now())throw new HttpError(404,'This payment code has expired.');
    const target=ipaymuQrImageUrl(source,details.ipaymuMode);
    if(!target)throw new HttpError(502,'Could not load the payment code. Please try again.');
    const refreshBucket=String(Math.floor(Date.now()/(5*60*1000)));
    const refreshedTarget=new URL(target);
    refreshedTarget.searchParams.set('refresh',refreshBucket);
    if(new URL(request.url).searchParams.get('open')==='1')return new Response(null,{status:302,headers:{Location:refreshedTarget.toString(),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
    const upstream=await fetch(refreshedTarget.toString(),{cache:'no-store',redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',Accept:'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.1',Referer:`${new URL(target).origin}/`}});
    const finalUrl=new URL(upstream.url||target);
    const trustedHost=finalUrl.hostname==='ipaymu.com'||finalUrl.hostname.endsWith('.ipaymu.com')||finalUrl.hostname==='storage.googleapis.com';
    if(!upstream.ok||!trustedHost)throw new HttpError(502,'The payment code could not be loaded.');
    const contentType=upstream.headers.get('content-type')?.split(';')[0].trim().toLowerCase()??'';
    let body:ArrayBuffer;
    let imageType=contentType;
    if(contentType.startsWith('image/')){
      body=await upstream.arrayBuffer();
    }else if(contentType==='text/html'||contentType==='application/xhtml+xml'){
      const html=await upstream.text();
      if(html.length>500_000)throw new HttpError(502,'The payment code could not be loaded.');
      const match=html.match(/data:image\/(png|jpeg|webp);base64,([a-z0-9+/=\s]+)['"]/i);
      if(!match)throw new HttpError(502,'The payment code could not be loaded.');
      const base64=match[2].replace(/\s/g,'');
      const binary=atob(base64);
      if(!binary.length||binary.length>1_500_000)throw new HttpError(502,'The payment code could not be loaded.');
      const bytes=new Uint8Array(binary.length);
      for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
      body=bytes.buffer;
      imageType=`image/${match[1].toLowerCase()}`;
    }else{
      throw new HttpError(502,'The payment code could not be loaded.');
    }
    if(!body.byteLength||body.byteLength>1_500_000)throw new HttpError(502,'The payment code could not be loaded.');
    if(imageType==='image/png'){
      const signature=new Uint8Array(body,0,Math.min(8,body.byteLength));
      if(signature.length!==8||signature.some((value,index)=>value!==[137,80,78,71,13,10,26,10][index]))throw new HttpError(502,'The payment code could not be loaded.');
    }
    return new Response(body,{status:200,headers:{'Content-Type':imageType,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
  }catch(error){return errorResponse(error)}
}
