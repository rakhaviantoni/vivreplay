import {db,errorResponse,guard,user,optionalUser,HttpError} from '@/lib/server/store';
import {getCurrentUser} from '@/lib/server/auth';
import {hasMarketIpaymuPaymentConfig} from '@/lib/server/ipaymu';
import {getDynamicListingPolicy,MARKET_BUYER_FEE_PERCENT,MARKET_PRO_BUYER_FEE_PERCENT,MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH,MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,MARKET_PRO_SHIPPING_VOUCHER_SHARE,MARKET_PRO_SHIPPING_VOUCHER_CAP} from '@/lib/market/policy';

const PAID_INTRO_STATUSES="'PROCESSING','PAID','COMPLETED'";
type PendingProOrder={id:string;amount:number;currency:string;details:string;expiresAt:string|null};

async function pendingProOrder(profileId:string){
  return db().prepare(`SELECT id,amount,currency,details,expires_at AS expiresAt FROM checkout_orders
    WHERE kind='PRO' AND buyer_id=? AND status='PENDING_PAYMENT' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)
    ORDER BY created_at DESC LIMIT 1`).bind(profileId).first<PendingProOrder>();
}

function proPricing(){
  const amount=Number(process.env.VIVREPLAY_PRO_PRICE_IDR);
  const durationDays=Number(process.env.VIVREPLAY_PRO_DURATION_DAYS);
  const introAmount=Number(process.env.VIVREPLAY_PRO_INTRO_PRICE_IDR);
  const introEndsAt=process.env.VIVREPLAY_PRO_INTRO_END_AT??'';
  const parsedEnd=Date.parse(introEndsAt);
  const introLimit=Number(process.env.VIVREPLAY_PRO_INTRO_LIMIT);
  return {
    amount:Number.isSafeInteger(amount)&&amount>0?amount:null,
    durationDays:Number.isInteger(durationDays)&&durationDays>0?durationDays:null,
    introAmount:Number.isSafeInteger(introAmount)&&introAmount>0?introAmount:null,
    introEndsAt:Number.isFinite(parsedEnd)?new Date(parsedEnd).toISOString():null,
    introLimit:Number.isSafeInteger(introLimit)&&introLimit>0?introLimit:0,
  };
}

async function introStatus(profileId?:string|null){
  const database=db();
  const pricing=proPricing();
  const claimed=(await database.prepare(`SELECT COUNT(DISTINCT buyer_id) AS total FROM checkout_orders
    WHERE kind='PRO' AND json_extract(details,'$.introOffer')=1 AND (
      status IN ('PAYMENT_REVIEW','PROCESSING','PAID','COMPLETED') OR
      (status='PENDING_PAYMENT' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))
    )`).first<{total:number}>())?.total??0;
  let priorPaid=false;
  let pendingOrderId:string|null=null;
  if(profileId){
    priorPaid=Boolean(await database.prepare(`SELECT 1 FROM checkout_orders WHERE kind='PRO' AND buyer_id=?
      AND json_extract(details,'$.introOffer')=1 AND status IN (${PAID_INTRO_STATUSES}) LIMIT 1`).bind(profileId).first());
    pendingOrderId=(await database.prepare(`SELECT id FROM checkout_orders WHERE kind='PRO' AND buyer_id=?
      AND json_extract(details,'$.introOffer')=1 AND status='PENDING_PAYMENT'
      AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) ORDER BY created_at DESC LIMIT 1`).bind(profileId).first<{id:string}>())?.id??null;
  }
  const promoOpen=Boolean(pricing.introAmount&&pricing.introLimit&&pricing.introEndsAt&&Date.now()<Date.parse(pricing.introEndsAt));
  const spotsRemaining=Math.max(0,pricing.introLimit-claimed);
  return {promoOpen,spotsRemaining,eligible:promoOpen&&!priorPaid&&(spotsRemaining>0||Boolean(pendingOrderId)),pendingOrderId,priorPaid};
}

export async function GET(){
  try{
    const pricing=proPricing();
    const database=db();
    const [policy,freePolicy,profile]=await Promise.all([
      getDynamicListingPolicy('pro',database),getDynamicListingPolicy('free',database),optionalUser().catch(()=>null),
    ]);
    const [intro,deliveryAverage,pending]=await Promise.all([
      introStatus(profile?.id),
      profile?database.prepare(`SELECT ROUND(AVG(shipping_fee)) AS average FROM checkout_orders
        WHERE kind='MARKET' AND buyer_id=? AND status IN ('PROCESSING','PAID','SHIPPED','COMPLETED')
          AND subtotal>=? AND shipping_fee>0 AND created_at>=datetime('now','-180 days')`)
        .bind(profile.id,MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL).first<{average:number|null}>():Promise.resolve(null),
      profile?pendingProOrder(profile.id):Promise.resolve(null),
    ]);
    let pendingDetails:Record<string,unknown>={};try{pendingDetails=JSON.parse(pending?.details??'{}') as Record<string,unknown>}catch{}
    const canBuyIntro=!pending&&intro.eligible&&profile?.tier!=='pro';
    const available=hasMarketIpaymuPaymentConfig()&&Boolean(pricing.amount&&pricing.durationDays);
    return Response.json({
      available,
      amount:pending?.amount??(canBuyIntro?pricing.introAmount:pricing.amount),
      standardAmount:pricing.amount,
      durationDays:pricing.durationDays,
      introOffer:pending?pendingDetails.introOffer===true:canBuyIntro,
      introOfferEndsAt:canBuyIntro?pricing.introEndsAt:null,
      introOfferSpotsRemaining:canBuyIntro?intro.spotsRemaining:null,
      maxActiveListings:policy.maxActiveListings,
      freeMaxActiveListings:freePolicy.maxActiveListings,
      freeDurationDays:freePolicy.durationDays,
      commissionPercent:policy.commissionPercent,
      freeCommissionPercent:freePolicy.commissionPercent,
      buyerFeePercent:MARKET_PRO_BUYER_FEE_PERCENT,
      freeBuyerFeePercent:MARKET_BUYER_FEE_PERCENT,
      shippingVouchersPerMonth:MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH,
      shippingVoucherMinSubtotal:MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,
      shippingVoucherSharePercent:MARKET_PRO_SHIPPING_VOUCHER_SHARE*100,
      shippingVoucherCap:MARKET_PRO_SHIPPING_VOUCHER_CAP,
      typicalDeliveryAmount:deliveryAverage?.average===null||deliveryAverage?.average===undefined?null:Math.max(0,Math.round(deliveryAverage.average)),
      canAutoRenew:policy.canAutoRenew,
      freeCanAutoRenew:freePolicy.canAutoRenew,
      pendingOrder:pending?{id:pending.id,amount:pending.amount,currency:pending.currency,expiresAt:pending.expiresAt}:null,
      currency:'IDR',
    },{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}

export async function POST(request:Request){
  try{
    guard(request);
    const body=await request.json().catch(()=>({})) as {introOffer?:boolean};
    const profile=await user();
    const account=await getCurrentUser();
    if(!account?.email)throw new HttpError(401,'Sign in with an email address to continue.');
    const pricing=proPricing();
    const amount=pricing.amount;
    const durationDays=pricing.durationDays;
    if(!hasMarketIpaymuPaymentConfig()||!amount||!durationDays)throw new HttpError(503,'Market Pro checkout is temporarily unavailable.');
    if(profile.tier==='pro')throw new HttpError(409,'Your account already has an active Pro plan.');
    const database=db();
    await database.prepare(`UPDATE checkout_orders SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP
      WHERE kind='PRO' AND buyer_id=? AND status='PENDING_PAYMENT' AND expires_at IS NOT NULL AND expires_at<=CURRENT_TIMESTAMP`).bind(profile.id).run();
    const pending=await pendingProOrder(profile.id);
    if(pending)return Response.json({id:pending.id,checkoutUrl:`/checkout/order/${encodeURIComponent(pending.id)}`,amount:pending.amount,introOffer:(()=>{try{return (JSON.parse(pending.details) as {introOffer?:boolean}).introOffer===true}catch{return false}})()},{status:200});
    const name=String(profile.display_name||account.name||account.email.split('@')[0]||'VivrePlay member').trim();
    const phone=String(profile.phone??'').replace(/[\s().-]/g,'');
    if(!/^\+?[0-9]{8,16}$/.test(phone))throw new HttpError(400,'Add a valid phone number to your profile before continuing.');

    const intro=await introStatus(profile.id);
    if(intro.pendingOrderId)return Response.json({id:intro.pendingOrderId,checkoutUrl:`/checkout/order/${encodeURIComponent(intro.pendingOrderId)}`,introOffer:true},{status:200});
    if(body.introOffer===true&&!intro.eligible)throw new HttpError(409,'The launch offer is no longer available. Refresh the page to see the current price.');

    const orderId=crypto.randomUUID();
    const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString().replace('T',' ').slice(0,19);
    const introPrice=pricing.introAmount;
    let introOffer=false;
    if(body.introOffer!==false&&intro.eligible&&introPrice&&pricing.introEndsAt){
      const details=JSON.stringify({durationDays,customerName:name,customerPhone:phone,introOffer:true});
      const result=await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,items,details,subtotal,shipping_fee,amount,currency,status,expires_at)
        SELECT ?,'PRO',?,'[]',?,?,0,?,'IDR','PENDING_PAYMENT',?
        WHERE julianday(?)>julianday('now')
          AND (SELECT COUNT(DISTINCT buyer_id) FROM checkout_orders WHERE kind='PRO' AND json_extract(details,'$.introOffer')=1 AND (
            status IN ('PAYMENT_REVIEW','PROCESSING','PAID','COMPLETED') OR
            (status='PENDING_PAYMENT' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))
          )) < ?
          AND NOT EXISTS(SELECT 1 FROM checkout_orders WHERE kind='PRO' AND buyer_id=? AND json_extract(details,'$.introOffer')=1 AND (
            status IN ('PAYMENT_REVIEW','PROCESSING','PAID','COMPLETED') OR
            (status='PENDING_PAYMENT' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))
          ))
          AND NOT EXISTS(SELECT 1 FROM checkout_orders WHERE kind='PRO' AND buyer_id=? AND status='PENDING_PAYMENT' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))`)
        .bind(orderId,profile.id,details,introPrice,expiresAt,pricing.introEndsAt,pricing.introLimit,profile.id,profile.id).run();
      introOffer=Number(result.meta?.changes??0)>0;
      if(!introOffer){
        const retry=await pendingProOrder(profile.id);
        if(retry)return Response.json({id:retry.id,checkoutUrl:`/checkout/order/${encodeURIComponent(retry.id)}`,amount:retry.amount,introOffer:(()=>{try{return (JSON.parse(retry.details) as {introOffer?:boolean}).introOffer===true}catch{return false}})()},{status:200});
        if(body.introOffer===true)throw new HttpError(409,'The launch offer just ran out. Refresh the page to see the current price.');
      }
    }
    const finalAmount=introOffer?introPrice!:amount;
    const details=JSON.stringify({durationDays,customerName:name,customerPhone:phone,introOffer});
    const created=await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,items,details,subtotal,shipping_fee,amount,currency,status,expires_at)
      SELECT ?,'PRO',?,'[]',?,?,0,?,'IDR','PENDING_PAYMENT',?
      WHERE NOT EXISTS(SELECT 1 FROM checkout_orders WHERE kind='PRO' AND buyer_id=? AND status='PENDING_PAYMENT' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))`)
      .bind(orderId,profile.id,details,finalAmount,finalAmount,expiresAt,profile.id).run();
    if(!created.meta.changes){
      const retry=await pendingProOrder(profile.id);
      if(retry)return Response.json({id:retry.id,checkoutUrl:`/checkout/order/${encodeURIComponent(retry.id)}`,amount:retry.amount,introOffer:(()=>{try{return (JSON.parse(retry.details) as {introOffer?:boolean}).introOffer===true}catch{return false}})()},{status:200});
      throw new HttpError(409,'A Market Pro checkout is already being created. Refresh and continue that payment.');
    }
    return Response.json({id:orderId,checkoutUrl:`/checkout/order/${orderId}`,introOffer,amount:finalAmount},{status:201});
  }catch(error){return errorResponse(error)}
}
