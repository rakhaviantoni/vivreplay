import {z} from 'zod';
import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {LISTING_BOOST_PLANS} from '@/lib/market/boost';
import {ensureBoostSchema} from '@/lib/server/listing-boosts';

const schema=z.object({
  listingId:z.string().uuid(),
  planId:z.enum(['3d','7d']).default('3d'),
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

    const listing=await database.prepare("SELECT id,seller_id AS sellerId,title,status FROM listings WHERE id=?").bind(input.listingId).first<{id:string;sellerId:string;title:string;status:string}>();
    if(!listing)throw new HttpError(404,'Listing not found.');
    if(listing.sellerId!==profile.id)throw new HttpError(403,'You can only boost your own listings.');
    if(listing.status!=='ACTIVE')throw new HttpError(400,'Only active listings can be boosted.');

    const plan=LISTING_BOOST_PLANS[input.planId];
    const orderId=crypto.randomUUID();
    const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString().replace('T',' ').slice(0,19);
    const details=JSON.stringify({
      listingId:listing.id,
      listingTitle:listing.title,
      planId:plan.id,
      durationDays:plan.days,
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
      plan.amount,
      plan.amount,
      expiresAt,
    ).run();

    return Response.json({
      id:orderId,
      checkoutUrl:`/checkout/order/${orderId}`,
      amount:plan.amount,
      planId:plan.id,
      days:plan.days,
    },{status:201});
  }catch(error){
    return errorResponse(error);
  }
}
