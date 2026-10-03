import {user,db,errorResponse,guard} from '@/lib/server/store';

export async function GET(){
  try{
    const profile=await user();
    const listings=(await db().prepare(`SELECT id,title,amount,currency,quantity,type,status,city,created_at AS createdAt,expires_at AS expiresAt FROM listings WHERE seller_id=? ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PAUSED' THEN 1 WHEN 'CLOSED' THEN 2 ELSE 3 END,created_at DESC LIMIT 100`).bind(profile.id).all<{id:string;title:string;amount:number;currency:string;quantity:number;type:string;status:string;city:string;createdAt:string;expiresAt:string|null}>()).results;
    return Response.json({listings},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
