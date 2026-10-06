import {z} from 'zod';
import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {getDynamicListingPolicy} from '@/lib/market/policy';

const requestSchema=z.object({bankAccountId:z.string().uuid(),amount:z.number().int().min(1000).max(100000000000)});
async function balances(ownerId:string,commissionPercent:number){
  const d=db();
  const earned=await d.prepare(`SELECT COALESCE(SUM(COALESCE(seller_net_amount,subtotal-ROUND(subtotal*?/100.0))),0) AS total
    FROM checkout_orders WHERE seller_id=? AND kind='MARKET' AND currency='IDR' AND status IN ('RECEIVED','COMPLETED')`).bind(commissionPercent,ownerId).first<{total:number}>();
  const reserved=await d.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM seller_payout_requests WHERE seller_id=? AND status IN ('REQUESTED','PROCESSING','PAID')").bind(ownerId).first<{total:number}>();
  const requests=(await d.prepare(`SELECT id,amount,currency,status,transaction_reference AS transactionReference,failure_reason AS failureReason,created_at AS createdAt,updated_at AS updatedAt
    FROM seller_payout_requests WHERE seller_id=? ORDER BY created_at DESC LIMIT 50`).bind(ownerId).all()).results;
  return {earned:Number(earned?.total??0),reserved:Number(reserved?.total??0),available:Math.max(0,Number(earned?.total??0)-Number(reserved?.total??0)),requests};
}
export async function GET(){
  try{
    const profile=await user();const d=db();const policy=await getDynamicListingPolicy(profile.tier,d);
    const [balance,account]=await Promise.all([
      balances(profile.id,policy.commissionPercent),
      d.prepare('SELECT id FROM seller_payout_accounts WHERE owner_id=? AND is_default=1').bind(profile.id).first<{id:string}>(),
    ]);
    return Response.json({...balance,defaultBankAccountId:account?.id??null,minimumPayout:1000},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
export async function POST(request:Request){
  try{
    guard(request);const profile=await user();const input=requestSchema.parse(await request.json());const d=db();
    const policy=await getDynamicListingPolicy(profile.tier,d);
    const account=await d.prepare('SELECT id,encrypted_details AS encryptedDetails FROM seller_payout_accounts WHERE id=? AND owner_id=?').bind(input.bankAccountId,profile.id).first<{id:string;encryptedDetails:string}>();
    if(!account)throw new HttpError(404,'Choose a saved bank account.');
    const result=await d.prepare(`INSERT INTO seller_payout_requests(id,seller_id,bank_account_id,encrypted_bank_details,amount,currency,status)
      SELECT ?,?,?,?,?, 'IDR','REQUESTED'
      WHERE ? <= (
        SELECT MAX(0,COALESCE((SELECT SUM(COALESCE(seller_net_amount,subtotal-ROUND(subtotal*?/100.0))) FROM checkout_orders WHERE seller_id=? AND kind='MARKET' AND currency='IDR' AND status IN ('RECEIVED','COMPLETED')),0)
        -COALESCE((SELECT SUM(amount) FROM seller_payout_requests WHERE seller_id=? AND status IN ('REQUESTED','PROCESSING','PAID')),0))
      ) AND NOT EXISTS(SELECT 1 FROM seller_payout_requests WHERE seller_id=? AND status IN ('REQUESTED','PROCESSING'))`).bind(crypto.randomUUID(),profile.id,account.id,account.encryptedDetails,input.amount,input.amount,policy.commissionPercent,profile.id,profile.id,profile.id).run();
    if(!result.meta.changes){
      const balance=await balances(profile.id,policy.commissionPercent);
      if(input.amount>balance.available)throw new HttpError(409,'The withdrawal amount exceeds your available balance.');
      throw new HttpError(409,'You already have a withdrawal request being processed.');
    }
    return Response.json({ok:true},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(error){return errorResponse(error)}
}
