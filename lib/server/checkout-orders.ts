import {db,HttpError} from '@/lib/server/store';

type FulfillableOrder={id:string;kind:string;buyerId:string;sellerId:string|null;listingId:string|null;items:string;details:string;subtotal:number;paymentId:string|null};

export async function fulfillCheckoutOrder(database:ReturnType<typeof db>,order:FulfillableOrder){
  const claim=crypto.randomUUID();
  if(order.kind==='PRO'){
    let durationDays=0;
    try{durationDays=Number((JSON.parse(order.details) as {durationDays?:number}).durationDays)||0}catch{}
    if(durationDays<1)throw new HttpError(500,'The Market Pro plan period is missing from this order.');
    const results=await database.batch([
      database.prepare("UPDATE checkout_orders SET status='PROCESSING',details=json_set(details,'$.fulfillmentClaim',?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id=?").bind(claim,order.id,order.paymentId),
      database.prepare(`UPDATE profiles SET tier='pro',pro_expires_at=datetime(max(COALESCE(pro_expires_at,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP), '+' || ? || ' days') WHERE id=(SELECT buyer_id FROM checkout_orders WHERE id=? AND status='PROCESSING' AND json_extract(details,'$.fulfillmentClaim')=?)`).bind(durationDays,order.id,claim),
      database.prepare("UPDATE checkout_orders SET status='PAID',details=json_remove(details,'$.fulfillmentClaim'),paid_at=COALESCE(paid_at,CURRENT_TIMESTAMP),fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PROCESSING' AND json_extract(details,'$.fulfillmentClaim')=?").bind(order.id,claim),
    ]);
    return Boolean(results[0]?.meta.changes);
  }

  let selected:Array<{instanceId?:string;printingId:string;quantity:number;unitAmount?:number;condition?:string;listingId?:string}>;
  try{selected=JSON.parse(order.items) as typeof selected}catch{throw new HttpError(500,'The selected cards could not be loaded.');}
  const statements=[
    database.prepare("UPDATE checkout_orders SET status='PROCESSING',details=json_set(details,'$.fulfillmentClaim',?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id=?").bind(claim,order.id,order.paymentId),
  ];
  const listingIds=[...new Set(selected.map(item=>item.listingId||order.listingId).filter((id):id is string=>Boolean(id)))];
  if(!listingIds.length)throw new HttpError(500,'The listing for this order could not be found.');
  for(const listingId of listingIds){
    const belongs=`(json_extract(sold.value,'$.listingId')=? OR (json_extract(sold.value,'$.listingId') IS NULL AND o.listing_id=?))`;
    const matches=`((json_extract(sold.value,'$.instanceId') IS NOT NULL AND json_extract(sold.value,'$.instanceId')=json_extract(entry.value,'$.instanceId')) OR (json_extract(sold.value,'$.instanceId') IS NULL AND json_extract(sold.value,'$.printingId')=json_extract(entry.value,'$.printingId')))`;
    const quantitySql=`(SELECT COALESCE(SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)),0) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=? AND ${belongs})`;
    const amountSql=`(SELECT COALESCE(SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)*CAST(json_extract(sold.value,'$.unitAmount') AS INTEGER)),0) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=? AND ${belongs})`;
    statements.push(database.prepare(`UPDATE listings SET quantity=MAX(1,quantity-${quantitySql}),amount=MAX(0,amount-${amountSql}),status=CASE WHEN quantity-${quantitySql}<=0 THEN 'SOLD' ELSE status END,items=CASE WHEN items IS NULL THEN NULL ELSE (SELECT COALESCE(json_group_array(json_set(entry.value,'$.quantity',CAST(json_extract(entry.value,'$.quantity') AS INTEGER)-COALESCE((SELECT SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=? AND (json_extract(sold.value,'$.listingId')=? OR (json_extract(sold.value,'$.listingId') IS NULL AND o.listing_id=?)) AND ${matches}),0))), '[]') FROM json_each(listings.items) entry WHERE CAST(json_extract(entry.value,'$.quantity') AS INTEGER)>COALESCE((SELECT SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=? AND (json_extract(sold.value,'$.listingId')=? OR (json_extract(sold.value,'$.listingId') IS NULL AND o.listing_id=?)) AND ${matches}),0)) END WHERE id=? AND EXISTS(SELECT 1 FROM checkout_orders WHERE id=? AND status='PROCESSING' AND json_extract(details,'$.fulfillmentClaim')=?)`).bind(order.id,listingId,listingId,order.id,listingId,listingId,order.id,listingId,listingId,order.id,listingId,listingId,order.id,listingId,listingId,listingId,order.id,claim));
  }
  const selectedJson=JSON.stringify(selected.filter(item=>item.instanceId));
  if(selectedJson!=='[]')statements.push(database.prepare(`UPDATE collectible_instances SET deleted_at=CASE WHEN quantity-COALESCE((SELECT SUM(CAST(json_extract(item.value,'$.quantity') AS INTEGER)) FROM json_each(?) item WHERE json_extract(item.value,'$.instanceId')=collectible_instances.id),0)<=0 THEN CURRENT_TIMESTAMP ELSE deleted_at END,quantity=MAX(1,quantity-COALESCE((SELECT SUM(CAST(json_extract(item.value,'$.quantity') AS INTEGER)) FROM json_each(?) item WHERE json_extract(item.value,'$.instanceId')=collectible_instances.id),0)) WHERE owner_id=? AND id IN (SELECT json_extract(item.value,'$.instanceId') FROM json_each(?) item WHERE json_extract(item.value,'$.instanceId') IS NOT NULL) AND EXISTS(SELECT 1 FROM checkout_orders WHERE id=? AND status='PROCESSING' AND json_extract(details,'$.fulfillmentClaim')=?)`).bind(selectedJson,selectedJson,order.sellerId,selectedJson,order.id,claim));
  statements.push(database.prepare("UPDATE checkout_orders SET status='PAID',details=json_remove(details,'$.fulfillmentClaim'),paid_at=COALESCE(paid_at,CURRENT_TIMESTAMP),fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PROCESSING' AND json_extract(details,'$.fulfillmentClaim')=?").bind(order.id,claim));
  const results=await database.batch(statements);
  return Boolean(results[0]?.meta.changes);
}
