import {db,errorResponse,guard,user,optionalUser,HttpError} from '@/lib/server/store';
import {getCurrentUser} from '@/lib/server/auth';
import {hasMarketIpaymuPaymentConfig} from '@/lib/server/ipaymu';
import {getDynamicListingPolicy,MARKET_BUYER_FEE_PERCENT,MARKET_PRO_BUYER_FEE_PERCENT,MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH,MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,MARKET_PRO_SHIPPING_VOUCHER_SHARE,MARKET_PRO_SHIPPING_VOUCHER_CAP} from '@/lib/market/policy';

const PAID_INTRO_STATUSES="'PROCESSING','PAID','COMPLETED'";

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
    const intro=await introStatus(profile?.id);
    const canBuyIntro=intro.eligible&&profile?.tier!=='pro';
    const available=hasMarketIpaymuPaymentConfig()&&Boolean(pricing.amount&&pricing.durationDays);
    return Response.json({
      available,
      amount:canBuyIntro?pricing.introAmount:pricing.amount,
      standardAmount:pricing.amount,
      durationDays:pricing.durationDays,
      introOffer:canBuyIntro,
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
      canAutoRenew:policy.canAutoRenew,
      freeCanAutoRenew:freePolicy.canAutoRenew,
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
    const name=String(profile.display_name||account.name||account.email.split('@')[0]||'VivrePlay member').trim();
    const phone=String(profile.phone??'').replace(/[\s().-]/g,'');
    if(!/^\+?[0-9]{8,16}$/.test(phone))throw new HttpError(400,'Add a valid phone number to your profile before continuing.');

    const database=db();
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
          ))`).bind(orderId,profile.id,details,introPrice,expiresAt,pricing.introEndsAt,pricing.introLimit,profile.id).run();
      introOffer=Number(result.meta?.changes??0)>0;
      if(!introOffer){
        const retry=(await database.prepare(`SELECT id FROM checkout_orders WHERE kind='PRO' AND buyer_id=? AND json_extract(details,'$.introOffer')=1
          AND status='PENDING_PAYMENT' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) ORDER BY created_at DESC LIMIT 1`).bind(profile.id).first<{id:string}>())?.id;
        if(retry)return Response.json({id:retry,checkoutUrl:`/checkout/order/${encodeURIComponent(retry)}`,introOffer:true},{status:200});
        if(body.introOffer===true)throw new HttpError(409,'The launch offer just ran out. Refresh the page to see the current price.');
      }
    }
    const finalAmount=introOffer?introPrice!:amount;
    if(!introOffer){
      const details=JSON.stringify({durationDays,customerName:name,customerPhone:phone,introOffer:false});
      await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,items,details,subtotal,shipping_fee,amount,currency,status,expires_at) VALUES (?,'PRO',?,'[]',?,?,0,?,'IDR','PENDING_PAYMENT',?)`).bind(orderId,profile.id,details,finalAmount,finalAmount,expiresAt).run();
    }
    return Response.json({id:orderId,checkoutUrl:`/checkout/order/${orderId}`,introOffer,amount:finalAmount},{status:201});
  }catch(error){return errorResponse(error)}
}
