import {db,user} from '@/lib/server/store';

type OfferRow={id:string;threadId:string;parentOfferId:string|null;listingId:string;actorId:string;listingSellerId:string;type:string;items:string;amount:number;currency:string;status:string;createdAt:string;listingTitle:string;listingType:string;actorName:string|null;sellerName:string|null;counterparty:string|null};
type OfferItem={printingId:string;quantity:number;unitAmount?:number;card?:{name:string;code:string;language:string;variant:string;imageUrl:string|null}};

export async function GET(){
  try{
    const profile=await user();
    const offers=(await db().prepare(`SELECT o.id,COALESCE(o.thread_id,o.id) AS threadId,o.parent_offer_id AS parentOfferId,o.listing_id AS listingId,o.actor_id AS actorId,l.seller_id AS listingSellerId,o.type,o.items,o.amount,o.currency,o.status,o.created_at AS createdAt,l.title AS listingTitle,l.type AS listingType,a.display_name AS actorName,s.display_name AS sellerName,CASE WHEN o.actor_id=l.seller_id THEN (SELECT peer.display_name FROM listing_offers first_offer JOIN profiles peer ON peer.id=first_offer.actor_id WHERE COALESCE(first_offer.thread_id,first_offer.id)=COALESCE(o.thread_id,o.id) AND first_offer.actor_id<>l.seller_id ORDER BY first_offer.created_at,first_offer.rowid LIMIT 1) ELSE s.display_name END AS counterparty FROM listing_offers o JOIN listings l ON l.id=o.listing_id LEFT JOIN profiles a ON a.id=o.actor_id LEFT JOIN profiles s ON s.id=l.seller_id WHERE l.seller_id=? OR o.actor_id=? ORDER BY o.created_at DESC LIMIT 100`).bind(profile.id,profile.id).all<OfferRow>()).results;
    const parsed=offers.map(offer=>{let items:OfferItem[]=[];try{const data=JSON.parse(offer.items) as unknown;if(Array.isArray(data))items=data.filter(item=>item&&typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&item.quantity>0).map(item=>({printingId:item.printingId,quantity:item.quantity,unitAmount:item.unitAmount}))}catch{}return {offer,items}});
    const ids=[...new Set(parsed.flatMap(row=>row.items.map(item=>item.printingId)))];
    const cards=new Map<string,NonNullable<OfferItem['card']>>();
    for(let offset=0;offset<ids.length;offset+=80){
      const chunk=ids.slice(offset,offset+80);if(!chunk.length)continue;
      const rows=(await db().prepare(`SELECT p.id AS printingId,p.printing_code AS printingCode,p.language,p.variant,p.image_url AS imageUrl,i.code,i.name FROM card_printings p LEFT JOIN card_identities i ON i.id=p.identity_id WHERE p.id IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).all<{printingId:string;printingCode:string|null;language:string;variant:string|null;imageUrl:string|null;code:string|null;name:string|null}>()).results;
      for(const row of rows)cards.set(row.printingId,{name:row.name??row.code??row.printingCode??row.printingId,code:row.code??row.printingCode??row.printingId,language:row.language,variant:row.variant??'Standard',imageUrl:row.imageUrl});
    }
    return Response.json({offers:parsed.map(({offer,items})=>({id:offer.id,threadId:offer.threadId,parentOfferId:offer.parentOfferId,listingId:offer.listingId,listingTitle:offer.listingTitle,listingType:offer.listingType,direction:offer.actorId===profile.id?'sent':'received',counterparty:offer.counterparty,type:offer.type,status:offer.status,items:items.map(item=>({...item,card:cards.get(item.printingId)})),amount:offer.amount,currency:offer.currency,createdAt:offer.createdAt}))},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    if(error instanceof Error)console.error('market_offers_load_failed',error.message);
    return Response.json({error:'Your offers could not be loaded. Please try again.'},{status:500,headers:{'Cache-Control':'private, no-store'}});
  }
}
