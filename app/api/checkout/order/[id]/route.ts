import {db,errorResponse,user,HttpError} from '@/lib/server/store';
import {getAzekhaIntent} from '@/lib/server/azekha-payments';

type OrderRow={id:string;kind:string;buyerId:string;sellerId:string|null;listingId:string|null;items:string;details:string;subtotal:number;shippingFee:number;amount:number;currency:string;paymentId:string|null;status:string;expiresAt:string|null;title:string|null};

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();
    const {id}=await params;
    const database=db();
    const order=await database.prepare(`SELECT o.id,o.kind,o.buyer_id AS buyerId,o.seller_id AS sellerId,o.listing_id AS listingId,o.items,o.details,o.subtotal,o.shipping_fee AS shippingFee,o.amount,o.currency,o.payment_id AS paymentId,o.status,o.expires_at AS expiresAt,l.title FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.id=?`).bind(id).first<OrderRow>();
    if(!order||order.buyerId!==profile.id)throw new HttpError(404,'Checkout was not found.');

    if(order.status==='PENDING_PAYMENT'&&order.expiresAt&&new Date(`${order.expiresAt.replace(' ','T')}Z`).getTime()<=Date.now()){
      await database.prepare("UPDATE checkout_orders SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT'").bind(id).run();
      order.status='EXPIRED';
    }
    if(order.status==='PENDING_PAYMENT'&&order.paymentId){
      const payment=await getAzekhaIntent(order.paymentId);
      if(payment.status==='completed')await fulfillOrder(database,order);
      else if(payment.status==='expired'||payment.status==='failed')await database.prepare("UPDATE checkout_orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT'").bind(payment.status.toUpperCase(),id).run();
      const refreshed=await database.prepare('SELECT status,expires_at AS expiresAt FROM checkout_orders WHERE id=?').bind(id).first<{status:string;expiresAt:string|null}>();
      order.status=refreshed?.status??order.status;
      order.expiresAt=refreshed?.expiresAt??order.expiresAt;
    }

    let items:unknown[]=[];let details:Record<string,unknown>={};
    try{items=JSON.parse(order.items) as unknown[]}catch{}
    try{details=JSON.parse(order.details) as Record<string,unknown>}catch{}
    return Response.json({id:order.id,kind:order.kind,status:order.status,title:order.title??'VivrePlay Pro',items,details,subtotal:order.subtotal,shippingFee:order.shippingFee,amount:order.amount,currency:order.currency,expiresAt:order.expiresAt});
  }catch(error){return errorResponse(error)}
}

async function fulfillOrder(database:ReturnType<typeof db>,order:OrderRow){
  if(order.kind==='PRO'){
    let durationDays=0;
    try{durationDays=Number((JSON.parse(order.details) as {durationDays?:number}).durationDays)||0}catch{}
    if(durationDays<1)throw new HttpError(500,'The Pro plan duration is missing from this checkout.');
    await database.batch([
      database.prepare("UPDATE checkout_orders SET status='PROCESSING',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT'").bind(order.id),
      database.prepare(`UPDATE profiles SET tier='pro',pro_expires_at=datetime(max(COALESCE(pro_expires_at,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP), '+' || ? || ' days') WHERE id=(SELECT buyer_id FROM checkout_orders WHERE id=? AND status='PROCESSING')`).bind(durationDays,order.id),
      database.prepare("UPDATE checkout_orders SET status='PAID',fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PROCESSING'").bind(order.id),
    ]);
    return;
  }

  let selected:Array<{instanceId?:string;printingId:string;quantity:number}>;
  try{selected=JSON.parse(order.items) as typeof selected}catch{throw new HttpError(500,'The selected cards could not be loaded.');}
  const statements=[
    database.prepare("UPDATE checkout_orders SET status='PROCESSING',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT'").bind(order.id),
    database.prepare(`UPDATE listings SET quantity=MAX(1,quantity-(SELECT COALESCE(SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)),0) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=?)),amount=MAX(0,amount-?),status=CASE WHEN quantity-(SELECT COALESCE(SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)),0) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=?)<=0 THEN 'SOLD' ELSE status END,items=CASE WHEN items IS NULL THEN NULL ELSE (SELECT COALESCE(json_group_array(json_set(entry.value,'$.quantity',CAST(json_extract(entry.value,'$.quantity') AS INTEGER)-COALESCE((SELECT SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=? AND ((json_extract(sold.value,'$.instanceId') IS NOT NULL AND json_extract(sold.value,'$.instanceId')=json_extract(entry.value,'$.instanceId')) OR (json_extract(sold.value,'$.instanceId') IS NULL AND json_extract(sold.value,'$.printingId')=json_extract(entry.value,'$.printingId')))),0))), '[]') FROM json_each(listings.items) entry WHERE CAST(json_extract(entry.value,'$.quantity') AS INTEGER)>COALESCE((SELECT SUM(CAST(json_extract(sold.value,'$.quantity') AS INTEGER)) FROM checkout_orders o,json_each(o.items) sold WHERE o.id=? AND ((json_extract(sold.value,'$.instanceId') IS NOT NULL AND json_extract(sold.value,'$.instanceId')=json_extract(entry.value,'$.instanceId')) OR (json_extract(sold.value,'$.instanceId') IS NULL AND json_extract(sold.value,'$.printingId')=json_extract(entry.value,'$.printingId')))),0)) END WHERE id=? AND EXISTS(SELECT 1 FROM checkout_orders WHERE id=? AND status='PROCESSING')`).bind(order.id,order.subtotal,order.id,order.id,order.id,order.listingId,order.id),
  ];
  for(const item of selected){
    if(!item.instanceId)continue;
    statements.push(database.prepare(`UPDATE collectible_instances SET deleted_at=CASE WHEN quantity-?<=0 THEN CURRENT_TIMESTAMP ELSE deleted_at END,quantity=MAX(1,quantity-?) WHERE id=? AND owner_id=? AND quantity>=? AND EXISTS(SELECT 1 FROM checkout_orders WHERE id=? AND status='PROCESSING')`).bind(item.quantity,item.quantity,item.instanceId,order.sellerId,item.quantity,order.id));
  }
  statements.push(database.prepare("UPDATE checkout_orders SET status='PAID',fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PROCESSING'").bind(order.id));
  await database.batch(statements);
}
