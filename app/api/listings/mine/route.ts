import {user,db,errorResponse} from '@/lib/server/store';
import {marketCardThumbnails} from '@/lib/server/market-card-thumbnails';

type ListingRow={id:string;title:string;amount:number;currency:string;quantity:number;type:string;status:string;city:string;createdAt:string;expiresAt:string|null;printingId:string;items:string|null};
function parseItems(raw:string|null){try{const parsed=raw?JSON.parse(raw) as unknown:[];if(!Array.isArray(parsed))return [];return parsed.flatMap(value=>{if(!value||typeof value!=='object')return [];const item=value as {printingId?:unknown;quantity?:unknown};return typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&Number(item.quantity)>0?[{printingId:item.printingId,quantity:Number(item.quantity)}]:[]})}catch{return []}}

export async function GET(){
  try{
    const profile=await user();
    const listings=(await db().prepare(`SELECT id,title,amount,currency,quantity,type,status,city,created_at AS createdAt,expires_at AS expiresAt,printing_id AS printingId,items FROM listings WHERE seller_id=? ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PAUSED' THEN 1 WHEN 'CLOSED' THEN 2 ELSE 3 END,created_at DESC LIMIT 100`).bind(profile.id).all<ListingRow>()).results;
    const entries=listings.map(listing=>{
      let cards:Array<{printingId:string;quantity:number}>=[];
      cards=parseItems(listing.items);
      if(!cards.length)cards=[{printingId:listing.printingId,quantity:listing.quantity}];
      return {listing,cards};
    });
    const thumbnails=await marketCardThumbnails(entries.flatMap(entry=>entry.cards.map(card=>card.printingId)));
    return Response.json({listings:entries.map(({listing,cards})=>({...listing,cards:cards.map(card=>({...card,card:thumbnails.get(card.printingId)??null}))}))},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
