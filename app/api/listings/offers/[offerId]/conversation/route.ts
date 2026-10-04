import {db,errorResponse,user} from '@/lib/server/store';
import {offerContext} from '@/lib/server/market-offers';

export async function GET(_request:Request,{params}:{params:Promise<{offerId:string}>}){
  try{
    const profile=await user();const {offerId}=await params;const current=await offerContext(offerId,profile.id);
    const rounds=(await db().prepare(`SELECT o.id,o.parent_offer_id AS parentOfferId,o.actor_id AS actorId,o.type,o.items,o.amount,o.currency,o.status,o.created_at AS createdAt,p.display_name AS actorName FROM listing_offers o LEFT JOIN profiles p ON p.id=o.actor_id WHERE COALESCE(o.thread_id,o.id)=? ORDER BY o.created_at,o.rowid`).bind(current.threadId).all<{id:string;parentOfferId:string|null;actorId:string;type:string;items:string;amount:number;currency:string;status:string;createdAt:string;actorName:string|null}>()).results;
    const messages=(await db().prepare(`SELECT m.id,m.offer_id AS offerId,m.actor_id AS actorId,m.kind,m.body,m.created_at AS createdAt,p.display_name AS actorName FROM listing_offer_messages m LEFT JOIN profiles p ON p.id=m.actor_id WHERE m.thread_id=? ORDER BY m.created_at,m.rowid`).bind(current.threadId).all<{id:string;offerId:string|null;actorId:string;kind:string;body:string|null;createdAt:string;actorName:string|null}>()).results;
    const messageIds=messages.map(message=>message.id);const attachments=new Map<string,Array<{id:string;mime:string;byteSize:number}>>();
    for(let offset=0;offset<messageIds.length;offset+=80){const ids=messageIds.slice(offset,offset+80);if(!ids.length)continue;const rows=(await db().prepare(`SELECT id,message_id AS messageId,mime,byte_size AS byteSize FROM listing_offer_attachments WHERE message_id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all<{id:string;messageId:string;mime:string;byteSize:number}>()).results;for(const row of rows){const list=attachments.get(row.messageId)??[];list.push({id:row.id,mime:row.mime,byteSize:row.byteSize});attachments.set(row.messageId,list);}}
    const allRounds=rounds.map(round=>({...round,items:parseItems(round.items)}));
    return Response.json({threadId:current.threadId,listingId:current.listingId,currentOfferId:rounds.filter(round=>round.status==='PENDING').at(-1)?.id??current.id,viewerId:profile.id,sellerId:current.sellerId,buyerId:current.buyerId,supplierId:current.supplierId,listingType:current.listingType,listingStatus:current.listingStatus,listingExpiresAt:current.expiresAt,rounds:allRounds,messages:messages.map(message=>({...message,attachments:(attachments.get(message.id)??[]).map(file=>({...file,url:`/api/listings/offers/${encodeURIComponent(offerId)}/attachments/${encodeURIComponent(file.id)}`}))}))},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}

function parseItems(raw:string){try{const value=JSON.parse(raw) as unknown;return Array.isArray(value)?value:[]}catch{return []}}
