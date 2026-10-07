import {db,errorResponse,user} from '@/lib/server/store';
import {offerContext,parseOfferItems} from '@/lib/server/market-offers';
import {marketCardThumbnails} from '@/lib/server/market-card-thumbnails';
import {sendMarketEmail} from '@/lib/server/market-notifications';

export async function GET(_request:Request,{params}:{params:Promise<{offerId:string}>}){
  try{
    const profile=await user();const {offerId}=await params;const current=await offerContext(offerId,profile.id);
    await db().prepare("UPDATE listing_offers SET status='EXPIRED' WHERE COALESCE(thread_id,id)=? AND status='PENDING' AND (expires_at<=CURRENT_TIMESTAMP OR listing_id IN (SELECT id FROM listings WHERE status!='ACTIVE' OR (expires_at IS NOT NULL AND expires_at<=CURRENT_TIMESTAMP)))").bind(current.threadId).run();
    const rounds=(await db().prepare(`SELECT o.id,o.parent_offer_id AS parentOfferId,o.actor_id AS actorId,o.type,o.items,o.amount,o.currency,o.status,o.created_at AS createdAt,o.expires_at AS expiresAt,p.display_name AS actorName FROM listing_offers o LEFT JOIN profiles p ON p.id=o.actor_id WHERE COALESCE(o.thread_id,o.id)=? ORDER BY o.created_at,o.rowid`).bind(current.threadId).all<{id:string;parentOfferId:string|null;actorId:string;type:string;items:string;amount:number;currency:string;status:string;createdAt:string;expiresAt:string|null;actorName:string|null}>()).results;
    const messages=(await db().prepare(`SELECT m.id,m.offer_id AS offerId,m.actor_id AS actorId,m.kind,m.body,m.created_at AS createdAt,p.display_name AS actorName FROM listing_offer_messages m LEFT JOIN profiles p ON p.id=m.actor_id WHERE m.thread_id=? ORDER BY m.created_at,m.rowid`).bind(current.threadId).all<{id:string;offerId:string|null;actorId:string;kind:string;body:string|null;createdAt:string;actorName:string|null}>()).results;
    const messageIds=messages.map(message=>message.id);const attachments=new Map<string,Array<{id:string;mime:string;byteSize:number}>>();
    for(let offset=0;offset<messageIds.length;offset+=80){const ids=messageIds.slice(offset,offset+80);if(!ids.length)continue;const rows=(await db().prepare(`SELECT id,message_id AS messageId,mime,byte_size AS byteSize FROM listing_offer_attachments WHERE message_id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all<{id:string;messageId:string;mime:string;byteSize:number}>()).results;for(const row of rows){const list=attachments.get(row.messageId)??[];list.push({id:row.id,mime:row.mime,byteSize:row.byteSize});attachments.set(row.messageId,list);}}
    const parsedRounds=rounds.map(round=>({...round,items:parseOfferItems(round.items)}));
    const latest=parsedRounds.at(-1);
    let revisedItems:ReturnType<typeof parseOfferItems>=[];
    let requiresRevision=false;
    if(latest?.status==='PENDING'&&current.listingType==='WTS'){
      const inventory=new Map<string,number>();
      try{
        const bundle=JSON.parse(current.listingItems??'[]') as Array<{printingId?:unknown;quantity?:unknown}>;
        for(const item of bundle)if(typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&Number(item.quantity)>0)inventory.set(item.printingId,(inventory.get(item.printingId)??0)+Number(item.quantity));
        if(!inventory.size)inventory.set(current.printingId,current.quantity);
      }catch{inventory.set(current.printingId,current.quantity)}
      const reservations=(await db().prepare("SELECT o.items FROM checkout_orders o WHERE o.listing_id=? AND o.kind='MARKET' AND (o.status='PROCESSING' OR (o.status='PENDING_PAYMENT' AND o.expires_at>CURRENT_TIMESTAMP))").bind(current.listingId).all<{items:string}>()).results;
      for(const reservation of reservations)try{for(const item of JSON.parse(reservation.items) as Array<{printingId?:unknown;quantity?:unknown}>){if(typeof item.printingId==='string'&&Number.isInteger(item.quantity))inventory.set(item.printingId,Math.max(0,(inventory.get(item.printingId)??0)-Number(item.quantity)))}}catch{}
      const remaining=new Map(inventory);
      revisedItems=latest.items.flatMap(item=>{const take=Math.min(item.quantity,remaining.get(item.printingId)??0);remaining.set(item.printingId,Math.max(0,(remaining.get(item.printingId)??0)-take));if(take<item.quantity)requiresRevision=true;return take? [{...item,quantity:take}]:[]});
      if(requiresRevision&&!revisedItems.length){
        const closed=await db().prepare("UPDATE listing_offers SET status='UNAVAILABLE' WHERE id=? AND status='PENDING'").bind(latest.id).run();
        if(closed.meta.changes)await Promise.all([current.buyerId,current.supplierId].map(person=>sendMarketEmail(person,'offer-unavailable',current.listingTitle,current.threadId)));
        latest.status='UNAVAILABLE';requiresRevision=false;
      }
    }
    const availableCards=await marketCardThumbnails(revisedItems.map(item=>item.printingId));
    revisedItems=revisedItems.map(item=>({...item,card:availableCards.get(item.printingId)}));
    const cards=await marketCardThumbnails(parsedRounds.flatMap(round=>round.items.map(item=>item.printingId)));
    const allRounds=parsedRounds.map(round=>({...round,items:round.items.map(item=>({...item,card:cards.get(item.printingId)}))}));
    return Response.json({threadId:current.threadId,listingId:current.listingId,currentOfferId:parsedRounds.filter(round=>round.status==='PENDING').at(-1)?.id??current.id,viewerId:profile.id,sellerId:current.sellerId,buyerId:current.buyerId,supplierId:current.supplierId,listingType:current.listingType,negotiable:current.negotiable!==0,listingStatus:current.listingStatus,listingExpiresAt:current.listingExpiresAt,requiresRevision,revisedItems,rounds:allRounds,messages:messages.map(message=>({...message,attachments:(attachments.get(message.id)??[]).map(file=>({...file,url:`/api/listings/offers/${encodeURIComponent(offerId)}/attachments/${encodeURIComponent(file.id)}`}))}))},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
