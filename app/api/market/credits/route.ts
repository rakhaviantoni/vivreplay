import {z} from 'zod';
import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {ALLOWED_CREDIT_TOPUP_AMOUNTS,CREDIT_TOPUP_PACKAGES} from '@/lib/market/credits';
import {getCreditWallet,setAutoRenewPro} from '@/lib/server/credits';

const topupSchema=z.object({
  amount:z.number().int().min(10_000,'Minimum top-up is Rp 10,000.').max(10_000_000,'Maximum top-up is Rp 10,000,000.'),
  paymentMethod:z.string().trim().max(40).default('qris'),
  paymentChannel:z.string().trim().max(40).default('mpm'),
});

const patchSchema=z.object({
  autoRenewPro:z.boolean(),
});

export async function GET(){
  try{
    const profile=await user();
    const wallet=await getCreditWallet(db(),profile.id);
    return Response.json({...wallet,packages:CREDIT_TOPUP_PACKAGES},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    return errorResponse(error);
  }
}

export async function PATCH(request:Request){
  try{
    guard(request);
    const profile=await user();
    const input=patchSchema.parse(await request.json());
    const autoRenewPro=await setAutoRenewPro(db(),profile.id,input.autoRenewPro);
    return Response.json({autoRenewPro});
  }catch(error){
    return errorResponse(error);
  }
}

export async function POST(request:Request){
  try{
    guard(request);
    const profile=await user();
    const input=topupSchema.parse(await request.json());
    const database=db();
    const orderId=crypto.randomUUID();
    const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString().replace('T',' ').slice(0,19);
    const details=JSON.stringify({
      creditAmount:input.amount,
      customerName:profile.display_name||profile.username||'Collector',
      customerPhone:profile.phone||'',
      ipaymuSelectedMethod:input.paymentMethod,
      ipaymuSelectedChannel:input.paymentChannel,
    });
    await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,items,details,subtotal,shipping_fee,amount,currency,status,expires_at)
      VALUES (?,'CREDITS',?,'[]',?,?,0,?,'IDR','PENDING_PAYMENT',?)`).bind(
      orderId,
      profile.id,
      details,
      input.amount,
      input.amount,
      expiresAt,
    ).run();
    return Response.json({
      id:orderId,
      checkoutUrl:`/checkout/order/${orderId}`,
      amount:input.amount,
    },{status:201});
  }catch(error){
    if(error instanceof HttpError)return errorResponse(error);
    return errorResponse(error);
  }
}
