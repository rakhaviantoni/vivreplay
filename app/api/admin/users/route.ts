import {db,errorResponse} from '@/lib/server/store';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

type AdminUser={id:string;username:string;display_name:string;email:string|null;tier:string;pro_expires_at:string|null;created_at:string;latest_pro_order_id:string|null;latest_pro_paid_at:string|null};

export async function GET(){
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  try{
    const database=db();
    const [totals,users]=await Promise.all([
      database.prepare(`SELECT COUNT(*) AS total_users,COUNT(CASE WHEN tier='pro' AND (pro_expires_at IS NULL OR pro_expires_at>CURRENT_TIMESTAMP) THEN 1 END) AS active_pro FROM profiles`).first<{total_users:number;active_pro:number}>(),
      database.prepare(`SELECT p.id,p.username,p.display_name,u.email,p.tier,p.pro_expires_at,p.created_at,
          (SELECT id FROM checkout_orders o WHERE o.kind='PRO' AND o.buyer_id=p.id AND o.status='PAID' ORDER BY o.paid_at DESC LIMIT 1) AS latest_pro_order_id,
          (SELECT paid_at FROM checkout_orders o WHERE o.kind='PRO' AND o.buyer_id=p.id AND o.status='PAID' ORDER BY o.paid_at DESC LIMIT 1) AS latest_pro_paid_at
        FROM profiles p LEFT JOIN user u ON u.id=p.auth_subject
        ORDER BY CASE WHEN p.tier='pro' AND (p.pro_expires_at IS NULL OR p.pro_expires_at>CURRENT_TIMESTAMP) THEN 0 ELSE 1 END,p.created_at DESC LIMIT 500`).all<AdminUser>(),
    ]);
    return Response.json({summary:{totalUsers:totals?.total_users??0,activePro:totals?.active_pro??0},users:users.results},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
