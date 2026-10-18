import {db,errorResponse,guard,user,optionalUser,HttpError} from '@/lib/server/store';
import {getCurrentUser} from '@/lib/server/auth';
import {createIpaymuDirectPayment,getEnabledIpaymuPaymentChannels,getIpaymuPaymentChannels,hasMarketIpaymuPaymentConfig,ipaymuExpiryTimestamp} from '@/lib/server/ipaymu';
import {fetchMarketPolicies,MARKET_BUYER_FEE_CAP,MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH,MARKET_PRO_SHIPPING_VOUCHER_SHARE,MARKET_PRO_SHIPPING_VOUCHER_CAP} from '@/lib/market/policy';
import {getProPricing} from '@/lib/market/pro-pricing';

const PAID_INTRO_STATUSES="'PROCESSING','PAID','COMPLETED'";

async function introStatus(profileId?:string|null,checkCapacity=true,knownPricing?:Awaited<ReturnType<typeof getProPricing>>){
  const database=db();
  const pricing=knownPricing??await getProPricing(database);
  const claimed=checkCapacity?(await database.prepare(`SELECT COUNT(DISTINCT buyer_id) AS total FROM checkout_orders
    WHERE kind='PRO' AND json_extract(details,'$.introOffer')=1 AND (
      status IN ('PAYMENT_REVIEW','PROCESSING','PAID','COMPLETED') OR
      (status='PENDING_PAYMENT' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))
    )`).first<{total:number}>())?.total??0:0;
  let priorPaid=false;
  let pendingOrderId:string|null=null;
  if(profileId){
    priorPaid=Boolean(await database.prepare(`SELECT 1 FROM checkout_orders WHERE kind='PRO' AND buyer_id=?
      AND json_extract(details,'$.introOffer')=1 AND status IN (${PAID_INTRO_STATUSES}) LIMIT 1`).bind(profileId).first());
    pendingOrderId=(await database.prepare(`SELECT id FROM checkout_orders WHERE kind='PRO' AND buyer_id=?
      AND json_extract(details,'$.introOffer')=1 AND status='PENDING_PAYMENT'
      AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) ORDER BY created_at DESC LIMIT 1`).bind(profileId).first<{id:string}>())?.id??null;
  }
  const promoOpen=Boolean(pricing.introAmount&&pricing.introEndsAt&&Date.now()<Date.parse(pricing.introEndsAt));
  const spotsRemaining=checkCapacity&&pricing.introLimit>0?Math.max(0,pricing.introLimit-claimed):null;
  const hasCapacity=!checkCapacity||pricing.introLimit===0||(spotsRemaining??0)>0||Boolean(pendingOrderId);
  return {promoOpen,spotsRemaining,eligible:promoOpen&&!priorPaid&&hasCapacity,pendingOrderId,priorPaid};
}

export async function GET(){
  try{
    const database=db();
    const [pricing,policies,profile]=await Promise.all([
      getProPricing(database),fetchMarketPolicies(database),optionalUser().catch(()=>null),
    ]);
    const policy=policies.pro;
    const freePolicy=policies.free;
    const intro=await introStatus(profile?.id,true,pricing).catch(()=>({promoOpen:false,spotsRemaining:null,eligible:false,pendingOrderId:null,priorPaid:false}));
    const canBuyIntro=intro.eligible&&profile?.tier!=='pro';
    const available=hasMarketIpaymuPaymentConfig()&&Boolean(pricing.amount&&pricing.durationDays);
    let paymentChannels=[] as Awaited<ReturnType<typeof getEnabledIpaymuPaymentChannels>>;
    let paymentChannelStatus:'not_configured'|'provider_unavailable'|'settings_unavailable'|'no_active_channels'|'all_disabled'|'ready'='not_configured';
    if(hasMarketIpaymuPaymentConfig()){
      let reportedChannels:Awaited<ReturnType<typeof getIpaymuPaymentChannels>>=[];
      try{reportedChannels=await getIpaymuPaymentChannels()}catch{paymentChannelStatus='provider_unavailable'}
      if(reportedChannels.length){try{paymentChannels=await getEnabledIpaymuPaymentChannels(database);paymentChannelStatus=paymentChannels.length?'ready':'all_disabled'}catch{paymentChannelStatus='settings_unavailable'}}
      else if(paymentChannelStatus!=='provider_unavailable')paymentChannelStatus='no_active_channels';
    }
    return Response.json({
      available,
      paymentChannels,
      paymentChannelStatus,
      amount:canBuyIntro?pricing.introAmount:pricing.amount,
      standardAmount:pricing.amount,
      durationDays:pricing.durationDays,
      annualAmount:pricing.annualAmount,
      annualDurationDays:pricing.annualDurationDays,
      introOffer:canBuyIntro,
      introOfferEndsAt:intro.promoOpen?pricing.introEndsAt:null,
      introOfferLimit:intro.promoOpen?pricing.introLimit:null,
      introOfferSpotsRemaining:intro.promoOpen?intro.spotsRemaining:null,
      maxActiveListings:policy.maxActiveListings,
      freeMaxActiveListings:freePolicy.maxActiveListings,
      freeDurationDays:freePolicy.durationDays,
      commissionPercent:policy.commissionPercent,
      freeCommissionPercent:freePolicy.commissionPercent,
      sellerFeeMinimum:policies.sellerFeeMinimum,
      buyerFeePercent:policy.commissionPercent,
      freeBuyerFeePercent:freePolicy.commissionPercent,
      buyerFeeCap:MARKET_BUYER_FEE_CAP,
      buyerFeeMinimum:policies.buyerFeeMinimum,
      shippingVouchersPerMonth:MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH,
      shippingVoucherMinSubtotal:policies.shippingVoucherMinSubtotal,
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
    const body=await request.json().catch(()=>({})) as {introOffer?:boolean;paymentMethod?:string;paymentChannel?:string;billingPeriod?:'monthly'|'yearly'};
    const profile=await user();
    const account=await getCurrentUser();
    if(!account?.email)throw new HttpError(401,'Sign in with an email address to continue.');
    const pricing=await getProPricing(db());
    const billingPeriod=body.billingPeriod==='yearly'?'yearly':'monthly';
    const amount=billingPeriod==='yearly'?pricing.annualAmount:pricing.amount;
    const durationDays=billingPeriod==='yearly'?pricing.annualDurationDays:pricing.durationDays;
    if(!hasMarketIpaymuPaymentConfig()||!amount||!durationDays)throw new HttpError(503,'Market Pro checkout is temporarily unavailable.');
    const paymentMethod=body.paymentMethod??'qris';
    const paymentChannel=body.paymentChannel??'mpm';
    if(!['va','cstore','qris','cc','paylater','ewallet'].includes(paymentMethod)||!(/^[a-z0-9_]{2,24}$/.test(paymentChannel)))throw new HttpError(400,'Choose a valid payment method.');
    const channels=await getEnabledIpaymuPaymentChannels(db()).catch(()=>[]);
    if(!channels.some(channel=>channel.method===paymentMethod&&channel.channel===paymentChannel))throw new HttpError(409,'That payment option is temporarily unavailable. Choose another method.');
    if(profile.tier==='pro'&&billingPeriod!=='yearly')throw new HttpError(409,'Your Pro membership is already active. Choose the annual plan to extend it.');
    const name=String(profile.display_name||account.name||account.email.split('@')[0]||'VivrePlay member').trim();
    const phone=String(profile.phone??'').replace(/[\s().-]/g,'');
    if(!/^\+?[0-9]{8,16}$/.test(phone))throw new HttpError(400,'Add a valid phone number to your profile before continuing.');

    const database=db();
    const pendingOrders=(await database.prepare(`SELECT id,details,expires_at AS expiresAt,updated_at AS updatedAt
      FROM checkout_orders WHERE kind='PRO' AND buyer_id=? AND status='PENDING_PAYMENT'
      ORDER BY created_at DESC LIMIT 20`).bind(profile.id).all<{id:string;details:string;expiresAt:string|null;updatedAt:string|null}>()).results;
    let resumableOrder:{id:string;details:string}|null=null;
    for(const pendingOrder of pendingOrders){
      let pendingDetails:Record<string,unknown>={};
      try{const parsed=JSON.parse(pendingOrder.details) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))pendingDetails=parsed as Record<string,unknown>}catch{}
      const pendingPaymentExpiry=pendingDetails.ipaymuPaymentMethod
        ?ipaymuExpiryTimestamp(pendingDetails.ipaymuPaymentExpiresAt,pendingDetails.ipaymuPaymentCreatedAt,pendingOrder.updatedAt)
        :null;
      const pendingStoredExpiry=pendingOrder.expiresAt?Date.parse(`${pendingOrder.expiresAt.replace(' ','T')}Z`):null;
      const pendingExpiry=pendingPaymentExpiry??(pendingStoredExpiry!==null&&Number.isFinite(pendingStoredExpiry)?pendingStoredExpiry:null);
      const pendingPeriod=pendingDetails.billingPeriod==='yearly'?'yearly':'monthly';
      if(pendingPeriod!==billingPeriod)continue;
      if(pendingExpiry===null||pendingExpiry>Date.now()){
        resumableOrder={id:pendingOrder.id,details:pendingOrder.details};
        break;
      }
      await database.prepare(`UPDATE checkout_orders SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND buyer_id=? AND kind='PRO' AND status='PENDING_PAYMENT'`).bind(pendingOrder.id,profile.id).run();
    }
    if(resumableOrder){
      let pendingDetails:Record<string,unknown>={};
      try{const parsed=JSON.parse(resumableOrder.details) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))pendingDetails=parsed as Record<string,unknown>}catch{}
      return Response.json({id:resumableOrder.id,checkoutUrl:`/checkout/order/${encodeURIComponent(resumableOrder.id)}`,introOffer:Boolean(pendingDetails.introOffer)},{status:200});
    }
    const intro=await introStatus(profile.id,true,pricing);
    if(billingPeriod==='monthly'&&intro.pendingOrderId)return Response.json({id:intro.pendingOrderId,checkoutUrl:`/checkout/order/${encodeURIComponent(intro.pendingOrderId)}`,introOffer:true,billingPeriod},{status:200});
    if(billingPeriod==='monthly'&&body.introOffer===true&&!intro.eligible)throw new HttpError(409,'The launch offer is no longer available. Refresh the page to see the current price.');

    const orderId=crypto.randomUUID();
    const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString().replace('T',' ').slice(0,19);
    const introPrice=pricing.introAmount;
    let introOffer=false;
    if(billingPeriod==='monthly'&&body.introOffer!==false&&intro.eligible&&introPrice&&pricing.introEndsAt){
      const details=JSON.stringify({durationDays,billingPeriod,customerName:name,customerPhone:phone,introOffer:true,ipaymuSelectedMethod:paymentMethod,ipaymuSelectedChannel:paymentChannel});
      const result=await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,items,details,subtotal,shipping_fee,amount,currency,status,expires_at)
        SELECT ?,'PRO',?,'[]',?,?,0,?,'IDR','PENDING_PAYMENT',?
        WHERE julianday(?)>julianday('now')
          AND (?=0 OR (SELECT COUNT(DISTINCT buyer_id) FROM checkout_orders WHERE kind='PRO' AND json_extract(details,'$.introOffer')=1 AND (
            status IN ('PAYMENT_REVIEW','PROCESSING','PAID','COMPLETED') OR
            (status='PENDING_PAYMENT' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))
          )) < ?)
          AND NOT EXISTS(SELECT 1 FROM checkout_orders WHERE kind='PRO' AND buyer_id=? AND json_extract(details,'$.introOffer')=1 AND (
            status IN ('PAYMENT_REVIEW','PROCESSING','PAID','COMPLETED') OR
            (status='PENDING_PAYMENT' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))
          ))`).bind(orderId,profile.id,details,introPrice,introPrice,expiresAt,pricing.introEndsAt,pricing.introLimit,pricing.introLimit,profile.id).run();
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
      const details=JSON.stringify({durationDays,billingPeriod,customerName:name,customerPhone:phone,introOffer:false,ipaymuSelectedMethod:paymentMethod,ipaymuSelectedChannel:paymentChannel});
      await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,items,details,subtotal,shipping_fee,amount,currency,status,expires_at) VALUES (?,'PRO',?,'[]',?,?,0,?,'IDR','PENDING_PAYMENT',?)`).bind(orderId,profile.id,details,finalAmount,finalAmount,expiresAt).run();
    }
    const baseUrl=process.env.VIVREPLAY_PUBLIC_URL?.trim().replace(/\/$/,'')||'https://vivreplay.com';
    const origin=process.env.IPAYMU_MODE==='sandbox'?new URL(request.url).origin:baseUrl;
    const notifyUrl=process.env.IPAYMU_CALLBACK_URL?.trim()||`${origin}/api/checkout/ipaymu/callback`;
    try{
      const payment=await createIpaymuDirectPayment({orderId,amount:finalAmount,buyer:{name,email:account.email,phone},returnUrl:`${origin}/checkout/order/${encodeURIComponent(orderId)}`,notifyUrl,method:paymentMethod as 'va'|'cstore'|'qris'|'cc'|'paylater'|'ewallet',channel:paymentChannel});
      if(payment.sessionId){
        const proDetails={durationDays,billingPeriod,customerName:name,customerPhone:phone,introOffer,ipaymuSelectedMethod:paymentMethod,ipaymuSelectedChannel:paymentChannel,ipaymuPaymentMethod:payment.paymentMethod,ipaymuPaymentChannel:payment.paymentChannel,ipaymuPaymentName:payment.paymentName??paymentChannel.toUpperCase(),ipaymuPaymentNo:payment.paymentNo,ipaymuPaymentInstructionsUrl:payment.instructionsUrl,ipaymuCheckoutUrl:payment.checkoutUrl,ipaymuPaymentQrImage:payment.qrImage,ipaymuPaymentQrString:payment.qrString,ipaymuTransactionId:payment.transactionId,ipaymuSessionId:payment.sessionId,ipaymuPaymentFee:payment.fee,ipaymuPaymentTotal:payment.paymentMethod==='qris'?finalAmount:Math.max(payment.total,finalAmount+(payment.fee??0)),ipaymuPaymentCreatedAt:payment.paymentCreatedAt,ipaymuPaymentExpiresAt:payment.expiresAt,ipaymuMode:process.env.IPAYMU_MODE==='sandbox'?'sandbox':'production'};
        const paymentExpirySql=payment.expiresAt?new Date(payment.expiresAt).toISOString().slice(0,19).replace('T',' '):expiresAt;
        await database.prepare("UPDATE checkout_orders SET payment_id=?,details=?,expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(payment.sessionId,JSON.stringify(proDetails),paymentExpirySql,orderId).run();
      }
    }catch{}
    return Response.json({id:orderId,checkoutUrl:`/checkout/order/${orderId}`,introOffer,amount:finalAmount,billingPeriod},{status:201});
  }catch(error){return errorResponse(error)}
}
