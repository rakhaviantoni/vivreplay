import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {offerContext} from '@/lib/server/market-offers';
import {env} from 'cloudflare:workers';

const MAX_PHOTO_SIZE=5_000_000;
const MAX_FILES=4;

function detectImage(bytes:Uint8Array){
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return 'image/png';
  if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
  return null;
}

export async function POST(request:Request,{params}:{params:Promise<{offerId:string}>}){
  const objectKeys:string[]=[];
  let messageId:string|null=null;
  try{
    const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new HttpError(403,'Cross-site changes are not allowed.');
    if(Number(request.headers.get('content-length')??0)>21_000_000)throw new HttpError(413,'Photos must total less than 20 MB.');
    const actor=await user();const {offerId}=await params;const context=await offerContext(offerId,actor.id);
    const type=request.headers.get('content-type')??'';
    let kind='MESSAGE',body='',files:File[]=[];
    if(type.includes('multipart/form-data')){
      const form=await request.formData();body=String(form.get('body')??'').trim();kind=body?'MESSAGE':'PHOTO';
      files=form.getAll('photos').filter((file):file is File=>file instanceof File&&file.size>0);
      if(!files.length)throw new HttpError(400,'Choose a photo to share.');
      if(files.length>MAX_FILES)throw new HttpError(400,'Share up to four photos in one message.');
      if(files.some(file=>file.size>MAX_PHOTO_SIZE))throw new HttpError(413,'Each photo must be under 5 MB.');
    }else{
      const value=await request.json() as {kind?:unknown;body?:unknown};
      kind=value.kind==='PHOTO_REQUEST'?'PHOTO_REQUEST':'MESSAGE';body=typeof value.body==='string'?value.body.trim():'';
    }
    if(kind==='MESSAGE'&&!body)throw new HttpError(400,'Write a message before sending.');
    if(body.length>2000)throw new HttpError(400,'Messages must be 2,000 characters or fewer.');
    if(kind==='PHOTO_REQUEST'||files.length){
      const expired=context.expiresAt&&new Date(`${context.expiresAt.replace(' ','T')}Z`).getTime()<=Date.now();
      const pending=await db().prepare("SELECT 1 AS ok FROM listing_offers WHERE COALESCE(thread_id,id)=? AND status='PENDING' LIMIT 1").bind(context.threadId).first();
      if(context.listingStatus!=='ACTIVE'||expired||!pending)throw new HttpError(409,'Photo requests and sharing are available while the listing offer is open.');
    }
    if(kind==='PHOTO_REQUEST'){
      if(actor.id!==context.buyerId)throw new HttpError(403,'Only the buyer can request card photos.');
      const alreadyRequested=await db().prepare("SELECT 1 AS ok FROM listing_offer_messages WHERE thread_id=? AND actor_id=? AND kind='PHOTO_REQUEST' LIMIT 1").bind(context.threadId,context.buyerId).first();
      if(alreadyRequested)throw new HttpError(409,'Card photos have already been requested.');
    }
    if(files.length){
      if(actor.id!==context.supplierId)throw new HttpError(403,'Only the card supplier can share card photos.');
      const requested=await db().prepare("SELECT 1 AS ok FROM listing_offer_messages WHERE thread_id=? AND actor_id=? AND kind='PHOTO_REQUEST' LIMIT 1").bind(context.threadId,context.buyerId).first();
      if(!requested)throw new HttpError(409,'The buyer must request card photos before you share them.');
      const alreadyShared=await db().prepare("SELECT 1 AS ok FROM listing_offer_messages m JOIN listing_offer_attachments a ON a.message_id=m.id WHERE m.thread_id=? AND m.actor_id=? LIMIT 1").bind(context.threadId,context.supplierId).first();
      if(alreadyShared)throw new HttpError(409,'Card photos have already been shared in this conversation.');
    }
    const recent=await db().prepare("SELECT COUNT(*) AS count FROM listing_offer_messages WHERE actor_id=? AND created_at>=datetime('now','-1 hour')").bind(actor.id).first<{count:number}>();
    if((recent?.count??0)>=40)throw new HttpError(429,'You have sent a lot of messages. Please try again later.');
    const prepared=[] as Array<{file:File;bytes:Uint8Array;mime:string}>;
    for(const file of files){const bytes=new Uint8Array(await file.arrayBuffer());const mime=detectImage(bytes);if(!mime)throw new HttpError(400,'Use JPEG, PNG, or WebP photos.');prepared.push({file,bytes,mime});}
    const storage=prepared.length?env.CARD_IMAGES:undefined;
    if(prepared.length&&!storage)throw new HttpError(503,'Photo sharing is temporarily unavailable.');
    messageId=crypto.randomUUID();
    await db().prepare('INSERT INTO listing_offer_messages (id,thread_id,offer_id,actor_id,kind,body) VALUES (?,?,?,?,?,?)').bind(messageId,context.threadId,offerId,actor.id,kind,body||null).run();
    if(storage){
      for(const {bytes,mime} of prepared){
        const id=crypto.randomUUID();const key=`market-offers/${context.threadId}/${id}`;objectKeys.push(key);
        await storage.put(key,bytes,{httpMetadata:{contentType:mime,cacheControl:'private, no-store'}});
        await db().prepare('INSERT INTO listing_offer_attachments (id,message_id,object_key,mime,byte_size) VALUES (?,?,?,?,?)').bind(id,messageId,key,mime,bytes.byteLength).run();
      }
    }
    return Response.json({id:messageId},{status:201,headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    if(objectKeys.length)await Promise.all(objectKeys.map(key=>env.CARD_IMAGES?.delete(key).catch(()=>undefined)));
    if(messageId)await db().prepare('DELETE FROM listing_offer_messages WHERE id=?').bind(messageId).run().catch(()=>undefined);
    return errorResponse(error);
  }
}
