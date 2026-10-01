import {z} from 'zod';
import {db,errorResponse,user,HttpError} from '@/lib/server/store';
import {createAzekhaInstrument} from '@/lib/server/azekha-payments';

const schema=z.object({method:z.enum(['qris','va','ewallet']),channel:z.string().min(2).max(24)});
const channels:Record<string,Set<string>>={qris:new Set(['mpm']),va:new Set(['bca','bni','bri','mandiri','cimb','permata','bsi','danamon','bmi','bag','btn']),ewallet:new Set(['dana','shopeepay'])};

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();
    const {id}=await params;
    const order=await db().prepare('SELECT buyer_id AS buyerId,payment_id AS paymentId,status,expires_at AS expiresAt FROM checkout_orders WHERE id=?').bind(id).first<{buyerId:string;paymentId:string|null;status:string;expiresAt:string|null}>();
    if(!order||order.buyerId!==profile.id)throw new HttpError(404,'Checkout was not found.');
    if(order.status!=='PENDING_PAYMENT'||!order.paymentId)throw new HttpError(409,'This checkout is no longer payable.');
    if(order.expiresAt&&new Date(`${order.expiresAt.replace(' ','T')}Z`).getTime()<=Date.now()){
      await db().prepare("UPDATE checkout_orders SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT'").bind(id).run();
      throw new HttpError(409,'This checkout has expired. Start a new checkout to continue.');
    }
    const selection=schema.parse(await request.json());
    if(!channels[selection.method].has(selection.channel))throw new HttpError(400,'Choose a supported payment channel.');
    const instrument=await createAzekhaInstrument(order.paymentId,selection.method,selection.channel);
    return Response.json({instrument});
  }catch(error){return errorResponse(error)}
}
