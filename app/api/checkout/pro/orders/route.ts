import {db,errorResponse,user} from '@/lib/server/store';

type MembershipOrder={id:string;status:string;amount:number;currency:string;createdAt:string;paidAt:string|null};

export async function GET(){
  try{
    const profile=await user();
    const orders=(await db().prepare(`SELECT id,status,amount,currency,created_at AS createdAt,paid_at AS paidAt
      FROM checkout_orders WHERE kind='PRO' AND buyer_id=? ORDER BY created_at DESC LIMIT 20`)
      .bind(profile.id).all<MembershipOrder>()).results;
    return Response.json({orders},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
