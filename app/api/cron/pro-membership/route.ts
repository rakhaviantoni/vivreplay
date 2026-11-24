import {env} from 'cloudflare:workers';
import {db} from '@/lib/server/store';
import {ipaymuExpiryTimestamp} from '@/lib/server/ipaymu';
import {sendMarketEmailOnce} from '@/lib/server/market-notifications';
import {getProPricing} from '@/lib/market/pro-pricing';
import {ensureCreditSchema,spendCredits} from '@/lib/server/credits';
import {getRemainingProBoostCredits} from '@/lib/server/listing-boosts';

type ProfileExpiry={id:string;expiresAt:string};
type ProOrder={id:string;buyerId:string;status:string};
type PendingProOrder={id:string;buyerId:string;paymentId:string|null;expiresAt:string|null;updatedAt:string|null;details:string};

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
  const pending=(await database.prepare(`SELECT id,buyer_id AS buyerId,payment_id AS paymentId,expires_at AS expiresAt,updated_at AS updatedAt,details
    FROM checkout_orders WHERE kind='PRO' AND status='PENDING_PAYMENT' AND created_at>=datetime('now','-7 days')
    ORDER BY created_at DESC LIMIT 500`).all<PendingProOrder>()).results;
  const paymentReminderOrders:string[]=[];
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
    }else if(expiredAt!==null&&expiredAt-Date.now()<=2*60*60*1000&&typeof details.ipaymuPaymentMethod==='string'&&order.paymentId&&!order.paymentId.startsWith('CREATING:')){
      paymentReminderOrders.push(order.id);
    }
  }

  await ensureCreditSchema(database);
  const proPricing=await getProPricing(database);
  const renewPrice=proPricing.amount||24_900;
  const renewDays=proPricing.durationDays||30;
  const autoRenewCandidates=(await database.prepare(`SELECT p.id,p.pro_expires_at AS expiresAt
    FROM profiles p
    JOIN market_credit_wallets w ON w.profile_id=p.id
    WHERE p.tier='pro' AND p.pro_expires_at IS NOT NULL AND p.pro_expires_at<=datetime('now','+12 hours')
      AND w.auto_renew_pro=1 AND w.balance>=?
    LIMIT 200`).bind(renewPrice).all<ProfileExpiry>()).results;
  for(const candidate of autoRenewCandidates){
    const spend=await spendCredits(database,{
      profileId:candidate.id,
      amount:renewPrice,
      kind:'PRO_RENEW',
      referenceId:candidate.expiresAt,
      description:`Auto-renew Market Pro (${renewDays} days)`,
    });
    if(spend.ok){
      await database.prepare(`UPDATE profiles SET tier='pro',pro_billing_period='monthly',pro_expires_at=datetime(max(COALESCE(pro_expires_at,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP), '+' || ? || ' days') WHERE id=?`).bind(renewDays,candidate.id).run();
      await sendMarketEmailOnce(candidate.id,'pro-auto-renewed-credits','Market Pro',candidate.id,`pro-auto-renew-${candidate.expiresAt}`,{membershipDays:renewDays,amount:renewPrice,currency:'IDR'}).catch(()=>{});
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
  for(const orderId of paymentReminderOrders){
    const order=pending.find(item=>item.id===orderId)!;
    notificationJobs.push(()=>sendMarketEmailOnce(order.buyerId,'pro-payment-reminder','Market Pro',order.id,`payment-reminder:${order.id}`));
  }
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

  const nowDate=new Date();
  const monthEnd=new Date(Date.UTC(nowDate.getUTCFullYear(),nowDate.getUTCMonth()+1,1)).getTime();
  const daysLeftInMonth=(monthEnd-nowDate.getTime())/(24*60*60*1000);
  if(daysLeftInMonth<=3){
    const monthKey=nowDate.toISOString().slice(0,7);
    const activeProSellers=(await database.prepare(`SELECT p.id,p.pro_billing_period AS period FROM profiles p
      WHERE p.tier='pro' AND (p.pro_expires_at IS NULL OR p.pro_expires_at>CURRENT_TIMESTAMP)
        AND EXISTS(SELECT 1 FROM listings l WHERE l.seller_id=p.id AND l.status='ACTIVE')
      LIMIT 500`).all<{id:string;period:string|null}>()).results;
    for(const seller of activeProSellers){
      const remaining=await getRemainingProBoostCredits(database,seller.id,seller.period).catch(()=>0);
      if(remaining>0){
        notificationJobs.push(()=>sendMarketEmailOnce(seller.id,'pro-boost-credits-reminder','Market Pro',seller.id,`boost-credits-reminder:${monthKey}`,{itemCount:remaining}));
      }
    }
  }

  await deliverInBatches(notificationJobs,job=>job());
  return Response.json({processed:notificationJobs.length},{headers:{'Cache-Control':'no-store'}});
}
