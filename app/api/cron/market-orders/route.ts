import {env} from 'cloudflare:workers';
import {db} from '@/lib/server/store';
import {ipaymuExpiryTimestamp} from '@/lib/server/ipaymu';
import {sendMarketEmailOnce} from '@/lib/server/market-notifications';
import {paymentReminderDue,shippingReminderStage} from '@/lib/market/reminder-windows';
import {marketShippingDeadline} from '@/lib/market/shipping-deadline';
import {completeDeliveredMarketOrder} from '@/lib/server/market-order-fulfillment';

type PendingOrder={id:string;buyerId:string;expiresAt:string|null};
type ExpiringOrder={id:string;buyerId:string;sellerId:string|null;title:string|null;details:string;expiresAt:string|null;updatedAt:string|null};
type PaidOrder={id:string;sellerId:string;paidAt:string|null;updatedAt:string};

async function deliverInBatches(jobs:Array<()=>Promise<unknown>>){
  for(let offset=0;offset<jobs.length;offset+=10)await Promise.allSettled(jobs.slice(offset,offset+10).map(job=>job()));
}

export async function POST(request:Request){
  const secret=(env as unknown as {PRO_MEMBERSHIP_CRON_SECRET?:string}).PRO_MEMBERSHIP_CRON_SECRET;
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({error:'Unauthorized.'},{status:401,headers:{'Cache-Control':'no-store'}});
  const database=db();const now=Date.now();const jobs:Array<()=>Promise<unknown>>=[];
  const expiring=(await database.prepare(`SELECT o.id,o.buyer_id AS buyerId,o.seller_id AS sellerId,l.title,o.details,
      o.expires_at AS expiresAt,o.updated_at AS updatedAt
    FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id
    WHERE o.kind='MARKET' AND o.status='PENDING_PAYMENT' ORDER BY o.expires_at LIMIT 1000`)
    .all<ExpiringOrder>()).results;
  for(const order of expiring){
    let details:Record<string,unknown>={};
    try{const parsed=JSON.parse(order.details) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
    const paymentExpiry=typeof details.ipaymuPaymentMethod==='string'
      ?ipaymuExpiryTimestamp(details.ipaymuPaymentExpiresAt,details.ipaymuPaymentCreatedAt,order.updatedAt)
      :null;
    const storedExpiry=order.expiresAt?Date.parse(`${order.expiresAt.replace(' ','T')}Z`):NaN;
    const expiresAt=paymentExpiry??(Number.isFinite(storedExpiry)?storedExpiry:null);
    if(expiresAt===null||expiresAt>now)continue;
    if(paymentExpiry!==null)details.ipaymuExpiredByProviderAt??=new Date().toISOString();
    const expiresAtSql=new Date(expiresAt).toISOString().slice(0,19).replace('T',' ');
    const expired=await database.prepare(`UPDATE checkout_orders SET status='EXPIRED',details=?,expires_at=?,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND kind='MARKET' AND status='PENDING_PAYMENT'`).bind(JSON.stringify(details),expiresAtSql,order.id).run();
    if(!expired.meta.changes)continue;
    const title=order.title||'Market order';
    jobs.push(()=>sendMarketEmailOnce(order.buyerId,'order-expired',title,order.id,`market-payment-expired:${order.id}:${order.buyerId}`));
    if(order.sellerId)jobs.push(()=>sendMarketEmailOnce(order.sellerId!,'order-expired',title,order.id,`market-payment-expired:${order.id}:${order.sellerId}`));
  }
  const pending=(await database.prepare(`SELECT id,buyer_id AS buyerId,expires_at AS expiresAt FROM checkout_orders
    WHERE kind='MARKET' AND status='PENDING_PAYMENT' AND expires_at>CURRENT_TIMESTAMP
      AND expires_at<=datetime('now','+45 minutes') ORDER BY expires_at LIMIT 500`).all<PendingOrder>()).results;
  for(const order of pending){
    const expiry=order.expiresAt?Date.parse(`${order.expiresAt.replace(' ','T')}Z`):NaN;
    if(Number.isFinite(expiry)&&paymentReminderDue(expiry-now))jobs.push(()=>sendMarketEmailOnce(order.buyerId,'order-payment-reminder','Market order',order.id,`market-payment-reminder:${order.id}`));
  }
  const paid=(await database.prepare(`SELECT id,seller_id AS sellerId,paid_at AS paidAt,updated_at AS updatedAt FROM checkout_orders
    WHERE kind='MARKET' AND status='PAID' AND seller_id IS NOT NULL AND COALESCE(paid_at,updated_at)>=datetime('now','-14 days')
    ORDER BY paid_at LIMIT 1000`).all<PaidOrder>()).results;
  for(const order of paid){
    const deadline=marketShippingDeadline(order.paidAt??order.updatedAt);if(!deadline)continue;
    const stage=shippingReminderStage(Date.parse(deadline)-now);if(!stage)continue;
    const event=stage==='day'?'order-shipping-reminder-day':'order-shipping-reminder-soon';
    jobs.push(()=>sendMarketEmailOnce(order.sellerId,event,'Market order',order.id,`market-shipping-reminder:${stage}:${order.id}`));
  }
  const reviewExpired=(await database.prepare(`SELECT id,buyer_id AS buyerId FROM checkout_orders
    WHERE kind='MARKET' AND status='SHIPPED' AND delivered_at<=datetime('now','-48 hours')
      AND NOT EXISTS(SELECT 1 FROM market_disputes WHERE order_id=checkout_orders.id AND status!='RESOLVED')
    ORDER BY delivered_at LIMIT 500`).all<{id:string;buyerId:string}>()).results;
  for(const order of reviewExpired)jobs.push(()=>completeDeliveredMarketOrder(order.id,order.buyerId,true));
  await deliverInBatches(jobs);
  return Response.json({processed:jobs.length},{headers:{'Cache-Control':'no-store'}});
}
