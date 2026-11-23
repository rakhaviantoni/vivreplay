import {z} from 'zod';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';
import {db,errorResponse,guard,HttpError} from '@/lib/server/store';
import {ensurePartnerRequestsSchema} from '@/lib/server/partner-requests';
import {sendMarketEmail} from '@/lib/server/market-notifications';

const patchSchema=z.object({
  id:z.string().uuid(),
  status:z.enum(['APPROVED','REJECTED']),
});

export async function GET(){
  try{
    if(!await isCurrentUserAdmin())throw new HttpError(403,'Forbidden');
    const database=db();
    await ensurePartnerRequestsSchema(database);
    const rows=(await database.prepare(`SELECT id,profile_id AS profileId,shop_name AS shopName,social_handle AS socialHandle,category,city,monthly_volume AS monthlyVolume,contact_whatsapp AS contactWhatsapp,notes,request_type AS requestType,ai_score AS aiScore,ai_risk AS aiRisk,ai_summary AS aiSummary,social_metrics AS socialMetrics,status,reviewed_at AS reviewedAt,created_at AS createdAt
      FROM market_partner_requests
      ORDER BY CASE status WHEN 'PENDING' THEN 0 ELSE 1 END,COALESCE(ai_score,0) DESC,created_at DESC
      LIMIT 100`).all()).results;
    return Response.json({requests:rows??[]},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    return errorResponse(error);
  }
}

export async function PATCH(request:Request){
  try{
    guard(request);
    if(!await isCurrentUserAdmin())throw new HttpError(403,'Forbidden');
    const input=patchSchema.parse(await request.json());
    const database=db();
    await ensurePartnerRequestsSchema(database);
    const row=await database.prepare('SELECT profile_id AS profileId,shop_name AS shopName FROM market_partner_requests WHERE id=?').bind(input.id).first<{profileId:string|null;shopName:string}>();
    await database.prepare('UPDATE market_partner_requests SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').bind(input.status,input.id).run();
    if(row?.profileId){
      await sendMarketEmail(row.profileId,input.status==='APPROVED'?'partner-application-approved':'partner-application-declined',row.shopName||'Partner & Consign',input.id).catch(()=>{});
    }
    return Response.json({ok:true,id:input.id,status:input.status});
  }catch(error){
    return errorResponse(error);
  }
}
