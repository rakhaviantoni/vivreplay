import {db,errorResponse,user} from '@/lib/server/store';

type MembershipOrder={id:string;status:string;amount:number;currency:string;createdAt:string;paidAt:string|null;currentOrderId:string|null};

export async function GET(){
  try{
    const profile=await user();
    const orders=(await db().prepare(`SELECT o.id,o.status,o.amount,o.currency,o.created_at AS createdAt,o.paid_at AS paidAt,
        CASE WHEN o.status='PENDING_PAYMENT' AND json_extract(o.details,'$.ipaymuPaymentMethod')!='qris' THEN (
          SELECT newer.id FROM checkout_orders newer WHERE newer.kind='PRO' AND newer.buyer_id=o.buyer_id AND newer.id<>o.id
            AND newer.status='PENDING_PAYMENT' AND newer.payment_id IS NOT NULL AND json_extract(newer.details,'$.ipaymuPaymentMethod')='qris'
            AND newer.expires_at>CURRENT_TIMESTAMP AND newer.created_at>o.created_at ORDER BY newer.created_at DESC LIMIT 1
        ) ELSE NULL END AS currentOrderId
      FROM checkout_orders o WHERE o.kind='PRO' AND o.buyer_id=? ORDER BY o.created_at DESC LIMIT 20`)
      .bind(profile.id).all<MembershipOrder>()).results;
    return Response.json({orders},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
