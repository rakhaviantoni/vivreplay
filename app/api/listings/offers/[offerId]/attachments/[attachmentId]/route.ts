import {env} from 'cloudflare:workers';
import {db,errorResponse,HttpError,user} from '@/lib/server/store';
import {offerContext} from '@/lib/server/market-offers';

export async function GET(_request:Request,{params}:{params:Promise<{offerId:string;attachmentId:string}>}){
  try{
    const actor=await user();const {offerId,attachmentId}=await params;const offer=await offerContext(offerId,actor.id);
    const attachment=await db().prepare(`SELECT a.object_key AS objectKey,a.mime,a.byte_size AS byteSize FROM listing_offer_attachments a JOIN listing_offer_messages m ON m.id=a.message_id WHERE a.id=? AND m.thread_id=?`).bind(attachmentId,offer.threadId).first<{objectKey:string;mime:string;byteSize:number}>();
    if(!attachment)throw new HttpError(404,'Photo not found.');const object=await env.CARD_IMAGES?.get(attachment.objectKey);if(!object)throw new HttpError(404,'Photo not found.');
    return new Response(object.body,{headers:{'Content-Type':attachment.mime,'Content-Length':String(attachment.byteSize),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }catch(error){return errorResponse(error)}
}
