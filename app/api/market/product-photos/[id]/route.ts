import {env} from 'cloudflare:workers';
import {db,optionalUser,errorResponse,HttpError} from '@/lib/server/store';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const photo=await db().prepare('SELECT owner_id AS ownerId,object_key AS objectKey,mime FROM market_product_photos WHERE id=?').bind(id).first<{ownerId:string;objectKey:string;mime:string}>();
    if(!photo)throw new HttpError(404,'Photo not found.');
    const published=await db().prepare(`SELECT 1 FROM listings l,json_each(l.items) item,json_each(json_extract(item.value,'$.photoIds')) photo WHERE photo.value=? LIMIT 1`).bind(id).first();
    const viewer=published?null:await optionalUser();
    const shared=viewer?await db().prepare(`SELECT 1 FROM listing_offers offer
      JOIN listings listing ON listing.id=offer.listing_id,json_each(offer.items) item,json_each(json_extract(item.value,'$.photoIds')) photo
      WHERE photo.value=? AND (listing.seller_id=? OR EXISTS(SELECT 1 FROM listing_offers participant
        WHERE COALESCE(participant.thread_id,participant.id)=COALESCE(offer.thread_id,offer.id) AND participant.actor_id=?)) LIMIT 1`).bind(id,viewer.id,viewer.id).first():null;
    if(!published&&viewer?.id!==photo.ownerId&&!shared)throw new HttpError(404,'Photo not found.');
    const object=await env.CARD_IMAGES?.get(photo.objectKey);
    if(!object)throw new HttpError(404,'Photo not found.');
    return new Response(object.body,{headers:{'Content-Type':photo.mime,'Cache-Control':published?'public, max-age=3600':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){return errorResponse(error);}
}
