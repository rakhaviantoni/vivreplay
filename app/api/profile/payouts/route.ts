import {z} from 'zod';
import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {fetchMarketPolicies} from '@/lib/market/policy';
import {splitSellerEarnings,type SellerSettlementOrder} from '@/lib/market/payout-settlement';
import {emailPayoutRequest} from '@/lib/server/admin-notifications';

const requestSchema=z.object({bankAccountId:z.string().uuid(),amount:z.number().int().min(1000).max(100000000000)});
async function balances(ownerId:string,commissionPercent:number,sellerFeeMinimum:number){
  const d=db();
  const sellerEarning=`COALESCE(seller_net_amount,subtotal-MIN(subtotal,MAX(ROUND(subtotal*?/100.0),?)))+CASE WHEN json_extract(details,'$.shippingMethod')='manual' THEN MAX(0,shipping_fee-COALESCE(json_extract(details,'$.marketProShippingDiscount'),0)-COALESCE(json_extract(details,'$.marketDisputeResolution.shippingRefund'),0)) ELSE 0 END`;
  const rows=(await d.prepare(`SELECT ${sellerEarning} AS amount,paid_at AS paidAt,created_at AS createdAt,details
    FROM checkout_orders WHERE seller_id=? AND kind='MARKET' AND currency='IDR' AND status IN ('RECEIVED','COMPLETED')`).bind(commissionPercent,sellerFeeMinimum,ownerId).all<SellerSettlementOrder>()).results;
  const earnings=splitSellerEarnings(rows);
  const reserved=await d.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM seller_payout_requests WHERE seller_id=? AND status IN ('REQUESTED','PROCESSING','PAID')").bind(ownerId).first<{total:number}>();
  const requests=(await d.prepare(`SELECT id,amount,currency,status,transaction_reference AS transactionReference,failure_reason AS failureReason,created_at AS createdAt,updated_at AS updatedAt
    FROM seller_payout_requests WHERE seller_id=? ORDER BY created_at DESC LIMIT 50`).bind(ownerId).all()).results;
  const reservedAmount=Number(reserved?.total??0);
  const {availableBeforeRequests,...amounts}=earnings;
  return {...amounts,reserved:reservedAmount,available:Math.max(0,availableBeforeRequests-reservedAmount),requests};
}
export async function GET(){
  try{
    const profile=await user();const d=db();const policies=await fetchMarketPolicies(d);const policy=policies[profile.tier==='pro'?'pro':'free'];
    const [balance,account]=await Promise.all([
      balances(profile.id,policy.commissionPercent,policies.sellerFeeMinimum),
      d.prepare('SELECT id FROM seller_payout_accounts WHERE owner_id=? AND is_default=1').bind(profile.id).first<{id:string}>(),
    ]);
    return Response.json({...balance,defaultBankAccountId:account?.id??null,minimumPayout:1000,sellerFeeMinimum:policies.sellerFeeMinimum},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
export async function POST(request:Request){
  try{
    guard(request);const profile=await user();const input=requestSchema.parse(await request.json());const d=db();
    const policies=await fetchMarketPolicies(d);const policy=policies[profile.tier==='pro'?'pro':'free'];
    const account=await d.prepare('SELECT id,encrypted_details AS encryptedDetails FROM seller_payout_accounts WHERE id=? AND owner_id=?').bind(input.bankAccountId,profile.id).first<{id:string;encryptedDetails:string}>();
    if(!account)throw new HttpError(404,'Choose a saved bank account.');
    const currentBalance=await balances(profile.id,policy.commissionPercent,policies.sellerFeeMinimum);
    const payoutRequestId=crypto.randomUUID();
    const result=await d.prepare(`INSERT INTO seller_payout_requests(id,seller_id,bank_account_id,encrypted_bank_details,amount,currency,status)
      SELECT ?,?,?,?,?, 'IDR','REQUESTED'
      WHERE ? <= MAX(0,? - COALESCE((SELECT SUM(amount) FROM seller_payout_requests WHERE seller_id=? AND status IN ('REQUESTED','PROCESSING','PAID')),0))
        AND NOT EXISTS(SELECT 1 FROM seller_payout_requests WHERE seller_id=? AND status IN ('REQUESTED','PROCESSING'))`).bind(payoutRequestId,profile.id,account.id,account.encryptedDetails,input.amount,input.amount,currentBalance.availableBeforeRequests,profile.id,profile.id).run();
    if(!result.meta.changes){
      const balance=await balances(profile.id,policy.commissionPercent,policies.sellerFeeMinimum);
      if(input.amount>balance.available)throw new HttpError(409,'The withdrawal amount exceeds your available balance.');
      throw new HttpError(409,'You already have a withdrawal request being processed.');
    }
    await emailPayoutRequest({requestId:payoutRequestId,seller:String(profile.display_name??profile.username??'A seller'),amount:input.amount,currency:'IDR'}).catch(error=>console.error('admin_payout_email_failed',{requestId:payoutRequestId,error:error instanceof Error?error.message:'unknown error'}));
    return Response.json({ok:true},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(error){return errorResponse(error)}
}
