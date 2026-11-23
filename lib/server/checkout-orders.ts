import {db,HttpError} from '@/lib/server/store';
import {MARKET_PRO_SHIPPING_VOUCHERS_PER_YEAR} from '@/lib/market/policy';
import {syncSocialListingStage} from '@/lib/server/postforme';
import {activateListingBoost} from '@/lib/server/listing-boosts';
import {addCredits} from '@/lib/server/credits';

type FulfillableOrder={id:string;kind:string;buyerId:string;sellerId:string|null;listingId:string|null;items:string;details:string;subtotal:number;paymentId:string|null};

export async function fulfillCheckoutOrder(database:ReturnType<typeof db>,order:FulfillableOrder){
  const claim=crypto.randomUUID();
  if(order.kind==='PRO'){
    let durationDays=0;
    let billingPeriod='monthly';
    try{const details=JSON.parse(order.details) as {durationDays?:number;billingPeriod?:string};durationDays=Number(details.durationDays)||0;billingPeriod=details.billingPeriod==='yearly'?'yearly':'monthly'}catch{}
    if(durationDays<1)throw new HttpError(500,'The Market Pro plan period is missing from this order.');
    const statements=[
      database.prepare("UPDATE checkout_orders SET status='PROCESSING',details=json_set(details,'$.fulfillmentClaim',?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id=?").bind(claim,order.id,order.paymentId),
    ];
    if(billingPeriod==='yearly')statements.push(database.prepare(`INSERT OR IGNORE INTO market_pro_voucher_grants (id,order_id,owner_id,voucher_total,starts_at,expires_at)
      SELECT ?,o.id,o.buyer_id,?,datetime(max(COALESCE(p.pro_expires_at,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP)),datetime(max(COALESCE(p.pro_expires_at,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP), '+' || ? || ' days')
      FROM checkout_orders o JOIN profiles p ON p.id=o.buyer_id
      WHERE o.id=? AND o.status='PROCESSING' AND json_extract(o.details,'$.fulfillmentClaim')=?`).bind(crypto.randomUUID(),MARKET_PRO_SHIPPING_VOUCHERS_PER_YEAR,durationDays,order.id,claim));
    statements.push(
      database.prepare(`UPDATE profiles SET tier='pro',pro_billing_period=?,pro_expires_at=datetime(max(COALESCE(pro_expires_at,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP), '+' || ? || ' days') WHERE id=(SELECT buyer_id FROM checkout_orders WHERE id=? AND status='PROCESSING' AND json_extract(details,'$.fulfillmentClaim')=?)`).bind(billingPeriod,durationDays,order.id,claim),
      database.prepare("UPDATE checkout_orders SET status='PAID',details=json_remove(details,'$.fulfillmentClaim'),paid_at=COALESCE(paid_at,CURRENT_TIMESTAMP),fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PROCESSING' AND json_extract(details,'$.fulfillmentClaim')=?").bind(order.id,claim),
    );
    const results=await database.batch(statements);
    return Boolean(results[0]?.meta.changes);
  }
  if(order.kind==='BOOST'){
    let durationDays=3;
    let planId='3d';
    let listingId=order.listingId??'';
    try{
      const details=JSON.parse(order.details) as {durationDays?:number;planId?:string;listingId?:string};
      durationDays=Number(details.durationDays)||3;
      planId=details.planId==='7d'?'7d':'3d';
      listingId=details.listingId||listingId;
    }catch{}
    if(!listingId)throw new HttpError(500,'The listing for this boost order could not be found.');
    const claimResult=await database.prepare("UPDATE checkout_orders SET status='PROCESSING',details=json_set(details,'$.fulfillmentClaim',?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id=?").bind(claim,order.id,order.paymentId).run();
    if(!claimResult.meta.changes)return false;
    await activateListingBoost(database,{
      listingId,
      sellerId:order.sellerId||order.buyerId,
      planId,
      days:durationDays,
      orderId:order.id,
    });
    await database.prepare("UPDATE checkout_orders SET status='PAID',details=json_remove(details,'$.fulfillmentClaim'),paid_at=COALESCE(paid_at,CURRENT_TIMESTAMP),fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PROCESSING' AND json_extract(details,'$.fulfillmentClaim')=?").bind(order.id,claim).run();
    return true;
  }
  if(order.kind==='CREDITS'){
    let creditAmount=Number(order.subtotal)||0;
    try{
      const details=JSON.parse(order.details) as {creditAmount?:number};
      if(Number.isSafeInteger(details.creditAmount)&&Number(details.creditAmount)>0)creditAmount=Number(details.creditAmount);
    }catch{}
    if(creditAmount<=0)throw new HttpError(500,'The credit amount for this order is invalid.');
    const claimResult=await database.prepare("UPDATE checkout_orders SET status='PROCESSING',details=json_set(details,'$.fulfillmentClaim',?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id=?").bind(claim,order.id,order.paymentId).run();
    if(!claimResult.meta.changes)return false;
    await addCredits(database,{
      profileId:order.buyerId,
      amount:creditAmount,
      kind:'TOPUP',
      referenceId:order.id,
      description:`Top up Rp ${creditAmount.toLocaleString('id-ID')}`,
    });
    await database.prepare("UPDATE checkout_orders SET status='PAID',details=json_remove(details,'$.fulfillmentClaim'),paid_at=COALESCE(paid_at,CURRENT_TIMESTAMP),fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PROCESSING' AND json_extract(details,'$.fulfillmentClaim')=?").bind(order.id,claim).run();
    return true;
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
    statements.push(database.prepare(`UPDATE listings SET quantity=MAX(1,quantity-${quantitySql}),amount=CASE WHEN quantity-${quantitySql}<=0 THEN amount ELSE MAX(0,amount-${amountSql}) END,status=CASE WHEN quantity-${quantitySql}<=0 THEN 'SOLD' ELSE status END,items=CASE WHEN items IS NULL THEN NULL ELSE (SELECT COALESCE(json_group_array(json_set(entry.value,'$.quantity',CAST(json_extract(entry.value,'$.quantity') AS INTEGER)-COALESCE((SELECT SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=? AND (json_extract(sold.value,'$.listingId')=? OR (json_extract(sold.value,'$.listingId') IS NULL AND o.listing_id=?)) AND ${matches}),0))), '[]') FROM json_each(listings.items) entry WHERE CAST(json_extract(entry.value,'$.quantity') AS INTEGER)>COALESCE((SELECT SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=? AND (json_extract(sold.value,'$.listingId')=? OR (json_extract(sold.value,'$.listingId') IS NULL AND o.listing_id=?)) AND ${matches}),0)) END WHERE id=? AND EXISTS(SELECT 1 FROM checkout_orders WHERE id=? AND status='PROCESSING' AND json_extract(details,'$.fulfillmentClaim')=?)`).bind(order.id,listingId,listingId,order.id,listingId,listingId,order.id,listingId,listingId,order.id,listingId,listingId,order.id,listingId,listingId,listingId,order.id,claim));
  }
  const selectedJson=JSON.stringify(selected.filter(item=>item.instanceId));
  if(selectedJson!=='[]')statements.push(database.prepare(`UPDATE collectible_instances SET deleted_at=CASE WHEN quantity-COALESCE((SELECT SUM(CAST(json_extract(item.value,'$.quantity') AS INTEGER)) FROM json_each(?) item WHERE json_extract(item.value,'$.instanceId')=collectible_instances.id),0)<=0 THEN CURRENT_TIMESTAMP ELSE deleted_at END,quantity=MAX(1,quantity-COALESCE((SELECT SUM(CAST(json_extract(item.value,'$.quantity') AS INTEGER)) FROM json_each(?) item WHERE json_extract(item.value,'$.instanceId')=collectible_instances.id),0)) WHERE owner_id=? AND id IN (SELECT json_extract(item.value,'$.instanceId') FROM json_each(?) item WHERE json_extract(item.value,'$.instanceId') IS NOT NULL) AND EXISTS(SELECT 1 FROM checkout_orders WHERE id=? AND status='PROCESSING' AND json_extract(details,'$.fulfillmentClaim')=?)`).bind(selectedJson,selectedJson,order.sellerId,selectedJson,order.id,claim));
  if(listingIds.length){
    for(const listingId of listingIds){
      statements.push(database.prepare("UPDATE market_auctions SET winner_order_id=? WHERE listing_id=? AND winner_order_id IS NULL").bind(order.id,listingId));
    }
  }
  statements.push(database.prepare("UPDATE checkout_orders SET status='PAID',details=json_remove(details,'$.fulfillmentClaim'),paid_at=COALESCE(paid_at,CURRENT_TIMESTAMP),fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PROCESSING' AND json_extract(details,'$.fulfillmentClaim')=?").bind(order.id,claim));
  const results=await database.batch(statements);
  const changed=Boolean(results[0]?.meta.changes);
  if(changed){
    try{
      const soldRows=await database.prepare(`SELECT id FROM listings WHERE id IN (${listingIds.map(()=>'?').join(',')}) AND status='SOLD'`).bind(...listingIds).all<{id:string}>();
      const soldIds=(soldRows.results??[]).map(row=>row.id);
      if(soldIds.length){
        await syncSocialListingStage({listingIds:soldIds,stage:'SOLD',soldPrice:order.subtotal});
      }
    }catch{}
  }
  return changed;
}
