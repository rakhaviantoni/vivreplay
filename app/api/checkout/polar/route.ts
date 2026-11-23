import {z} from 'zod';
import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {getCurrentUser} from '@/lib/server/auth';
import {createPolarCheckout,hasPolarConfig,polarMode} from '@/lib/server/polar';
import {USD_CREDIT_TOPUP_PACKAGES} from '@/lib/market/credits';
import {USD_PRO_PRICING} from '@/lib/market/global';
import {LISTING_BOOST_PLANS,type ListingBoostPlanId} from '@/lib/market/boost';
import {spendCredits} from '@/lib/server/credits';
import {activateListingBoost} from '@/lib/server/listing-boosts';
import {sendMarketEmail} from '@/lib/server/market-notifications';
import {MARKET_PRO_SHIPPING_VOUCHERS_PER_YEAR} from '@/lib/market/policy';

const USD_BOOST_CENTS:Record<ListingBoostPlanId,{amount:number;proAmount:number}>={
  '24h':{amount:99,proAmount:49},
  '3d':{amount:199,proAmount:99},
  '7d':{amount:299,proAmount:149},
};

const postSchema=z.object({
  kind:z.enum(['CREDITS','PRO','BOOST']),
  amountCents:z.number().int().min(500).max(50_000).optional(),
  proBillingCycle:z.enum(['monthly','annual']).optional(),
  boostPlanId:z.enum(['24h','3d','7d']).optional(),
  listingId:z.string().uuid().optional(),
  paymentMethod:z.enum(['polar','credits']).default('polar'),
});

export async function GET(){
  return Response.json({
    configured:hasPolarConfig(),
    mode:polarMode(),
    proMonthlyCents:USD_PRO_PRICING.monthlyCents,
    proAnnualCents:USD_PRO_PRICING.annualCents,
    boostPlansCents:USD_BOOST_CENTS,
    creditPackages:USD_CREDIT_TOPUP_PACKAGES,
  },{headers:{'Cache-Control':'private, no-store'}});
}

export async function POST(request:Request){
  try{
    guard(request);
    const [profile,auth]=await Promise.all([user(),getCurrentUser()]);
    const input=postSchema.parse(await request.json());
    const database=db();
    const origin=new URL(request.url).origin;

    if(input.kind==='CREDITS'){
      const amountCents=input.amountCents??1_000;
      if(!hasPolarConfig('CREDITS')){
        throw new HttpError(503,'USD checkout is temporarily unavailable. Please try again later.');
      }
      const orderId=crypto.randomUUID();
      const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString().replace('T',' ').slice(0,19);
      const details=JSON.stringify({
        creditAmount:amountCents,
        currency:'USD',
        paymentProvider:'polar',
        customerName:profile.display_name||profile.username||'Collector',
      });
      await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,items,details,subtotal,shipping_fee,amount,currency,status,expires_at)
        VALUES (?,'CREDITS',?,'[]',?,?,0,?,'USD','PENDING_PAYMENT',?)`).bind(
        orderId,
        profile.id,
        details,
        amountCents,
        amountCents,
        expiresAt,
      ).run();
      const polar=await createPolarCheckout({
        kind:'CREDITS',
        amountCents,
        orderId,
        profileId:profile.id,
        customerEmail:auth?.email,
        customerName:profile.display_name||profile.username,
        successUrl:`${origin}/checkout/order/${orderId}?provider=polar`,
      });
      await database.prepare('UPDATE checkout_orders SET payment_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(polar.id,orderId).run();
      return Response.json({orderId,checkoutUrl:polar.url,amountCents,currency:'USD'},{status:201});
    }

    if(input.kind==='PRO'){
      const cycle=input.proBillingCycle==='annual'?'annual':'monthly';
      const amountCents=cycle==='annual'?USD_PRO_PRICING.annualCents:USD_PRO_PRICING.monthlyCents;
      const durationDays=cycle==='annual'?365:30;
      const billingPeriod=cycle==='annual'?'yearly':'monthly';
      const orderId=crypto.randomUUID();
      const details=JSON.stringify({
        durationDays,
        billingPeriod,
        currency:'USD',
        paymentProvider:input.paymentMethod==='credits'?'credits':'polar',
        customerName:profile.display_name||profile.username||'Collector',
      });

      if(input.paymentMethod==='credits'){
        const spend=await spendCredits(database,{
          profileId:profile.id,
          amount:amountCents,
          currency:'USD',
          kind:'PRO_PURCHASE',
          referenceId:orderId,
          description:`Market Pro (${billingPeriod}) — $${(amountCents/100).toFixed(2)}`,
        });
        if(!spend.ok)throw new HttpError(402,'Insufficient USD Credits balance.');
        await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,items,details,subtotal,shipping_fee,amount,currency,status,paid_at,fulfilled_at)
          VALUES (?,'PRO',?,'[]',?,?,0,?,'USD','PAID',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(
          orderId,
          profile.id,
          details,
          amountCents,
          amountCents,
        ).run();
        const stmts=[
          database.prepare(`UPDATE profiles SET tier='pro',pro_billing_period=?,pro_expires_at=datetime(max(COALESCE(pro_expires_at,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP), '+' || ? || ' days') WHERE id=?`).bind(billingPeriod,durationDays,profile.id),
        ];
        if(billingPeriod==='yearly'){
          stmts.push(database.prepare(`INSERT OR IGNORE INTO market_pro_voucher_grants (id,order_id,owner_id,voucher_total,starts_at,expires_at)
            SELECT ?,?,?,?,datetime(max(COALESCE(pro_expires_at,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP)),datetime(max(COALESCE(pro_expires_at,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP), '+' || ? || ' days')
            FROM profiles WHERE id=?`).bind(crypto.randomUUID(),orderId,profile.id,MARKET_PRO_SHIPPING_VOUCHERS_PER_YEAR,durationDays,profile.id));
        }
        await database.batch(stmts);
        await sendMarketEmail(profile.id,'pro-activated','Market Pro',orderId).catch(()=>{});
        return Response.json({orderId,paidWithCredits:true,balanceUsd:spend.balance,currency:'USD'},{status:201});
      }

      if(!hasPolarConfig('PRO',cycle)){
        throw new HttpError(503,'USD checkout for Market Pro is temporarily unavailable. Please try again later.');
      }
      const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString().replace('T',' ').slice(0,19);
      await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,items,details,subtotal,shipping_fee,amount,currency,status,expires_at)
        VALUES (?,'PRO',?,'[]',?,?,0,?,'USD','PENDING_PAYMENT',?)`).bind(
        orderId,
        profile.id,
        details,
        amountCents,
        amountCents,
        expiresAt,
      ).run();
      const polar=await createPolarCheckout({
        kind:'PRO',
        proBillingCycle:cycle,
        amountCents,
        orderId,
        profileId:profile.id,
        customerEmail:auth?.email,
        customerName:profile.display_name||profile.username,
        successUrl:`${origin}/checkout/order/${orderId}?provider=polar`,
        extraMetadata:{billingPeriod},
      });
      await database.prepare('UPDATE checkout_orders SET payment_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(polar.id,orderId).run();
      return Response.json({orderId,checkoutUrl:polar.url,amountCents,currency:'USD'},{status:201});
    }

    // BOOST
    const listingId=input.listingId;
    if(!listingId)throw new HttpError(400,'Select a listing to boost.');
    const listing=await database.prepare('SELECT id,seller_id AS sellerId,title,status FROM listings WHERE id=?').bind(listingId).first<{id:string;sellerId:string;title:string;status:string}>();
    if(!listing||listing.sellerId!==profile.id)throw new HttpError(404,'Listing not found.');
    if(listing.status!=='ACTIVE')throw new HttpError(409,'Only active listings can be boosted.');

    const planId=input.boostPlanId??'3d';
    const plan=LISTING_BOOST_PLANS[planId];
    const isPro=profile.tier==='pro';
    const amountCents=isPro?USD_BOOST_CENTS[planId].proAmount:USD_BOOST_CENTS[planId].amount;
    const orderId=crypto.randomUUID();
    const details=JSON.stringify({
      listingId,
      planId,
      durationDays:plan.days,
      currency:'USD',
      paymentProvider:input.paymentMethod==='credits'?'credits':'polar',
    });

    if(input.paymentMethod==='credits'){
      const spend=await spendCredits(database,{
        profileId:profile.id,
        amount:amountCents,
        currency:'USD',
        kind:'BOOST_PURCHASE',
        referenceId:orderId,
        description:`Spotlight Boost (${plan.labelEn}) — $${(amountCents/100).toFixed(2)}`,
      });
      if(!spend.ok)throw new HttpError(402,'Insufficient USD Credits balance.');
      await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,seller_id,listing_id,items,details,subtotal,shipping_fee,amount,currency,status,paid_at,fulfilled_at)
        VALUES (?,'BOOST',?,?,?,'[]',?,?,0,?,'USD','PAID',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(
        orderId,
        profile.id,
        profile.id,
        listingId,
        details,
        amountCents,
        amountCents,
      ).run();
      const boostedUntil=await activateListingBoost(database,{
        listingId,
        sellerId:profile.id,
        planId,
        days:plan.days,
        orderId,
      });
      await sendMarketEmail(profile.id,'listing-boost-activated',listing.title,listingId,{amount:amountCents,currency:'USD',expiresAt:boostedUntil}).catch(()=>{});
      return Response.json({orderId,paidWithCredits:true,boostedUntil,balanceUsd:spend.balance,currency:'USD'},{status:201});
    }

    if(!hasPolarConfig('BOOST')){
      throw new HttpError(503,'USD checkout for Spotlight Boost is temporarily unavailable. Please try again later.');
    }
    const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString().replace('T',' ').slice(0,19);
    await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,seller_id,listing_id,items,details,subtotal,shipping_fee,amount,currency,status,expires_at)
      VALUES (?,'BOOST',?,?,?,'[]',?,?,0,?,'USD','PENDING_PAYMENT',?)`).bind(
      orderId,
      profile.id,
      profile.id,
      listingId,
      details,
      amountCents,
      amountCents,
      expiresAt,
    ).run();
    const polar=await createPolarCheckout({
      kind:'BOOST',
      amountCents,
      orderId,
      profileId:profile.id,
      customerEmail:auth?.email,
      customerName:profile.display_name||profile.username,
      successUrl:`${origin}/checkout/order/${orderId}?provider=polar`,
      extraMetadata:{listingId,planId},
    });
    await database.prepare('UPDATE checkout_orders SET payment_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(polar.id,orderId).run();
    return Response.json({orderId,checkoutUrl:polar.url,amountCents,currency:'USD'},{status:201});
  }catch(error){
    return errorResponse(error);
  }
}
