import {db,errorResponse,user} from '@/lib/server/store';
import {ipaymuExpiryTimestamp} from '@/lib/server/ipaymu';

type MembershipOrder={id:string;status:string;amount:number;currency:string;createdAt:string;paidAt:string|null};

export async function GET(){
  try{
    const profile=await user();
    const database=db();
    const rows=(await database.prepare(`SELECT id,status,amount,currency,created_at AS createdAt,paid_at AS paidAt,
      payment_id AS paymentId,expires_at AS expiresAt,updated_at AS updatedAt,details
      FROM checkout_orders WHERE kind='PRO' AND buyer_id=? ORDER BY created_at DESC LIMIT 20`)
      .bind(profile.id).all<MembershipOrder&{paymentId:string|null;expiresAt:string|null;updatedAt:string|null;details:string}>()).results;
    const now=Date.now();
    for(const order of rows){
      if(order.status!=='PENDING_PAYMENT')continue;
      let details:Record<string,unknown>={};
      try{const parsed=JSON.parse(order.details) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
      const paymentExpiry=details.ipaymuPaymentMethod==='qris'
        ?ipaymuExpiryTimestamp(details.ipaymuPaymentExpiresAt,details.ipaymuPaymentCreatedAt,order.updatedAt)
        :null;
      const storedExpiry=order.expiresAt?Date.parse(`${order.expiresAt.replace(' ','T')}Z`):null;
      const expiry=paymentExpiry??(storedExpiry!==null&&Number.isFinite(storedExpiry)?storedExpiry:null);
      if(expiry!==null&&expiry<=now){
        const result=await database.prepare(`UPDATE checkout_orders SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP
          WHERE id=? AND buyer_id=? AND kind='PRO' AND status='PENDING_PAYMENT'`).bind(order.id,profile.id).run();
        if(result.meta.changes)order.status='EXPIRED';
      }
    }
    const orders=rows.map(({id,status,amount,currency,createdAt,paidAt})=>({id,status,amount,currency,createdAt,paidAt}));
    return Response.json({orders},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
