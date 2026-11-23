import {db} from '@/lib/server/store';
import {verifyPolarWebhookSignature} from '@/lib/server/polar';
import {fulfillCheckoutOrder} from '@/lib/server/checkout-orders';
import {sendMarketEmailOnce} from '@/lib/server/market-notifications';

export async function POST(request:Request){
  const rawBody=await request.text();
  const valid=await verifyPolarWebhookSignature(rawBody,request.headers);
  if(!valid){
    return Response.json({error:'Invalid webhook signature.'},{status:403});
  }

  let event:{type?:string;data?:{id?:string;checkout_id?:string;status?:string;metadata?:Record<string,unknown>}};
  try{
    event=JSON.parse(rawBody) as typeof event;
  }catch{
    return Response.json({error:'Invalid JSON payload.'},{status:400});
  }

  const eventType=event.type??'';
  const data=event.data??{};
  const isPaidEvent=
    eventType==='order.paid'||
    (eventType==='checkout.updated'&&data.status==='succeeded');

  if(!isPaidEvent){
    return Response.json({received:true,ignored:eventType||'unknown'});
  }

  const metadataOrderId=typeof data.metadata?.orderId==='string'?data.metadata.orderId:'';
  const paymentId=typeof data.checkout_id==='string'?data.checkout_id:typeof data.id==='string'?data.id:'';
  if(!metadataOrderId&&!paymentId){
    return Response.json({received:true,skipped:'no_order_reference'});
  }

  const database=db();
  const order=await database.prepare(`SELECT id,kind,buyer_id AS buyerId,seller_id AS sellerId,listing_id AS listingId,items,details,subtotal,currency,payment_id AS paymentId,status
    FROM checkout_orders WHERE ${metadataOrderId?'id=?':'payment_id=?'} LIMIT 1`).bind(metadataOrderId||paymentId).first<{
      id:string;
      kind:string;
      buyerId:string;
      sellerId:string|null;
      listingId:string|null;
      items:string;
      details:string;
      subtotal:number;
      currency:string;
      paymentId:string|null;
      status:string;
    }>();

  if(!order){
    return Response.json({received:true,skipped:'order_not_found'});
  }
  if(order.status==='PAID'||order.status==='COMPLETED'){
    return Response.json({received:true,alreadyFulfilled:true});
  }

  // Ensure payment_id matches the Polar checkout id so fulfillCheckoutOrder's optimistic lock succeeds
  const effectiveOrder=order.paymentId?order:{...order,paymentId:paymentId||`polar:${order.id}`};
  if(!order.paymentId&&effectiveOrder.paymentId){
    await database.prepare("UPDATE checkout_orders SET payment_id=? WHERE id=? AND status='PENDING_PAYMENT' AND payment_id IS NULL").bind(effectiveOrder.paymentId,order.id).run();
  }

  const fulfilled=await fulfillCheckoutOrder(database,effectiveOrder);
  if(fulfilled&&order.kind==='PRO'){
    await sendMarketEmailOnce(order.buyerId,'pro-activated','Market Pro',order.id,`activated:${order.id}`).catch(()=>{});
  }

  return Response.json({received:true,fulfilled});
}
