import {db,errorResponse,guard,user,HttpError} from '@/lib/server/store';
import {getCurrentUser} from '@/lib/server/auth';
import {hasIpaymuPaymentConfig} from '@/lib/server/ipaymu';
import {getDynamicListingPolicy,MARKET_BUYER_FEE_PERCENT,MARKET_PRO_BUYER_FEE_PERCENT,MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH,MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,MARKET_PRO_SHIPPING_VOUCHER_SHARE,MARKET_PRO_SHIPPING_VOUCHER_CAP} from '@/lib/market/policy';

export async function GET(){
  const amount=Number(process.env.VIVREPLAY_PRO_PRICE_IDR);
  const durationDays=Number(process.env.VIVREPLAY_PRO_DURATION_DAYS);
  const policy=await getDynamicListingPolicy('pro',db());
  return Response.json({available:hasIpaymuPaymentConfig()&&Number.isSafeInteger(amount)&&amount>0&&Number.isInteger(durationDays)&&durationDays>0,amount:Number.isSafeInteger(amount)&&amount>0?amount:null,durationDays:Number.isInteger(durationDays)&&durationDays>0?durationDays:null,maxActiveListings:policy.maxActiveListings,commissionPercent:policy.commissionPercent,freeCommissionPercent:(await getDynamicListingPolicy('free',db())).commissionPercent,buyerFeePercent:MARKET_PRO_BUYER_FEE_PERCENT,freeBuyerFeePercent:MARKET_BUYER_FEE_PERCENT,shippingVouchersPerMonth:MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH,shippingVoucherMinSubtotal:MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,shippingVoucherSharePercent:MARKET_PRO_SHIPPING_VOUCHER_SHARE*100,shippingVoucherCap:MARKET_PRO_SHIPPING_VOUCHER_CAP,canAutoRenew:policy.canAutoRenew,currency:'IDR'});
}

export async function POST(request:Request){
  try{
    guard(request);
    const profile=await user();
    const account=await getCurrentUser();
    if(!account?.email)throw new HttpError(401,'Sign in with an email address to continue.');
    const amount=Number(process.env.VIVREPLAY_PRO_PRICE_IDR);
    const durationDays=Number(process.env.VIVREPLAY_PRO_DURATION_DAYS);
    if(!hasIpaymuPaymentConfig()||!Number.isSafeInteger(amount)||amount<1||!Number.isInteger(durationDays)||durationDays<1)throw new HttpError(503,'Market Pro checkout is temporarily unavailable.');
    if(profile.tier==='pro')throw new HttpError(409,'Your account already has an active Pro plan.');
    const payload=await request.json().catch(()=>({})) as {name?:unknown;phone?:unknown};
    const name=typeof payload.name==='string'?payload.name.trim():profile.display_name;
    const phone=typeof payload.phone==='string'?payload.phone.replace(/[\s()-]/g,''):'';
    if(!name||!/^\+?[0-9]{8,16}$/.test(phone))throw new HttpError(400,'Enter a name and a valid mobile number to continue.');
    const orderId=crypto.randomUUID();
    const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString().replace('T',' ').slice(0,19);
    const database=db();
    await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,items,details,subtotal,shipping_fee,amount,currency,status,expires_at) VALUES (?,'PRO',?,'[]',?,?,0,?,'IDR','PENDING_PAYMENT',?)`).bind(orderId,profile.id,JSON.stringify({durationDays,customerName:name,customerPhone:phone}),amount,amount,expiresAt).run();
    return Response.json({id:orderId,checkoutUrl:`/checkout/order/${orderId}`},{status:201});
  }catch(error){return errorResponse(error)}
}
