import {db} from '@/lib/server/store';
import {fulfillCheckoutOrder} from '@/lib/server/checkout-orders';
import {callbackAmount,callbackIsSuccessful,callbackReference,callbackSessionId,callbackStatus,parseAndVerifyIpaymuCallback} from '@/lib/server/ipaymu';

export async function POST(request:Request){
  try{
    const payload=await parseAndVerifyIpaymuCallback(request);
    if(!payload)return Response.json({error:'Invalid callback signature.'},{status:400});
    const orderId=callbackReference(payload);
    const sessionId=callbackSessionId(payload);
    if(!orderId||!sessionId)return Response.json({error:'Missing payment reference.'},{status:400});
    const database=db();
    const order=await database.prepare(`SELECT id,kind,buyer_id AS buyerId,seller_id AS sellerId,listing_id AS listingId,items,details,subtotal,amount,payment_id AS paymentId,status FROM checkout_orders WHERE id=?`).bind(orderId).first<{id:string;kind:string;buyerId:string;sellerId:string|null;listingId:string|null;items:string;details:string;subtotal:number;amount:number;paymentId:string|null;status:string}>();
    if(!order)return Response.json({error:'Order was not found.'},{status:404});
    if(order.paymentId!==sessionId)return Response.json({error:'Payment session does not match this order.'},{status:409});
    if(order.status!=='PENDING_PAYMENT')return Response.json({status:'already_processed'});
    if(callbackIsSuccessful(payload)){
      const paidAmount=callbackAmount(payload);
      if(paidAmount!==null&&paidAmount!==order.amount)return Response.json({error:'Payment amount does not match this order.'},{status:409});
      if(paidAmount===null)return Response.json({error:'Payment amount was missing.'},{status:400});
      await fulfillCheckoutOrder(database,order);
      return Response.json({status:'ok'});
    }
    const nextStatus=callbackStatus(payload);
    if(nextStatus!=='PENDING_PAYMENT')await database.prepare('UPDATE checkout_orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=\'PENDING_PAYMENT\' AND payment_id=?').bind(nextStatus,orderId,sessionId).run();
    return Response.json({status:'ok'});
  }catch{
    return Response.json({error:'Callback could not be processed.'},{status:500});
  }
}
