import {env} from 'cloudflare:workers';
import {db} from '@/lib/server/store';
import {ipaymuExpiryTimestamp} from '@/lib/server/ipaymu';
import {sendMarketEmailOnce} from '@/lib/server/market-notifications';

type ProfileExpiry={id:string;expiresAt:string};
type ProOrder={id:string;buyerId:string;status:string};
type PendingProOrder={id:string;buyerId:string;expiresAt:string|null;updatedAt:string|null;details:string};

async function deliverInBatches<T>(items:T[],send:(item:T)=>Promise<unknown>){
  for(let offset=0;offset<items.length;offset+=10){
    await Promise.allSettled(items.slice(offset,offset+10).map(send));
  }
}

export async function POST(request:Request){
  const secret=(env as unknown as {PRO_MEMBERSHIP_CRON_SECRET?:string}).PRO_MEMBERSHIP_CRON_SECRET;
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`){
    return Response.json({error:'Unauthorized.'},{status:401,headers:{'Cache-Control':'no-store'}});
  }

  const database=db();
  const pending=(await database.prepare(`SELECT id,buyer_id AS buyerId,expires_at AS expiresAt,updated_at AS updatedAt,details
    FROM checkout_orders WHERE kind='PRO' AND status='PENDING_PAYMENT' AND created_at>=datetime('now','-7 days')
    ORDER BY created_at DESC LIMIT 500`).all<PendingProOrder>()).results;
  for(const order of pending){
    let details:Record<string,unknown>={};
    try{const parsed=JSON.parse(order.details) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
    const paymentExpiry=typeof details.ipaymuPaymentMethod==='string'
      ?ipaymuExpiryTimestamp(details.ipaymuPaymentExpiresAt,details.ipaymuPaymentCreatedAt,order.updatedAt)
      :null;
    const storedExpiry=order.expiresAt?Date.parse(`${order.expiresAt.replace(' ','T')}Z`):NaN;
    const expiredAt=paymentExpiry??(Number.isFinite(storedExpiry)?storedExpiry:null);
    if(expiredAt!==null&&expiredAt<=Date.now()){
      if(paymentExpiry!==null)details.ipaymuExpiredByProviderAt??=new Date().toISOString();
      const expirySql=new Date(expiredAt).toISOString().slice(0,19).replace('T',' ');
      await database.prepare(`UPDATE checkout_orders SET status='EXPIRED',details=?,expires_at=?,updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND kind='PRO' AND status='PENDING_PAYMENT'`).bind(JSON.stringify(details),expirySql,order.id).run();
    }
  }

  await database.prepare(`UPDATE profiles SET tier='free'
    WHERE tier='pro' AND pro_expires_at IS NOT NULL AND pro_expires_at<=CURRENT_TIMESTAMP`).run();

  const [orders,expiring,expired]=await Promise.all([
    database.prepare(`SELECT id,buyer_id AS buyerId,status FROM checkout_orders WHERE kind='PRO'
      AND status IN ('PAID','COMPLETED','EXPIRED','FAILED','PAYMENT_REVIEW')
      AND created_at>=datetime('now','-30 days') ORDER BY created_at DESC LIMIT 500`).all<ProOrder>(),
    database.prepare(`SELECT id,pro_expires_at AS expiresAt FROM profiles WHERE tier='pro'
      AND pro_expires_at>CURRENT_TIMESTAMP AND pro_expires_at<=datetime('now','+7 days')
      ORDER BY pro_expires_at LIMIT 500`).all<ProfileExpiry>(),
    database.prepare(`SELECT p.id,p.pro_expires_at AS expiresAt FROM profiles p WHERE p.pro_expires_at<=CURRENT_TIMESTAMP
      AND p.pro_expires_at>=datetime('now','-30 days') AND EXISTS(
        SELECT 1 FROM checkout_orders o WHERE o.buyer_id=p.id AND o.kind='PRO' AND o.status IN ('PAID','COMPLETED')
      ) ORDER BY p.pro_expires_at LIMIT 500`).all<ProfileExpiry>(),
  ]);

  const notificationJobs:Array<()=>Promise<unknown>>=[];
  for(const order of orders.results){
    if(order.status==='PAID'||order.status==='COMPLETED')notificationJobs.push(()=>sendMarketEmailOnce(order.buyerId,'pro-activated','Market Pro',order.id,`activated:${order.id}`));
    if(order.status==='EXPIRED')notificationJobs.push(()=>sendMarketEmailOnce(order.buyerId,'pro-payment-expired','Market Pro',order.id,`payment-expired:${order.id}`));
    if(order.status==='FAILED')notificationJobs.push(()=>sendMarketEmailOnce(order.buyerId,'pro-payment-failed','Market Pro',order.id,`payment-failed:${order.id}`));
    if(order.status==='PAYMENT_REVIEW')notificationJobs.push(()=>sendMarketEmailOnce(order.buyerId,'pro-payment-review','Market Pro',order.id,`payment-review:${order.id}`));
  }
  for(const profile of expiring.results){
    notificationJobs.push(()=>sendMarketEmailOnce(profile.id,'pro-expiring','Market Pro',profile.expiresAt,`expiring:${profile.expiresAt}`));
  }
  for(const profile of expired.results){
    notificationJobs.push(()=>sendMarketEmailOnce(profile.id,'pro-expired','Market Pro',profile.expiresAt,`expired:${profile.expiresAt}`));
  }
  await deliverInBatches(notificationJobs,job=>job());
  return Response.json({processed:notificationJobs.length},{headers:{'Cache-Control':'no-store'}});
}
