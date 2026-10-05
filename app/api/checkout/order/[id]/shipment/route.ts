import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {biteshipRequest} from '@/lib/server/biteship';
import {sendMarketEmail} from '@/lib/server/market-notifications';

type ShippingSnapshot={recipientName?:string;addressLine?:string;city?:string;postalCode?:string;areaId?:string;latitude?:number|null;longitude?:number|null;phone?:string;courierName?:string;courierServiceName?:string;courierCode?:string;courierServiceCode?:string;courierCompany?:string;courierType?:string;sender?:{recipientName?:string|null;addressLine?:string;city?:string;postalCode?:string;areaId?:string|null;latitude?:number|null;longitude?:number|null;phone?:string|null};trackingNumber?:string;courier?:string;waybillId?:string;trackingUrl?:string};
type Result={id?:string;object?:string;draft_order_id?:string;draft_order?:{id?:string;rates?:Array<{company?:string;courier_code?:string;type?:string;price?:number}>};order?:{id?:string;tracking_id?:string;waybill_id?:string;link?:string};courier?:{tracking_id?:string;waybill_id?:string;link?:string};tracking_id?:string;waybill_id?:string;link?:string;pricing?:Array<{company?:string;courier_code?:string;type?:string;price?:number}>};

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    guard(request);const profile=await user();const {id}=await params;const database=db();
    const row=await database.prepare(`SELECT o.id,o.status,o.shipping_status AS shippingStatus,o.biteship_draft_order_id AS draftId,o.items,o.details,o.subtotal,o.seller_id AS sellerId,o.buyer_id AS buyerId,l.title,b.email AS buyerEmail,s.email AS sellerEmail
      FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id LEFT JOIN user b ON b.id=(SELECT auth_subject FROM profiles WHERE id=o.buyer_id) LEFT JOIN user s ON s.id=(SELECT auth_subject FROM profiles WHERE id=o.seller_id) WHERE o.id=? AND o.kind='MARKET'`).bind(id).first<{id:string;status:string;shippingStatus:string|null;draftId:string|null;items:string;details:string|null;subtotal:number;sellerId:string|null;buyerId:string;title:string|null;buyerEmail:string|null;sellerEmail:string|null}>();
    if(!row||row.sellerId!==profile.id)throw new HttpError(404,'Paid order not found.');
    if(row.status==='SHIPPED')return Response.json({ok:true,status:row.status});
    if(row.status!=='PAID')throw new HttpError(409,'Shipping can be arranged after payment is confirmed.');
    if(row.shippingStatus==='CREATING')throw new HttpError(409,'Shipment setup is already in progress. Refresh the order in a moment.');
    const claimed=await database.prepare("UPDATE checkout_orders SET shipping_status='CREATING',shipping_updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PAID' AND COALESCE(shipping_status,'')<>'CREATING'").bind(id).run();
    if(!claimed.meta.changes)throw new HttpError(409,'Shipment setup is already in progress. Refresh the order in a moment.');
    let shipping:ShippingSnapshot;try{shipping=JSON.parse(row.details||'{}') as ShippingSnapshot}catch{throw new HttpError(500,'Saved delivery details are invalid.');}
    if(!shipping.sender?.addressLine||!shipping.addressLine||!shipping.phone||!shipping.sender.phone||!shipping.courierCompany||!shipping.courierType)throw new HttpError(400,'The order is missing pickup, delivery, or courier details.');
    let entries:Array<{printingId:string;quantity:number;unitAmount?:number}>;try{entries=JSON.parse(row.items) as typeof entries}catch{entries=[]}
    if(!entries.length)throw new HttpError(400,'This order has no cards to ship.');
    const totalQuantity=entries.reduce((sum,item)=>sum+item.quantity,0);
    const sender=shipping.sender;
    const postal=(value:string|undefined)=>value&&/^\d{5}$/.test(value)?Number(value):undefined;
    const coordinate=(latitude:number|null|undefined,longitude:number|null|undefined)=>typeof latitude==='number'&&typeof longitude==='number'?{latitude,longitude}:undefined;
    let draftId=row.draftId;
    if(!draftId){
      const created=await biteshipRequest<Result>('/draft_orders',{method:'POST',body:JSON.stringify({reference_id:`VPM-${row.id.slice(0,8).toUpperCase()}`,origin_contact_name:sender.recipientName||'VivrePlay seller',origin_contact_phone:sender.phone,origin_address:`${sender.addressLine}, ${sender.city}`,origin_postal_code:postal(sender.postalCode),origin_area_id:sender.areaId||undefined,origin_coordinate:coordinate(sender.latitude,sender.longitude),destination_contact_name:shipping.recipientName||'VivrePlay buyer',destination_contact_phone:shipping.phone,destination_address:`${shipping.addressLine}, ${shipping.city}`,destination_postal_code:postal(shipping.postalCode),destination_area_id:shipping.areaId||undefined,destination_coordinate:coordinate(shipping.latitude,shipping.longitude),delivery_type:'now',items:entries.map(item=>({name:row.title||item.printingId,description:item.printingId,category:'hobby',value:Math.max(0,item.unitAmount??0),quantity:item.quantity,weight:100,length:18,width:13,height:2}))})});
      draftId=created.id??created.draft_order_id??created.draft_order?.id??null;
      if(!draftId)throw new HttpError(502,'Biteship did not return a draft shipment ID.');
      await database.prepare("UPDATE checkout_orders SET biteship_draft_order_id=?,shipping_status='DRAFT',shipping_updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(draftId,id).run();
    }
    const rates=await biteshipRequest<Result>(`/draft_orders/${encodeURIComponent(draftId)}/rates`);
    const eligible=rates.pricing??rates.draft_order?.rates??[];
    if(!eligible.some(rate=>(rate.company??rate.courier_code)===shipping.courierCompany&&rate.type===shipping.courierType))throw new HttpError(409,'The selected courier service is no longer available for this package.');
    await biteshipRequest<Result>(`/draft_orders/${encodeURIComponent(draftId)}`,{method:'POST',body:JSON.stringify({courier_company:shipping.courierCompany,courier_type:shipping.courierType})});
    const confirmed=await biteshipRequest<Result>(`/draft_orders/${encodeURIComponent(draftId)}/confirm`,{method:'POST',body:JSON.stringify({})});
    const order=confirmed.order??confirmed;
    const biteshipOrderId=confirmed.id??order.id??null;const trackingId=confirmed.courier?.tracking_id??order.tracking_id??confirmed.tracking_id??null;const waybill=confirmed.courier?.waybill_id??order.waybill_id??confirmed.waybill_id??null;const trackingUrl=confirmed.courier?.link??order.link??confirmed.link??null;
    if(!biteshipOrderId&&!trackingId)throw new HttpError(502,'Biteship confirmed the shipment without returning tracking details.');
    const courier=[shipping.courierName,shipping.courierServiceName].filter(Boolean).join(' ');
    const nextShipping={...shipping,courier,trackingNumber:waybill??trackingId??undefined,waybillId:waybill??undefined,trackingUrl:trackingUrl??undefined};
    await database.prepare("UPDATE checkout_orders SET status='SHIPPED',shipping_status='CONFIRMED',biteship_order_id=?,biteship_tracking_id=?,shipping_waybill_id=?,shipping_tracking_url=?,details=?,shipping_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PAID'").bind(biteshipOrderId,trackingId,waybill,trackingUrl,JSON.stringify(nextShipping),id).run();
    await sendMarketEmail(row.buyerId,'order-shipped',row.title||'Market order',id);
    return Response.json({ok:true,status:'SHIPPED',trackingNumber:waybill??trackingId,trackingUrl});
  }catch(error){
    try{const {id}=await params;await db().prepare("UPDATE checkout_orders SET shipping_status=CASE WHEN biteship_draft_order_id IS NULL THEN 'FAILED' ELSE 'DRAFT' END,shipping_updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PAID' AND shipping_status='CREATING'").bind(id).run()}catch{}
    return errorResponse(error);
  }
}
