import {db,errorResponse,HttpError,user} from '@/lib/server/store';
import {sendMarketEmail} from '@/lib/server/market-notifications';

type OrderRow={id:string;kind:string;buyerId:string;sellerId:string|null;status:string;paymentId:string|null;expiresAt:string|null;details:string;title:string|null};

export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();
    const {id}=await params;
    const database=db();
    const order=await database.prepare(`SELECT o.id,o.kind,o.buyer_id AS buyerId,o.seller_id AS sellerId,o.status,o.payment_id AS paymentId,o.expires_at AS expiresAt,o.details,l.title
      FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.id=?`).bind(id).first<OrderRow>();
    if(!order||(order.buyerId!==profile.id&&order.sellerId!==profile.id))throw new HttpError(404,'Order was not found.');
    if(order.kind!=='MARKET')throw new HttpError(400,'Only Market orders can be cancelled here.');
    if(order.status!=='PENDING_PAYMENT')throw new HttpError(409,'Only an unpaid order can be cancelled.');
    if(order.paymentId)throw new HttpError(409,'A payment code is active or being created. Wait for it to expire before cancelling.');
    if(order.expiresAt&&new Date(`${order.expiresAt.replace(' ','T')}Z`).getTime()<=Date.now()){
      await database.prepare("UPDATE checkout_orders SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id IS NULL").bind(id).run();
      throw new HttpError(409,'This unpaid order has expired.');
    }
    let details:Record<string,unknown>={};
    try{const parsed=JSON.parse(order.details) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
    details.cancelledByRole=order.buyerId===profile.id?'buyer':'seller';
    details.cancelledAt=new Date().toISOString();
    const result=await database.prepare("UPDATE checkout_orders SET status='CANCELLED',details=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='MARKET' AND status='PENDING_PAYMENT' AND payment_id IS NULL AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)").bind(JSON.stringify(details),id).run();
    if(!result.meta.changes)throw new HttpError(409,'This order changed before it could be cancelled. Refresh and check its status.');
    const recipient=order.buyerId===profile.id?order.sellerId:order.buyerId;
    if(recipient)await sendMarketEmail(recipient,'order-cancelled',order.title||'Market order',order.id);
    return Response.json({ok:true,status:'CANCELLED'});
  }catch(error){return errorResponse(error)}
}
