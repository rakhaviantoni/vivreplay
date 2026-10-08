import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {env} from 'cloudflare:workers';
import {sendMarketEmail} from '@/lib/server/market-notifications';

const MAX_FILE=25_000_000;
const MAX_FILES=4;
type Evidence={id:string;objectKey:string;name:string;mime:string;size:number};
function detect(bytes:Uint8Array,mime:string){
  if(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return mime;
  if(mime==='image/png'&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return mime;
  if(mime==='image/webp'&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return mime;
  if(mime==='video/mp4'&&String.fromCharCode(...bytes.slice(4,8))==='ftyp')return mime;
  if(mime==='video/webm'&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3)return mime;
  return null;
}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();const {id}=await params;
    const row=await db().prepare(`SELECT id,order_id AS orderId,buyer_id AS buyerId,seller_id AS sellerId,status,reason,affected_items AS affectedItems,requested_resolution AS requestedResolution,evidence,seller_response AS sellerResponse,decision,decision_note AS decisionNote,refund_amount AS refundAmount,shipping_refund AS shippingRefund,created_at AS createdAt,resolved_at AS resolvedAt FROM market_disputes WHERE order_id=? AND (buyer_id=? OR seller_id=?)`).bind(id,profile.id,profile.id).first<Record<string,unknown>>();
    if(!row)return Response.json({dispute:null});
    let evidence:Evidence[]=[];try{evidence=JSON.parse(String(row.evidence)) as Evidence[]}catch{}
    return Response.json({dispute:{...row,evidence:evidence.map(({id:assetId,name,mime,size})=>({id:assetId,name,mime,size,url:`/api/checkout/order/${encodeURIComponent(String(row.orderId))}/dispute/evidence/${encodeURIComponent(assetId)}`}))}},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const keys:string[]=[];
  try{
    guard(request);const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new HttpError(403,'Cross-site changes are not allowed.');
    if(Number(request.headers.get('content-length')??0)>101_000_000)throw new HttpError(413,'Evidence must total less than 100 MB.');
    const profile=await user();const {id}=await params;
    const order=await db().prepare(`SELECT o.id,o.buyer_id AS buyerId,o.seller_id AS sellerId,o.items,o.delivered_at AS deliveredAt,o.status,l.title FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.id=? AND o.kind='MARKET'`).bind(id).first<{id:string;buyerId:string;sellerId:string|null;items:string;deliveredAt:string|null;status:string;title:string|null}>();
    if(!order||order.buyerId!==profile.id||!order.sellerId)throw new HttpError(404,'Delivered order not found.');
    if(order.status!=='SHIPPED'||!order.deliveredAt)throw new HttpError(409,'You can report a problem after the carrier marks the order delivered.');
    if(Date.now()-new Date(`${order.deliveredAt.replace(' ','T')}Z`).getTime()>48*60*60*1000)throw new HttpError(409,'The 48-hour delivery review window has ended. Contact support if you still need help.');
    const form=await request.formData();const reason=String(form.get('reason')??'').trim();const requestedResolution=String(form.get('requestedResolution')??'REFUND');
    if(reason.length<10||reason.length>3000)throw new HttpError(400,'Describe the problem in 10 to 3,000 characters.');
    if(!['REFUND','RESHIP'].includes(requestedResolution))throw new HttpError(400,'Choose refund or reship.');
    const items=JSON.parse(order.items) as Array<{printingId:string;quantity:number;unitAmount?:number}>;
    const affectedItems=JSON.parse(String(form.get('affectedItems')??'[]')) as Array<{index:number;quantity:number}>;
    if(!Array.isArray(affectedItems)||!affectedItems.length||new Set(affectedItems.map(item=>item.index)).size!==affectedItems.length||affectedItems.some(item=>!Number.isInteger(item.index)||!Number.isInteger(item.quantity)||item.index<0||item.index>=items.length||item.quantity<1||item.quantity>items[item.index]!.quantity))throw new HttpError(400,'Select the affected card quantities.');
    const files=form.getAll('evidence').filter((file):file is File=>file instanceof File&&file.size>0);
    if(files.length>MAX_FILES||!files.length)throw new HttpError(400,'Attach at least one photo or video, up to four files.');
    if(files.some(file=>file.size>MAX_FILE))throw new HttpError(413,'Each evidence file must be under 25 MB.');
    const prepared=[] as Array<{file:File;bytes:Uint8Array;mime:string}>;
    for(const file of files){const bytes=new Uint8Array(await file.arrayBuffer());const mime=detect(bytes,file.type);if(!mime)throw new HttpError(400,'Use JPG, PNG, WebP, MP4, or WebM evidence.');prepared.push({file,bytes,mime});}
    if(prepared.filter(item=>item.mime.startsWith('video/')).length>1)throw new HttpError(400,'Attach one video at a time.');
    if(!prepared.some(item=>item.mime.startsWith('video/')))throw new HttpError(400,'Include an unboxing video with the report.');
    const storage=env.CARD_IMAGES;if(!storage)throw new HttpError(503,'Evidence uploads are temporarily unavailable.');
    const disputeId=crypto.randomUUID();const evidence:Evidence[]=[];
    for(const item of prepared){const assetId=crypto.randomUUID();const objectKey=`market-disputes/${disputeId}/${assetId}`;keys.push(objectKey);await storage.put(objectKey,item.bytes,{httpMetadata:{contentType:item.mime,cacheControl:'private, no-store'}});evidence.push({id:assetId,objectKey,name:item.file.name.slice(0,160),mime:item.mime,size:item.bytes.length});}
    const saved=await db().prepare(`INSERT INTO market_disputes(id,order_id,buyer_id,seller_id,reason,affected_items,requested_resolution,evidence)
      SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM checkout_orders WHERE id=? AND buyer_id=? AND status='SHIPPED' AND delivered_at IS NOT NULL AND delivered_at>=datetime('now','-48 hours'))`).bind(disputeId,id,profile.id,order.sellerId,reason,JSON.stringify(affectedItems),requestedResolution,JSON.stringify(evidence),id,profile.id).run();
    if(!saved.meta.changes)throw new HttpError(409,'This order changed while the report was being sent. Refresh and try again.');
    await sendMarketEmail(order.sellerId,'order-dispute-opened',order.title||'Market order',id);
    return Response.json({ok:true,id:disputeId,status:'OPEN'},{status:201,headers:{'Cache-Control':'private, no-store'}});
  }catch(error){if(keys.length)await Promise.all(keys.map(key=>env.CARD_IMAGES?.delete(key).catch(()=>undefined)));return errorResponse(error)}
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    guard(request);const profile=await user();const {id}=await params;const input=await request.json() as {sellerResponse?:unknown};
    const response=typeof input.sellerResponse==='string'?input.sellerResponse.trim():'';
    if(response.length<10||response.length>3000)throw new HttpError(400,'Write a response of 10 to 3,000 characters.');
    const changed=await db().prepare(`UPDATE market_disputes SET seller_response=?,status=CASE WHEN status='OPEN' THEN 'UNDER_REVIEW' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND seller_id=? AND status!='RESOLVED'`).bind(response,id,profile.id).run();
    if(!changed.meta.changes)throw new HttpError(404,'Open dispute not found.');
    const order=await db().prepare('SELECT o.buyer_id AS buyerId,l.title FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.id=?').bind(id).first<{buyerId:string;title:string|null}>();
    if(order)await sendMarketEmail(order.buyerId,'order-dispute-response',order.title||'Market order',id);
    return Response.json({ok:true});
  }catch(error){return errorResponse(error)}
}
