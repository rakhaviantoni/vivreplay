import {env} from 'cloudflare:workers';
import {db,optionalUser,errorResponse,HttpError} from '@/lib/server/store';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const photo=await db().prepare('SELECT owner_id AS ownerId,object_key AS objectKey,mime FROM market_product_photos WHERE id=?').bind(id).first<{ownerId:string;objectKey:string;mime:string}>();
    if(!photo)throw new HttpError(404,'Photo not found.');
    const published=await db().prepare(`SELECT 1 FROM listings l,json_each(l.items) item,json_each(json_extract(item.value,'$.photoIds')) photo WHERE photo.value=? LIMIT 1`).bind(id).first();
    if(!published&&(await optionalUser())?.id!==photo.ownerId)throw new HttpError(404,'Photo not found.');
    const object=await env.CARD_IMAGES?.get(photo.objectKey);
    if(!object)throw new HttpError(404,'Photo not found.');
    return new Response(object.body,{headers:{'Content-Type':photo.mime,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
  }catch(error){return errorResponse(error);}
}
