import {env} from 'cloudflare:workers';
import {db} from '@/lib/server/store';
import {sendMarketEmailOnce} from '@/lib/server/market-notifications';
import {paymentReminderDue,shippingReminderStage} from '@/lib/market/reminder-windows';
import {marketShippingDeadline} from '@/lib/market/shipping-deadline';

type PendingOrder={id:string;buyerId:string;expiresAt:string|null};
type PaidOrder={id:string;sellerId:string;paidAt:string|null;updatedAt:string};

async function deliverInBatches(jobs:Array<()=>Promise<unknown>>){
  for(let offset=0;offset<jobs.length;offset+=10)await Promise.allSettled(jobs.slice(offset,offset+10).map(job=>job()));
}

export async function POST(request:Request){
  const secret=(env as unknown as {PRO_MEMBERSHIP_CRON_SECRET?:string}).PRO_MEMBERSHIP_CRON_SECRET;
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({error:'Unauthorized.'},{status:401,headers:{'Cache-Control':'no-store'}});
  const database=db();const now=Date.now();const jobs:Array<()=>Promise<unknown>>=[];
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
  await deliverInBatches(jobs);
  return Response.json({processed:jobs.length},{headers:{'Cache-Control':'no-store'}});
}
