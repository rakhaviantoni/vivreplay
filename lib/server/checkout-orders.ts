import {db,HttpError} from '@/lib/server/store';

type FulfillableOrder={id:string;kind:string;buyerId:string;sellerId:string|null;listingId:string|null;items:string;details:string;subtotal:number};

export async function fulfillCheckoutOrder(database:ReturnType<typeof db>,order:FulfillableOrder){
  if(order.kind==='PRO'){
    let durationDays=0;
    try{durationDays=Number((JSON.parse(order.details) as {durationDays?:number}).durationDays)||0}catch{}
    if(durationDays<1)throw new HttpError(500,'The Market Pro plan period is missing from this order.');
    await database.batch([
      database.prepare("UPDATE checkout_orders SET status='PROCESSING',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT'").bind(order.id),
      database.prepare(`UPDATE profiles SET tier='pro',pro_expires_at=datetime(max(COALESCE(pro_expires_at,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP), '+' || ? || ' days') WHERE id=(SELECT buyer_id FROM checkout_orders WHERE id=? AND status='PROCESSING')`).bind(durationDays,order.id),
      database.prepare("UPDATE checkout_orders SET status='PAID',paid_at=COALESCE(paid_at,CURRENT_TIMESTAMP),fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PROCESSING'").bind(order.id),
    ]);
    return;
  }

  let selected:Array<{instanceId?:string;printingId:string;quantity:number;unitAmount?:number;condition?:string}>;
  try{selected=JSON.parse(order.items) as typeof selected}catch{throw new HttpError(500,'The selected cards could not be loaded.');}
  const statements=[
    database.prepare("UPDATE checkout_orders SET status='PROCESSING',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT'").bind(order.id),
    database.prepare(`UPDATE listings SET quantity=MAX(1,quantity-(SELECT COALESCE(SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)),0) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=?)),amount=MAX(0,amount-?),status=CASE WHEN quantity-(SELECT COALESCE(SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)),0) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=?)<=0 THEN 'SOLD' ELSE status END,items=CASE WHEN items IS NULL THEN NULL ELSE (SELECT COALESCE(json_group_array(json_set(entry.value,'$.quantity',CAST(json_extract(entry.value,'$.quantity') AS INTEGER)-COALESCE((SELECT SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=? AND ((json_extract(sold.value,'$.instanceId') IS NOT NULL AND json_extract(sold.value,'$.instanceId')=json_extract(entry.value,'$.instanceId')) OR (json_extract(sold.value,'$.instanceId') IS NULL AND json_extract(sold.value,'$.printingId')=json_extract(entry.value,'$.printingId')))),0))), '[]') FROM json_each(listings.items) entry WHERE CAST(json_extract(entry.value,'$.quantity') AS INTEGER)>COALESCE((SELECT SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=? AND ((json_extract(sold.value,'$.instanceId') IS NOT NULL AND json_extract(sold.value,'$.instanceId')=json_extract(entry.value,'$.instanceId')) OR (json_extract(sold.value,'$.instanceId') IS NULL AND json_extract(sold.value,'$.printingId')=json_extract(entry.value,'$.printingId')))),0)) END WHERE id=? AND EXISTS(SELECT 1 FROM checkout_orders WHERE id=? AND status='PROCESSING')`).bind(order.id,order.subtotal,order.id,order.id,order.id,order.listingId,order.id),
  ];
  for(const item of selected){
    if(!item.instanceId)continue;
    statements.push(database.prepare(`UPDATE collectible_instances SET deleted_at=CASE WHEN quantity-?<=0 THEN CURRENT_TIMESTAMP ELSE deleted_at END,quantity=MAX(1,quantity-?) WHERE id=? AND owner_id=? AND quantity>=? AND EXISTS(SELECT 1 FROM checkout_orders WHERE id=? AND status='PROCESSING')`).bind(item.quantity,item.quantity,item.instanceId,order.sellerId,item.quantity,order.id));
  }
  statements.push(database.prepare("UPDATE checkout_orders SET status='PAID',paid_at=COALESCE(paid_at,CURRENT_TIMESTAMP),fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PROCESSING'").bind(order.id));
  await database.batch(statements);
}
