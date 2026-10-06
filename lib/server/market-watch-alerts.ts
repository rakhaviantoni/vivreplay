import {db} from '@/lib/server/store';
import {sendMarketEmail} from '@/lib/server/market-notifications';
export async function notifyListingWatchers(listingId:string,priceDrop=false){
 try{const d=db();const l=await d.prepare("SELECT seller_id AS sellerId,title,amount,currency,printing_id AS printingId,condition,quantity,items FROM listings WHERE id=? AND status='ACTIVE' AND type='WTS' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)").bind(listingId).first<{sellerId:string;title:string;amount:number;currency:string;printingId:string;condition:string;quantity:number;items:string|null}>();if(!l||l.currency!=='IDR')return;
 let items:Array<{printingId:string;unitAmount:number;condition:string}>=[];try{items=JSON.parse(l.items||'[]')}catch{};if(!items.length)items=[{printingId:l.printingId,unitAmount:Math.round(l.amount/l.quantity),condition:l.condition}];
 const recipients=new Map<string,'wishlist-match'|'price-drop'>();
 for(const item of items){if(!item.printingId||!Number.isFinite(item.unitAmount))continue;const rows=(await d.prepare('SELECT owner_id AS ownerId FROM wishlists WHERE printing_id=? AND alerts=1 AND owner_id!=? AND (target_price IS NULL OR target_price>=?) AND (target_condition IS NULL OR target_condition=?) LIMIT 100').bind(item.printingId,l.sellerId,item.unitAmount,item.condition||l.condition).all<{ownerId:string}>()).results;for(const r of rows)recipients.set(r.ownerId,'wishlist-match')}
 if(priceDrop){const rows=(await d.prepare('SELECT owner_id AS ownerId FROM market_saved_listings WHERE listing_id=? AND alerts=1 AND saved_amount>? AND owner_id!=? LIMIT 100').bind(listingId,l.amount,l.sellerId).all<{ownerId:string}>()).results;for(const r of rows)recipients.set(r.ownerId,'price-drop')}
 await Promise.allSettled([...recipients].map(async([owner,event])=>{const reserved=await d.prepare('INSERT OR IGNORE INTO market_watch_notifications(owner_id,listing_id,event,amount) VALUES (?,?,?,?)').bind(owner,listingId,event,l.amount).run();if(reserved.meta.changes)await sendMarketEmail(owner,event,l.title,listingId)}));
 }catch(e){console.error('market_watch_alerts_failed',e instanceof Error?e.message:'Unknown error')}
}
