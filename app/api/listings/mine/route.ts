import {user,db,errorResponse} from '@/lib/server/store';
import {marketCardThumbnails} from '@/lib/server/market-card-thumbnails';

type ListingRow={id:string;title:string;amount:number;currency:string;quantity:number;type:string;status:string;city:string;createdAt:string;expiresAt:string|null;printingId:string;items:string|null;negotiable:number};
function parseItems(raw:string|null){try{const parsed=raw?JSON.parse(raw) as unknown:[];if(!Array.isArray(parsed))return [];return parsed.flatMap(value=>{if(!value||typeof value!=='object')return [];const item=value as {printingId?:unknown;quantity?:unknown;unitAmount?:unknown};return typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&Number(item.quantity)>0?[{printingId:item.printingId,quantity:Number(item.quantity),unitAmount:Number(item.unitAmount)||0}]:[]})}catch{return []}}

export async function GET(){
  try{
    const profile=await user();
    const listings=(await db().prepare(`WITH sold_totals AS (SELECT o.seller_id AS sellerId,COALESCE(json_extract(i.value,'$.listingId'),o.listing_id) AS listingId,SUM(CAST(json_extract(i.value,'$.quantity') AS INTEGER)*CAST(json_extract(i.value,'$.unitAmount') AS INTEGER)) AS soldAmount FROM checkout_orders o,json_each(o.items) i WHERE o.seller_id=? AND o.kind='MARKET' AND o.status IN ('PAID','SHIPPED','RECEIVED','COMPLETED','FULFILLED','REFUNDED') GROUP BY o.seller_id,COALESCE(json_extract(i.value,'$.listingId'),o.listing_id)) SELECT l.id,l.title,CASE WHEN l.status='SOLD' THEN COALESCE(st.soldAmount,l.amount) ELSE l.amount END AS amount,l.currency,l.quantity,l.type,l.status,COALESCE(o.city,l.city) AS city,l.created_at AS createdAt,l.expires_at AS expiresAt,l.printing_id AS printingId,l.items,l.negotiable FROM listings l LEFT JOIN seller_shipping_origins o ON o.owner_id=l.seller_id LEFT JOIN sold_totals st ON st.sellerId=l.seller_id AND st.listingId=l.id WHERE l.seller_id=? ORDER BY CASE l.status WHEN 'ACTIVE' THEN 0 WHEN 'PAUSED' THEN 1 WHEN 'CLOSED' THEN 2 ELSE 3 END,l.created_at DESC LIMIT 100`).bind(profile.id,profile.id).all<ListingRow>()).results;
    const entries=listings.map(listing=>{
      let cards:Array<{printingId:string;quantity:number;unitAmount?:number}>=[];
      cards=parseItems(listing.items);
      if(!cards.length)cards=[{printingId:listing.printingId,quantity:listing.quantity,unitAmount:Math.round(listing.amount/listing.quantity)}];
      return {listing,cards};
    });
    const thumbnails=await marketCardThumbnails(entries.flatMap(entry=>entry.cards.map(card=>card.printingId)));
    return Response.json({listings:entries.map(({listing,cards})=>({...listing,negotiable:Boolean(listing.negotiable),cards:cards.map(card=>({...card,card:thumbnails.get(card.printingId)??null}))}))},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
