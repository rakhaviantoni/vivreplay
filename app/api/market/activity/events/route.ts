import {db,errorResponse,user} from '@/lib/server/store';

export async function GET(request:Request){
  try{
    const profile=await user();
    const rawSince=new URL(request.url).searchParams.get('since');
    const since=rawSince&&Number.isFinite(Date.parse(rawSince))?new Date(rawSince).toISOString().slice(0,19).replace('T',' '):new Date(Date.now()-20_000).toISOString().slice(0,19).replace('T',' ');
    const events=(await db().prepare(`SELECT 'offer-message:'||m.id AS id,m.offer_id AS offerId,m.actor_id AS actorId,p.display_name AS actorName,m.kind,m.body,m.created_at AS createdAt,o.amount,o.currency,l.title AS listingTitle,
        (SELECT COALESCE(SUM(CAST(json_extract(item.value,'$.quantity') AS INTEGER)),0) FROM json_each(o.items) item) AS cardCount,
        (SELECT COUNT(*) FROM listing_offer_attachments a WHERE a.message_id=m.id) AS attachmentCount
      FROM listing_offer_messages m
      JOIN listing_offers root ON COALESCE(root.thread_id,root.id)=m.thread_id
      JOIN listings l ON l.id=root.listing_id
      LEFT JOIN profiles p ON p.id=m.actor_id
      LEFT JOIN listing_offers o ON o.id=m.offer_id
      WHERE m.actor_id<>? AND m.created_at>=?
        AND (l.seller_id=? OR EXISTS(SELECT 1 FROM listing_offers participant WHERE COALESCE(participant.thread_id,participant.id)=m.thread_id AND participant.actor_id=?))
      GROUP BY m.id
      ORDER BY m.created_at DESC,m.rowid DESC LIMIT 30`).bind(profile.id,since,profile.id,profile.id).all<{id:string;offerId:string|null;actorId:string;actorName:string|null;kind:string;body:string|null;createdAt:string;amount:number|null;currency:string|null;listingTitle:string;cardCount:number;attachmentCount:number}>()).results;
    return Response.json({events:events.reverse()},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
