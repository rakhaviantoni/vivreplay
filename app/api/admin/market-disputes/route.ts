import {z} from 'zod';
import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';
import {sendMarketEmail} from '@/lib/server/market-notifications';

const updateSchema=z.object({id:z.string().uuid(),decision:z.enum(['FULL_REFUND','PARTIAL_REFUND','RESHIP','NO_REFUND']),decisionNote:z.string().trim().min(10).max(3000),refundReference:z.string().trim().max(160).optional(),refundShipping:z.boolean().default(false)});
type Item={printingId:string;quantity:number;unitAmount?:number;condition?:string;listingId?:string};
export async function GET(){
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  try{
    const disputes=(await db().prepare(`SELECT d.id,d.order_id AS orderId,d.buyer_id AS buyerId,d.seller_id AS sellerId,d.status,d.reason,d.affected_items AS affectedItems,d.requested_resolution AS requestedResolution,d.evidence,d.seller_response AS sellerResponse,d.decision,d.decision_note AS decisionNote,d.refund_amount AS refundAmount,d.shipping_refund AS shippingRefund,d.refund_reference AS refundReference,d.created_at AS createdAt,o.subtotal,o.shipping_fee AS shippingFee,o.amount AS orderAmount,o.currency,o.status AS orderStatus,l.title,b.display_name AS buyer,s.display_name AS seller
      FROM market_disputes d JOIN checkout_orders o ON o.id=d.order_id LEFT JOIN listings l ON l.id=o.listing_id JOIN profiles b ON b.id=d.buyer_id JOIN profiles s ON s.id=d.seller_id ORDER BY CASE d.status WHEN 'OPEN' THEN 0 WHEN 'UNDER_REVIEW' THEN 1 ELSE 2 END,d.created_at DESC LIMIT 200`).all<Record<string,unknown>>()).results;
    return Response.json({disputes:disputes.map(row=>({...row,evidence:JSON.parse(String(row.evidence||'[]'))}))},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
export async function PATCH(request:Request){
  try{
    guard(request);const actor=await user();if(!await isCurrentUserAdmin())throw new HttpError(403,'Admin access is required.');
    const input=updateSchema.parse(await request.json());const d=db();
    const dispute=await d.prepare(`SELECT d.id,d.order_id AS orderId,d.buyer_id AS buyerId,d.seller_id AS sellerId,d.affected_items AS affectedItems,d.status,o.items,o.subtotal,o.shipping_fee AS shippingFee,o.seller_net_amount AS sellerNetAmount,o.details,o.status AS orderStatus,l.title FROM market_disputes d JOIN checkout_orders o ON o.id=d.order_id LEFT JOIN listings l ON l.id=o.listing_id WHERE d.id=?`).bind(input.id).first<{id:string;orderId:string;buyerId:string;sellerId:string;affectedItems:string;status:string;items:string;subtotal:number;shippingFee:number;sellerNetAmount:number|null;details:string|null;orderStatus:string;title:string|null}>();
    if(!dispute||dispute.status==='RESOLVED')throw new HttpError(404,'Open dispute not found.');
    const selected=JSON.parse(dispute.affectedItems) as Array<{index:number;quantity:number}>;const items=JSON.parse(dispute.items) as Item[];
    const refundForSelected=selected.reduce((sum,pick)=>sum+Math.max(0,Math.round(items[pick.index]?.unitAmount??0))*pick.quantity,0);
    let refundAmount=0,shippingRefund=0,nextItems=items;
    if(input.decision==='FULL_REFUND'){refundAmount=dispute.subtotal;shippingRefund=input.refundShipping?dispute.shippingFee:0;nextItems=[];}
    if(input.decision==='PARTIAL_REFUND'){
      if(refundForSelected<=0)throw new HttpError(400,'The affected cards do not have a refundable item amount.');
      refundAmount=refundForSelected;
      const quantities=new Map(selected.map(p=>[p.index,p.quantity]));
      nextItems=items.flatMap((item,index)=>{const remaining=item.quantity-(quantities.get(index)??0);return remaining>0?[{...item,quantity:remaining}]:[]});
      if(!nextItems.length)throw new HttpError(400,'Use a full refund when every card in the order is affected.');
    }
    if(input.decision==='FULL_REFUND'||input.decision==='PARTIAL_REFUND'){
      if(!input.refundReference?.trim())throw new HttpError(400,'Record the completed refund reference before closing the case.');
    }
    if(input.decision==='RESHIP'&&dispute.orderStatus!=='SHIPPED')throw new HttpError(409,'A replacement shipment can only be arranged while the original order is awaiting confirmation.');
    let details:Record<string,unknown>={};try{details=JSON.parse(dispute.details||'{}') as Record<string,unknown>}catch{}
    details.marketDisputeResolution={decision:input.decision,refundAmount,shippingRefund,refundReference:input.refundReference?.trim()||null,serviceFeeRefund:0,decidedAt:new Date().toISOString()};
    const feePercent=typeof details.marketFeePercent==='number'?details.marketFeePercent:1.5;
    const sellerNetAmount=input.decision==='FULL_REFUND'?0:input.decision==='PARTIAL_REFUND'?Math.max(0,(dispute.sellerNetAmount??dispute.subtotal)-refundAmount+Math.round(refundAmount*feePercent/100)):(dispute.sellerNetAmount??dispute.subtotal);
    const decisionUpdate=d.prepare(`UPDATE market_disputes SET status='RESOLVED',decision=?,decision_note=?,refund_amount=?,shipping_refund=?,refund_reference=?,decided_by=?,resolved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status!='RESOLVED'`).bind(input.decision,input.decisionNote.trim(),refundAmount,shippingRefund,input.refundReference?.trim()||null,actor.id,input.id);
    if(input.decision==='RESHIP'){
      const updateOrder=d.prepare(`UPDATE checkout_orders SET status='PAID',shipping_status='PENDING',shipping_waybill_id=NULL,shipping_tracking_url=NULL,biteship_order_id=NULL,biteship_tracking_id=NULL,biteship_draft_order_id=NULL,dispatched_at=NULL,delivered_at=NULL,details=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='SHIPPED' AND EXISTS(SELECT 1 FROM market_disputes WHERE id=? AND status='RESOLVED' AND decision='RESHIP')`).bind(JSON.stringify(details),dispute.orderId,input.id);
      const [saved]=await d.batch([decisionUpdate,updateOrder]);if(!saved?.meta.changes)throw new HttpError(409,'This case was updated by someone else. Refresh and review it again.');
    }else if(input.decision==='FULL_REFUND'){
      const updateOrder=d.prepare(`UPDATE checkout_orders SET status='REFUNDED',seller_net_amount=0,details=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='SHIPPED' AND EXISTS(SELECT 1 FROM market_disputes WHERE id=? AND status='RESOLVED' AND decision='FULL_REFUND')`).bind(JSON.stringify(details),dispute.orderId,input.id);
      const [saved]=await d.batch([decisionUpdate,updateOrder]);if(!saved?.meta.changes)throw new HttpError(409,'This case was updated by someone else. Refresh and review it again.');
    }else if(input.decision==='PARTIAL_REFUND'){
      const updateOrder=d.prepare(`UPDATE checkout_orders SET status='SHIPPED',items=?,seller_net_amount=?,details=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='SHIPPED' AND EXISTS(SELECT 1 FROM market_disputes WHERE id=? AND status='RESOLVED' AND decision='PARTIAL_REFUND')`).bind(JSON.stringify(nextItems),sellerNetAmount,JSON.stringify(details),dispute.orderId,input.id);
      const [saved]=await d.batch([decisionUpdate,updateOrder]);if(!saved?.meta.changes)throw new HttpError(409,'This case was updated by someone else. Refresh and review it again.');
    }else{
      const updateOrder=d.prepare(`UPDATE checkout_orders SET status='SHIPPED',details=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='SHIPPED' AND EXISTS(SELECT 1 FROM market_disputes WHERE id=? AND status='RESOLVED' AND decision='NO_REFUND')`).bind(JSON.stringify(details),dispute.orderId,input.id);
      const [saved]=await d.batch([decisionUpdate,updateOrder]);if(!saved?.meta.changes)throw new HttpError(409,'This case was updated by someone else. Refresh and review it again.');
    }
    await Promise.all([sendMarketEmail(dispute.buyerId,'order-dispute-resolved',dispute.title||'Market order',dispute.orderId),sendMarketEmail(dispute.sellerId,'order-dispute-resolved',dispute.title||'Market order',dispute.orderId)]);
    return Response.json({ok:true,refundAmount,shippingRefund,serviceFeeRefund:0});
  }catch(error){return errorResponse(error)}
}
