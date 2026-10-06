import {z} from 'zod';
import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {decryptBankDetails,encryptBankDetails} from '@/lib/server/payout-accounts';

const schema=z.object({id:z.string().uuid().optional(),bankName:z.string().trim().min(2).max(80),accountHolder:z.string().trim().min(2).max(120),accountNumber:z.string().trim().regex(/^\d{6,34}$/).optional(),makeDefault:z.boolean().default(false)});
type Stored={id:string;encryptedDetails:string;isDefault:number};
export async function GET(){
  try{
    const profile=await user();
    const {results}=await db().prepare('SELECT id,encrypted_details AS encryptedDetails,is_default AS isDefault FROM seller_payout_accounts WHERE owner_id=? ORDER BY is_default DESC,created_at,id').bind(profile.id).all<Stored>();
    const accounts=await Promise.all(results.map(async row=>{
      const details=await decryptBankDetails(row.encryptedDetails,profile.id,row.id);
      return {id:row.id,bankName:details.bankName,accountHolder:details.accountHolder,lastFour:details.accountNumber.slice(-4),isDefault:row.isDefault===1};
    }));
    return Response.json({accounts},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
export async function POST(request:Request){
  try{
    guard(request);const profile=await user();const input=schema.parse(await request.json());const database=db();
    const stored=input.id?await database.prepare('SELECT id,encrypted_details AS encryptedDetails,is_default AS isDefault FROM seller_payout_accounts WHERE id=? AND owner_id=?').bind(input.id,profile.id).first<Stored>():null;
    if(input.id&&!stored)throw new HttpError(404,'Bank account not found.');
    const previous=stored?await decryptBankDetails(stored.encryptedDetails,profile.id,stored.id):null;
    const accountNumber=input.accountNumber??previous?.accountNumber;
    if(!accountNumber)throw new HttpError(400,'Enter your bank account number.');
    const id=stored?.id??crypto.randomUUID();
    const encrypted=await encryptBankDetails({bankName:input.bankName,accountHolder:input.accountHolder,accountNumber},profile.id,id);
    const count=await database.prepare('SELECT COUNT(*) AS total FROM seller_payout_accounts WHERE owner_id=?').bind(profile.id).first<{total:number}>();
    if(!stored&&(count?.total??0)>=5)throw new HttpError(400,'You can save up to five bank accounts.');
    const save=stored
      ?database.prepare('UPDATE seller_payout_accounts SET encrypted_details=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?').bind(encrypted,id,profile.id)
      :database.prepare('INSERT INTO seller_payout_accounts(id,owner_id,encrypted_details) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM seller_payout_accounts WHERE owner_id=?)<5').bind(id,profile.id,encrypted,profile.id);
    const statements=[save];
    if(input.makeDefault||!count?.total){
      statements.push(database.prepare('UPDATE seller_payout_accounts SET is_default=0 WHERE owner_id=? AND EXISTS(SELECT 1 FROM seller_payout_accounts WHERE id=? AND owner_id=?)').bind(profile.id,id,profile.id));
      statements.push(database.prepare('UPDATE seller_payout_accounts SET is_default=1 WHERE id=? AND owner_id=?').bind(id,profile.id));
    }
    const result=await database.batch(statements);
    if(!result[0].meta.changes)throw new HttpError(409,'The bank account could not be saved. Refresh and try again.');
    return Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
export async function PATCH(request:Request){
  try{
    guard(request);const profile=await user();const {id}=z.object({id:z.string().uuid()}).parse(await request.json());const database=db();
    const owned=await database.prepare('SELECT id FROM seller_payout_accounts WHERE id=? AND owner_id=?').bind(id,profile.id).first();
    if(!owned)throw new HttpError(404,'Bank account not found.');
    await database.batch([
      database.prepare('UPDATE seller_payout_accounts SET is_default=0 WHERE owner_id=? AND EXISTS(SELECT 1 FROM seller_payout_accounts WHERE id=? AND owner_id=?)').bind(profile.id,id,profile.id),
      database.prepare('UPDATE seller_payout_accounts SET is_default=1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?').bind(id,profile.id),
    ]);
    return Response.json({ok:true});
  }catch(error){return errorResponse(error)}
}
export async function DELETE(request:Request){
  try{
    guard(request);const profile=await user();const {id}=z.object({id:z.string().uuid()}).parse(await request.json());const database=db();
    await database.batch([
      database.prepare('DELETE FROM seller_payout_accounts WHERE id=? AND owner_id=?').bind(id,profile.id),
      database.prepare('UPDATE seller_payout_accounts SET is_default=1 WHERE owner_id=? AND id=(SELECT id FROM seller_payout_accounts WHERE owner_id=? ORDER BY created_at,id LIMIT 1) AND NOT EXISTS(SELECT 1 FROM seller_payout_accounts WHERE owner_id=? AND is_default=1)').bind(profile.id,profile.id,profile.id),
    ]);
    return Response.json({ok:true});
  }catch(error){return errorResponse(error)}
}
