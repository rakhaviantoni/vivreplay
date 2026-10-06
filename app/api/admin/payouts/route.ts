import {z} from 'zod';
import {db,errorResponse,HttpError,guard} from '@/lib/server/store';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';
import {decryptBankDetails} from '@/lib/server/payout-accounts';

const updateSchema=z.object({id:z.string().uuid(),status:z.enum(['PROCESSING','PAID','FAILED']),transactionReference:z.string().trim().max(160).optional(),failureReason:z.string().trim().min(3).max(500).optional()});
export async function GET(){
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  try{
    const rows=(await db().prepare(`SELECT r.id,r.seller_id AS sellerId,r.bank_account_id AS bankAccountId,r.encrypted_bank_details AS encryptedBankDetails,r.amount,r.currency,r.status,r.transaction_reference AS transactionReference,r.failure_reason AS failureReason,r.created_at AS createdAt,r.updated_at AS updatedAt,p.display_name AS seller,p.username
      FROM seller_payout_requests r JOIN profiles p ON p.id=r.seller_id ORDER BY CASE r.status WHEN 'REQUESTED' THEN 0 WHEN 'PROCESSING' THEN 1 ELSE 2 END,r.created_at DESC LIMIT 200`).all<Record<string,unknown>>()).results;
    const requests=await Promise.all(rows.map(async row=>({id:String(row.id),sellerId:String(row.sellerId),seller:String(row.seller??row.username),amount:Number(row.amount),currency:String(row.currency),status:String(row.status),transactionReference:row.transactionReference??null,failureReason:row.failureReason??null,createdAt:String(row.createdAt),updatedAt:String(row.updatedAt),bank:await decryptBankDetails(String(row.encryptedBankDetails),String(row.sellerId),String(row.bankAccountId))})));
    return Response.json({requests},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
export async function PATCH(request:Request){
  try{
    guard(request);if(!await isCurrentUserAdmin())throw new HttpError(403,'Admin access is required.');
    const input=updateSchema.parse(await request.json());const d=db();
    const current=await d.prepare('SELECT status FROM seller_payout_requests WHERE id=?').bind(input.id).first<{status:string}>();
    if(!current)throw new HttpError(404,'Withdrawal request not found.');
    if(current.status==='REQUESTED'&&input.status!=='PROCESSING')throw new HttpError(409,'Move the request to processing first.');
    if(current.status==='PROCESSING'&&!['PAID','FAILED'].includes(input.status))throw new HttpError(409,'This withdrawal is already processing.');
    if(current.status!=='REQUESTED'&&current.status!=='PROCESSING')throw new HttpError(409,'This withdrawal is already closed.');
    if(input.status==='PAID'&&!input.transactionReference?.trim())throw new HttpError(400,'Add the transfer reference before marking this withdrawal paid.');
    if(input.status==='FAILED'&&!input.failureReason?.trim())throw new HttpError(400,'Add a short reason before marking this withdrawal failed.');
    const result=await d.prepare('UPDATE seller_payout_requests SET status=?,transaction_reference=?,failure_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?').bind(input.status,input.transactionReference?.trim()||null,input.failureReason?.trim()||null,input.id,current.status).run();
    if(!result.meta.changes)throw new HttpError(409,'This withdrawal was updated elsewhere. Refresh the page.');
    return Response.json({ok:true});
  }catch(error){return errorResponse(error)}
}
