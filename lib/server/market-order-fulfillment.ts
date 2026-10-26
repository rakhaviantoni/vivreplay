import {db,HttpError} from '@/lib/server/store';
import {sendMarketEmailOnce} from '@/lib/server/market-notifications';
import {MARKET_REVIEW_WINDOW_MS} from '@/lib/market/review-window';
import {sellerVaultDebits} from '@/lib/market/order-transfer';

type Order={id:string;kind:string;buyerId:string;sellerId:string|null;items:string;details:string|null;currency:string;status:string;deliveredAt:string|null;title:string|null};
type Item={printingId:string;quantity:number;unitAmount?:number;condition?:string;instanceId?:string;listingId?:string;sealedProductId?:string};

export async function completeDeliveredMarketOrder(orderId:string,buyerId:string,automatic=false){
  const database=db();
  const order=await database.prepare(`SELECT o.id,o.kind,o.buyer_id AS buyerId,o.seller_id AS sellerId,o.items,o.details,o.currency,o.status,o.delivered_at AS deliveredAt,l.title
    FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.id=?`).bind(orderId).first<Order>();
  if(!order||order.buyerId!==buyerId)throw new HttpError(404,'Order was not found.');
  if(order.kind!=='MARKET')throw new HttpError(400,'Only Market orders can be added to your Vault.');
  if(order.status==='RECEIVED')return{completed:true,status:'RECEIVED'};
  if(order.status!=='SHIPPED'){
    if(automatic)return{completed:false,status:order.status};
    throw new HttpError(409,'The seller must arrange shipping before delivery can be confirmed.');
  }
  let shippingMethod='biteship';try{shippingMethod=JSON.parse(order.details||'{}').shippingMethod==='manual'?'manual':'biteship'}catch{}
  if(automatic&&(!order.deliveredAt||shippingMethod==='manual'))return{completed:false,status:order.status};
  if(!order.deliveredAt&&shippingMethod!=='manual'){
    if(automatic)return{completed:false,status:order.status};
    throw new HttpError(409,'The carrier has not marked this order as delivered yet.');
  }
  if(automatic&&order.deliveredAt){
    const delivered=Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(order.deliveredAt)?order.deliveredAt:`${order.deliveredAt.replace(' ','T')}Z`);
    if(!Number.isFinite(delivered)||Date.now()-delivered<MARKET_REVIEW_WINDOW_MS)return{completed:false,status:order.status};
  }

  let items:Item[];
  try{items=JSON.parse(order.items) as Item[]}catch{throw new HttpError(500,'The order cards could not be loaded.');}
  if(!Array.isArray(items)||!items.length)throw new HttpError(400,'This order has no cards to add.');
  for(const item of items)if(!item.printingId||!Number.isInteger(item.quantity)||item.quantity<1)throw new HttpError(500,'The order contains invalid card details.');

  const dueClause=automatic?" AND delivered_at<=datetime('now','-48 hours')":'';
  const claim=await database.prepare(`UPDATE checkout_orders SET status='RECEIVING' WHERE id=? AND buyer_id=? AND status='SHIPPED' AND delivered_at IS NOT NULL${dueClause}
    AND NOT EXISTS(SELECT 1 FROM market_disputes WHERE order_id=? AND status!='RESOLVED')`).bind(orderId,buyerId,orderId).run();
  if(!claim.meta.changes){
    if(automatic)return{completed:false,status:'SHIPPED'};
    throw new HttpError(409,'This order has an open report or was updated elsewhere. Refresh the order before continuing.');
  }

  const purchases=new Map<string,{printingId:string;condition:string;quantity:number;amount:number}>();
  for(const item of items){
    if(item.sealedProductId)continue;
    const condition=item.condition||'NM';const key=`${item.printingId}:${condition}`;
    const purchase=purchases.get(key)??{printingId:item.printingId,condition,quantity:0,amount:0};
    purchase.quantity+=item.quantity;purchase.amount+=Math.max(0,Math.round(item.unitAmount??0))*item.quantity;purchases.set(key,purchase);
  }
  const sellerDebits=sellerVaultDebits(items);
  const statements=[];
  try{
    if(sellerDebits.size&&order.sellerId){
      for(const [instanceId,quantity] of sellerDebits){
        const sellerItem=await database.prepare(`SELECT quantity FROM collectible_instances WHERE id=? AND owner_id=? AND deleted_at IS NULL`).bind(instanceId,order.sellerId).first<{quantity:number}>();
        if(!sellerItem||sellerItem.quantity<quantity)throw new HttpError(409,'The seller’s Vault quantity no longer matches this order. Contact support before completing it.');
        statements.push(database.prepare(`UPDATE collectible_instances SET deleted_at=CASE WHEN quantity<=? THEN CURRENT_TIMESTAMP ELSE deleted_at END,acquisition_amount=CASE WHEN quantity<=? THEN acquisition_amount ELSE MAX(0,acquisition_amount-ROUND(acquisition_amount*?*1.0/quantity)) END,quantity=CASE WHEN quantity<=? THEN quantity ELSE quantity-? END WHERE id=? AND owner_id=? AND deleted_at IS NULL AND quantity>=?`)
          .bind(quantity,quantity,quantity,quantity,quantity,instanceId,order.sellerId,quantity));
      }
    }
    for(const purchase of purchases.values()){
      const existing=await database.prepare(`SELECT id,quantity,acquisition_amount AS acquisitionAmount FROM collectible_instances c
        WHERE owner_id=? AND printing_id=? AND type='RAW' AND condition=? AND currency=? AND deleted_at IS NULL AND visibility='private'
          AND NOT EXISTS(SELECT 1 FROM listings l WHERE l.instance_id=c.id AND l.status='ACTIVE') LIMIT 1`)
        .bind(order.buyerId,purchase.printingId,purchase.condition,order.currency).first<{id:string;quantity:number;acquisitionAmount:number}>();
      if(existing){
        statements.push(database.prepare('UPDATE collectible_instances SET quantity=?,acquisition_amount=? WHERE id=? AND owner_id=?')
          .bind(existing.quantity+purchase.quantity,existing.acquisitionAmount+purchase.amount,existing.id,order.buyerId));
      }else{
        statements.push(database.prepare("INSERT INTO collectible_instances (id,owner_id,printing_id,type,quantity,condition,visibility,acquisition_amount,currency,acquired_at,notes) VALUES (?,?,?,'RAW',?,?,'private',?,?,CURRENT_TIMESTAMP,NULL)")
          .bind(crypto.randomUUID(),order.buyerId,purchase.printingId,purchase.quantity,purchase.condition,purchase.amount,order.currency));
      }
    }
    statements.push(database.prepare("UPDATE checkout_orders SET status='RECEIVED',fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND buyer_id=? AND status='RECEIVING'").bind(orderId,buyerId));
    await database.batch(statements);
  }catch(error){
    await database.prepare("UPDATE checkout_orders SET status='SHIPPED' WHERE id=? AND buyer_id=? AND status='RECEIVING'").bind(orderId,buyerId).run().catch(()=>undefined);
    throw error;
  }

  if(automatic){
    await Promise.all([
      sendMarketEmailOnce(order.buyerId,'order-auto-completed',order.title||'Market order',orderId,`market-auto-completed:${orderId}:buyer`),
      ...(order.sellerId?[sendMarketEmailOnce(order.sellerId,'order-auto-completed',order.title||'Market order',orderId,`market-auto-completed:${orderId}:seller`)]:[]),
    ]);
  }else if(order.sellerId){
    await sendMarketEmailOnce(order.sellerId,'order-received',order.title||'Market order',orderId,`market-received:${orderId}`);
  }
  return{completed:true,status:'RECEIVED'};
}
