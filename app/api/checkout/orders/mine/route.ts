import {db,errorResponse,user} from '@/lib/server/store';
import {marketCardThumbnails} from '@/lib/server/market-card-thumbnails';

type OrderRow={id:string;kind:string;status:string;amount:number;currency:string;createdAt:string;role:'buyer'|'seller';listingTitle:string|null;printingId:string|null;items:string|null};
function parseItems(raw:string|null){try{const parsed=raw?JSON.parse(raw) as unknown:[];if(!Array.isArray(parsed))return [];return parsed.flatMap(value=>{if(!value||typeof value!=='object')return [];const item=value as {printingId?:unknown;quantity?:unknown};return typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&Number(item.quantity)>0?[{printingId:item.printingId,quantity:Number(item.quantity)}]:[]})}catch{return []}}

export async function GET(){
  try{
    const profile=await user();
    const orders=(await db().prepare(`SELECT o.id,o.kind,o.status,o.amount,o.currency,o.created_at AS createdAt,
      CASE WHEN o.buyer_id=? THEN 'buyer' ELSE 'seller' END AS role,l.title AS listingTitle,l.printing_id AS printingId,l.items
      FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id
      WHERE o.buyer_id=? OR o.seller_id=? ORDER BY o.created_at DESC LIMIT 100`)
      .bind(profile.id,profile.id,profile.id).all<OrderRow>()).results;
    const entries=orders.map(order=>{
      let cards:Array<{printingId:string;quantity:number}>=[];
      cards=parseItems(order.items);
      if(!cards.length&&order.printingId)cards=[{printingId:order.printingId,quantity:1}];
      return {order,cards};
    });
    const thumbnails=await marketCardThumbnails(entries.flatMap(entry=>entry.cards.map(card=>card.printingId)));
    return Response.json({orders:entries.map(({order,cards})=>({...order,cards:cards.map(card=>({...card,card:thumbnails.get(card.printingId)??null}))}))},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
