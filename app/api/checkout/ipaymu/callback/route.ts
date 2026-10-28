import {db} from '@/lib/server/store';
import {fulfillCheckoutOrder} from '@/lib/server/checkout-orders';
import {callbackAmount,callbackIsSuccessful,callbackReference,callbackSessionId,callbackStatus,callbackTransactionId,parseAndVerifyIpaymuCallback} from '@/lib/server/ipaymu';
import {sendMarketEmail,sendMarketEmailOnce} from '@/lib/server/market-notifications';

export async function POST(request:Request){
  try{
    const payload=await parseAndVerifyIpaymuCallback(request);
    if(!payload)return Response.json({error:'Invalid callback signature.'},{status:400});
    const orderId=callbackReference(payload);
    const sessionId=callbackSessionId(payload);
    const transactionId=callbackTransactionId(payload);
    if(!orderId||(!sessionId&&!transactionId))return Response.json({error:'Missing payment reference.'},{status:400});
    const database=db();
    const order=await database.prepare(`SELECT o.id,o.kind,o.buyer_id AS buyerId,o.seller_id AS sellerId,o.listing_id AS listingId,o.items,o.details,o.subtotal,o.amount,o.payment_id AS paymentId,o.status,l.title FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.id=?`).bind(orderId).first<{id:string;kind:string;buyerId:string;sellerId:string|null;listingId:string|null;items:string;details:string;subtotal:number;amount:number;paymentId:string|null;status:string;title:string|null}>();
    if(!order)return Response.json({error:'Order was not found.'},{status:404});
    let details:Record<string,unknown>={};try{details=JSON.parse(order.details) as Record<string,unknown>}catch{}
    const validPaymentIds=[order.paymentId,details.ipaymuTransactionId].filter(Boolean).map(String);
    const claimedAttempt=Boolean(callbackReference(payload)===order.id&&(order.paymentId?.startsWith('CREATING:')||(!order.paymentId&&typeof details.ipaymuSelectedMethod==='string')));
    if(!validPaymentIds.includes(sessionId)&&!validPaymentIds.includes(transactionId)&&!claimedAttempt)return Response.json({error:'Payment session does not match this order.'},{status:409});
    if(callbackIsSuccessful(payload)){
      const paidAmount=callbackAmount(payload);
      const expectedAmounts=[order.amount,Number(details.ipaymuPaymentTotal)].filter((value,index,array)=>Number.isSafeInteger(value)&&value>0&&array.indexOf(value)===index);
      if(paidAmount!==null&&!expectedAmounts.includes(paidAmount))return Response.json({error:'Payment amount does not match this order.'},{status:409});
      if(paidAmount===null)return Response.json({error:'Payment amount was missing.'},{status:400});
      if(order.status==='EXPIRED'){
        await database.prepare("UPDATE checkout_orders SET status='PAYMENT_REVIEW',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='EXPIRED' AND payment_id=?").bind(orderId,order.paymentId).run();
        console.error('ipaymu_paid_after_expiry_requires_review',orderId);
        if(order.kind==='PRO')await sendMarketEmailOnce(order.buyerId,'pro-payment-review','Market Pro',order.id,`payment-review:${order.id}`);
        return Response.json({status:'payment_review'});
      }
      if(order.status!=='PENDING_PAYMENT'){
        if(order.kind==='PRO'&&(order.status==='PAID'||order.status==='COMPLETED'))await sendMarketEmailOnce(order.buyerId,'pro-activated','Market Pro',order.id,`activated:${order.id}`);
        if(order.kind==='PRO'&&order.status==='PAYMENT_REVIEW')await sendMarketEmailOnce(order.buyerId,'pro-payment-review','Market Pro',order.id,`payment-review:${order.id}`);
        return Response.json({status:'already_processed'});
      }
      let paymentId=order.paymentId;
      if(claimedAttempt){
        paymentId=sessionId||transactionId;
        const bound=await database.prepare("UPDATE checkout_orders SET payment_id=?,details=json_set(details,'$.ipaymuSessionId',?,'$.ipaymuTransactionId',?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id IS ?").bind(paymentId,sessionId||paymentId,transactionId||paymentId,order.id,order.paymentId).run();
        if(!bound.meta.changes){
          const latest=await database.prepare("SELECT payment_id AS paymentId,status FROM checkout_orders WHERE id=?").bind(order.id).first<{paymentId:string|null;status:string}>();
          if(latest?.status!=='PENDING_PAYMENT'||latest.paymentId!==paymentId)return Response.json({status:'already_processed'});
        }
      }
      const fulfilled=await fulfillCheckoutOrder(database,{...order,paymentId});
      if(!fulfilled)return Response.json({status:'already_processed'});
      if(order.kind==='MARKET'){
        const title=order.title||'Market order';
        await Promise.all([sendMarketEmail(order.buyerId,'order-paid',title,order.id),...(order.sellerId?[sendMarketEmail(order.sellerId,'order-seller-paid',title,order.id)]:[])]);
      }else if(order.kind==='PRO'){
        await sendMarketEmailOnce(order.buyerId,'pro-activated','Market Pro',order.id,`activated:${order.id}`);
      }
      return Response.json({status:'ok'});
    }
    if(order.status!=='PENDING_PAYMENT')return Response.json({status:'already_processed'});
    const nextStatus=callbackStatus(payload);
    if(nextStatus!=='PENDING_PAYMENT'){
      const updated=await database.prepare('UPDATE checkout_orders SET status=?,payment_id=CASE WHEN ? THEN ? ELSE payment_id END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=\'PENDING_PAYMENT\' AND payment_id IS ?').bind(nextStatus,claimedAttempt?1:0,sessionId||transactionId,orderId,order.paymentId).run();
      if(updated.meta.changes&&nextStatus==='EXPIRED'&&order.kind==='MARKET'){
        const title=order.title||'Market order';
        await Promise.all([sendMarketEmail(order.buyerId,'order-expired',title,order.id),...(order.sellerId?[sendMarketEmail(order.sellerId,'order-expired',title,order.id)]:[])]);
      }
      if(updated.meta.changes&&order.kind==='PRO'&&(nextStatus==='EXPIRED'||nextStatus==='FAILED')){
        await sendMarketEmailOnce(order.buyerId,nextStatus==='EXPIRED'?'pro-payment-expired':'pro-payment-failed','Market Pro',order.id,`payment-${nextStatus.toLowerCase()}:${order.id}`);
      }
    }
    return Response.json({status:'ok'});
  }catch{
    return Response.json({error:'Callback could not be processed.'},{status:500});
  }
}
