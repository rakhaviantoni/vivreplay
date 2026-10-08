import {env} from 'cloudflare:workers';
import {db,errorResponse,HttpError,user} from '@/lib/server/store';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

export async function GET(_request:Request,{params}:{params:Promise<{id:string;assetId:string}>}){
  try{
    const profile=await user();const {id,assetId}=await params;
    const dispute=await db().prepare(`SELECT evidence FROM market_disputes WHERE order_id=? AND ((buyer_id=? OR seller_id=?) OR ?)`).bind(id,profile.id,profile.id,await isCurrentUserAdmin()).first<{evidence:string}>();
    if(!dispute)throw new HttpError(404,'Evidence not found.');
    const evidence=JSON.parse(dispute.evidence) as Array<{id:string;objectKey:string;mime:string;size:number}>;
    const asset=evidence.find(item=>item.id===assetId);if(!asset)throw new HttpError(404,'Evidence not found.');
    const object=await env.CARD_IMAGES?.get(asset.objectKey);if(!object)throw new HttpError(404,'Evidence file not found.');
    return new Response(object.body,{headers:{'Content-Type':asset.mime,'Content-Length':String(asset.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }catch(error){return errorResponse(error)}
}
