import {z} from 'zod';
import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {getBoostPlanAmount,LISTING_BOOST_PLANS} from '@/lib/market/boost';
import {getListingPolicy} from '@/lib/market/policy';
import {activateListingBoost,consumeProBoostCredit,ensureBoostSchema} from '@/lib/server/listing-boosts';
import {spendCredits} from '@/lib/server/credits';

const schema=z.object({
  listingId:z.string().uuid(),
  planId:z.enum(['24h','3d','7d']).default('3d'),
  useProCredit:z.boolean().optional(),
  payWithCredits:z.boolean().optional(),
  paymentMethod:z.string().trim().max(40).default('qris'),
  paymentChannel:z.string().trim().max(40).default('mpm'),
});

export async function POST(request:Request){
  try{
    guard(request);
    const profile=await user();
    const input=schema.parse(await request.json());
    const database=db();
    await ensureBoostSchema(database);

    const listing=await database.prepare("SELECT id,seller_id AS sellerId,title,status,expires_at AS expiresAt FROM listings WHERE id=?").bind(input.listingId).first<{id:string;sellerId:string;title:string;status:string;expiresAt:string|null}>();
    if(!listing)throw new HttpError(404,'Listing not found.');
    if(listing.sellerId!==profile.id)throw new HttpError(403,'You can only boost your own listings.');
    if(listing.status!=='ACTIVE')throw new HttpError(400,'Only active listings can be boosted.');
    if(listing.expiresAt&&Date.parse(listing.expiresAt)<=Date.now())throw new HttpError(400,'Expired listings cannot be boosted.');

    const isPro=getListingPolicy(profile.tier,profile.pro_billing_period).tier==='pro';
    if(input.useProCredit){
      if(!isPro)throw new HttpError(403,'Monthly Spotlight credits are included with Market Pro.');
      const boostedUntil=await consumeProBoostCredit(database,{listingId:listing.id,sellerId:profile.id});
      if(!boostedUntil)throw new HttpError(409,'You have used all monthly Market Pro Spotlight credits for this month.');
      return Response.json({
        id:`pro-credit-${listing.id}`,
        activated:true,
        boostedUntil,
        amount:0,
        planId:'3d',
        days:3,
      },{status:200});
    }

    const plan=LISTING_BOOST_PLANS[input.planId];
    const amount=getBoostPlanAmount(input.planId,isPro);
    if(input.payWithCredits){
      const spend=await spendCredits(database,{
        profileId:profile.id,
        amount,
        kind:'BOOST',
        referenceId:listing.id,
        description:`${plan.labelEn}: ${listing.title}`,
      });
      if(!spend.ok){
        throw new HttpError(402,'Insufficient VivrePlay Credits balance. Top up credits or pay directly.');
      }
      const boostedUntil=await activateListingBoost(database,{
        listingId:listing.id,
        sellerId:profile.id,
        planId:plan.id,
        days:plan.days,
        orderId:`CREDITS:${Date.now()}`,
      });
      return Response.json({
        id:`credits-boost-${listing.id}`,
        activated:true,
        boostedUntil,
        balance:spend.balance,
        amount,
        planId:plan.id,
        days:plan.days,
      },{status:200});
    }
    const orderId=crypto.randomUUID();
    const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString().replace('T',' ').slice(0,19);
    const details=JSON.stringify({
      listingId:listing.id,
      listingTitle:listing.title,
      planId:plan.id,
      durationDays:plan.days,
      proDiscountApplied:isPro,
      customerName:profile.display_name||profile.username||'Seller',
      customerPhone:profile.phone||'',
      ipaymuSelectedMethod:input.paymentMethod,
      ipaymuSelectedChannel:input.paymentChannel,
    });

    await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,seller_id,listing_id,items,details,subtotal,shipping_fee,amount,currency,status,expires_at)
      VALUES (?,'BOOST',?,?,?,'[]',?,?,0,?,'IDR','PENDING_PAYMENT',?)`).bind(
      orderId,
      profile.id,
      profile.id,
      listing.id,
      details,
      amount,
      amount,
      expiresAt,
    ).run();

    return Response.json({
      id:orderId,
      checkoutUrl:`/checkout/order/${orderId}`,
      amount,
      planId:plan.id,
      days:plan.days,
    },{status:201});
  }catch(error){
    return errorResponse(error);
  }
}
