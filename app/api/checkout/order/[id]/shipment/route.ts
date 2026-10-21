import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {biteshipRequest} from '@/lib/server/biteship';
import {sendMarketEmail} from '@/lib/server/market-notifications';

type ShippingSnapshot={recipientName?:string;addressLine?:string;city?:string;postalCode?:string;areaId?:string;latitude?:number|null;longitude?:number|null;phone?:string;courierName?:string;courierServiceName?:string;courierCode?:string;courierServiceCode?:string;courierCompany?:string;courierType?:string;availableCollectionMethods?:string[];collectionMethod?:'pickup'|'drop_off';sender?:{recipientName?:string|null;addressLine?:string;city?:string;postalCode?:string;areaId?:string|null;latitude?:number|null;longitude?:number|null;phone?:string|null};trackingNumber?:string;courier?:string;waybillId?:string;trackingUrl?:string;trackingStatus?:string;shippingNote?:string;parcelDescription?:string;shippingAttempts?:Array<Record<string,unknown>>};
type Result={id?:string;object?:string;draft_order_id?:string;draft_order?:{id?:string;rates?:Array<{company?:string;courier_code?:string;type?:string;price?:number;available_collection_method?:string[]}>};order?:{id?:string;tracking_id?:string;waybill_id?:string;link?:string};courier?:{tracking_id?:string;waybill_id?:string;link?:string};tracking_id?:string;waybill_id?:string;link?:string;pricing?:Array<{company?:string;courier_code?:string;type?:string;price?:number;available_collection_method?:string[]}>};

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    guard(request);const payload=await request.json().catch(()=>({})) as {collectionMethod?:unknown;shippingMethod?:unknown;courierName?:unknown;trackingNumber?:unknown;trackingUrl?:unknown;shippingNote?:unknown;parcelDescription?:unknown};const shippingMethod=payload.shippingMethod==='manual'?'manual':'biteship';if(shippingMethod==='biteship'&&payload.collectionMethod!==undefined&&payload.collectionMethod!=='pickup'&&payload.collectionMethod!=='drop_off')throw new HttpError(400,'Choose courier pickup or seller drop-off.');const collectionMethod=payload.collectionMethod==='drop_off'?'drop_off':'pickup';const profile=await user();const {id}=await params;const database=db();
    const row=await database.prepare(`SELECT o.id,o.status,o.shipping_status AS shippingStatus,o.biteship_draft_order_id AS draftId,o.items,o.details,o.subtotal,o.seller_id AS sellerId,o.buyer_id AS buyerId,l.title,b.email AS buyerEmail,s.email AS sellerEmail
      FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id LEFT JOIN user b ON b.id=(SELECT auth_subject FROM profiles WHERE id=o.buyer_id) LEFT JOIN user s ON s.id=(SELECT auth_subject FROM profiles WHERE id=o.seller_id) WHERE o.id=? AND o.kind='MARKET'`).bind(id).first<{id:string;status:string;shippingStatus:string|null;draftId:string|null;items:string;details:string|null;subtotal:number;sellerId:string|null;buyerId:string;title:string|null;buyerEmail:string|null;sellerEmail:string|null}>();
    if(!row||row.sellerId!==profile.id)throw new HttpError(404,'Paid order not found.');
    let shipping:ShippingSnapshot;try{shipping=JSON.parse(row.details||'{}') as ShippingSnapshot}catch{throw new HttpError(500,'Saved delivery details are invalid.');}
    const failedCourierBooking=shipping.trackingStatus?.trim().toLowerCase().replace(/[\s_-]+/g,'')==='couriernotfound';
    const retrying=(row.status==='SHIPPED'||row.status==='PAID')&&failedCourierBooking;
    if(row.status==='SHIPPED'&&!retrying)return Response.json({ok:true,status:row.status});
    if(row.status!=='PAID'&&!retrying)throw new HttpError(409,'Shipping can be arranged after payment is confirmed.');
    if(row.shippingStatus==='CREATING')throw new HttpError(409,'Shipment setup is already in progress. Refresh the order in a moment.');
    const shippingNote=shippingMethod==='biteship'&&typeof payload.shippingNote==='string'?payload.shippingNote.trim().slice(0,250):'';
    const parcelDescription=shippingMethod==='biteship'&&typeof payload.parcelDescription==='string'?payload.parcelDescription.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,100)||'Trading cards':'Trading cards';
    const manualCourierName=typeof payload.courierName==='string'?payload.courierName.trim().slice(0,80):'';
    const manualTrackingNumber=typeof payload.trackingNumber==='string'?payload.trackingNumber.trim().slice(0,100):'';
    const manualTrackingUrl=typeof payload.trackingUrl==='string'?payload.trackingUrl.trim().slice(0,500):'';
    if(shippingMethod==='manual'&&(!manualCourierName||!manualTrackingNumber))throw new HttpError(400,'Enter the courier and tracking number.');
    if(manualTrackingUrl){let parsed:URL;try{parsed=new URL(manualTrackingUrl)}catch{throw new HttpError(400,'Enter a valid tracking link.')}if(!['http:','https:'].includes(parsed.protocol))throw new HttpError(400,'Enter a valid tracking link.')}
    const attempts=[...(shipping.shippingAttempts??[])];
    if(retrying)attempts.push({provider:'Biteship',status:shipping.trackingStatus,trackingNumber:shipping.waybillId??shipping.trackingNumber??null,courier:shipping.courier??null,recordedAt:new Date().toISOString()});
    const freshShipping:ShippingSnapshot={...shipping};
    if(retrying){delete freshShipping.trackingStatus;delete freshShipping.trackingNumber;delete freshShipping.waybillId;delete freshShipping.trackingUrl;delete freshShipping.courier;freshShipping.shippingAttempts=attempts.slice(-5)}
    const claimed=await database.prepare(`UPDATE checkout_orders SET status='PAID',shipping_status='CREATING',biteship_draft_order_id=CASE WHEN ? THEN NULL ELSE biteship_draft_order_id END,biteship_order_id=CASE WHEN ? THEN NULL ELSE biteship_order_id END,biteship_tracking_id=CASE WHEN ? THEN NULL ELSE biteship_tracking_id END,shipping_waybill_id=CASE WHEN ? THEN NULL ELSE shipping_waybill_id END,shipping_tracking_url=CASE WHEN ? THEN NULL ELSE shipping_tracking_url END,dispatched_at=CASE WHEN ? THEN NULL ELSE dispatched_at END,delivered_at=CASE WHEN ? THEN NULL ELSE delivered_at END,details=?,shipping_updated_at=CURRENT_TIMESTAMP WHERE id=? AND COALESCE(shipping_status,'')<>'CREATING' AND (status='PAID' OR (status='SHIPPED' AND lower(replace(replace(replace(json_extract(details,'$.trackingStatus'),'_',''),'-',''),' ',''))='couriernotfound'))`).bind(...Array(7).fill(retrying),JSON.stringify(freshShipping),id).run();
    if(!claimed.meta.changes)throw new HttpError(409,'Shipment setup is already in progress. Refresh the order in a moment.');
    shipping=freshShipping;
    if(shippingMethod==='manual'){
      const manualShipping={...shipping,shippingMethod:'manual',courierName:manualCourierName,courierServiceName:'',courier:manualCourierName,trackingNumber:manualTrackingNumber,waybillId:manualTrackingNumber,trackingUrl:manualTrackingUrl||undefined,shippingNote:undefined,parcelDescription:undefined,trackingStatus:'manual_shipped',shippingAttempts:shipping.shippingAttempts??[]};
      const saved=await database.prepare(`UPDATE checkout_orders SET status='SHIPPED',shipping_status='MANUAL',shipping_waybill_id=?,shipping_tracking_url=?,details=?,dispatched_at=CURRENT_TIMESTAMP,shipping_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND seller_id=? AND status='PAID' AND shipping_status='CREATING'`).bind(manualTrackingNumber,manualTrackingUrl||null,JSON.stringify(manualShipping),id,profile.id).run();
      if(!saved.meta.changes)throw new HttpError(409,'This order was updated elsewhere. Refresh and try again.');
      await sendMarketEmail(row.buyerId,'order-shipped',row.title||'Market order',id);
      return Response.json({ok:true,status:'SHIPPED',trackingNumber:manualTrackingNumber,trackingUrl:manualTrackingUrl||null});
    }
    if(!shipping.sender?.addressLine||!shipping.addressLine||!shipping.phone||!shipping.sender.phone||!shipping.courierCompany||!shipping.courierType)throw new HttpError(400,'The order is missing pickup, delivery, or courier details.');
    let entries:Array<{printingId:string;quantity:number;unitAmount?:number}>;try{entries=JSON.parse(row.items) as typeof entries}catch{entries=[]}
    if(!entries.length)throw new HttpError(400,'This order has no cards to ship.');
    const sender=shipping.sender;
    const postal=(value:string|undefined)=>value&&/^\d{5}$/.test(value)?Number(value):undefined;
    const coordinate=(latitude:number|null|undefined,longitude:number|null|undefined)=>typeof latitude==='number'&&typeof longitude==='number'?{latitude,longitude}:undefined;
    let draftId=retrying?null:row.draftId;
    if(!draftId){
      const created=await biteshipRequest<Result>('/draft_orders',{method:'POST',body:JSON.stringify({reference_id:`VPM-${row.id.slice(0,8).toUpperCase()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`,origin_contact_name:sender.recipientName||'VivrePlay seller',origin_contact_phone:sender.phone,origin_address:`${sender.addressLine}, ${sender.city}`,origin_postal_code:postal(sender.postalCode),origin_area_id:sender.areaId||undefined,origin_coordinate:coordinate(sender.latitude,sender.longitude),destination_contact_name:shipping.recipientName||'VivrePlay buyer',destination_contact_phone:shipping.phone,destination_address:`${shipping.addressLine}, ${shipping.city}`,destination_postal_code:postal(shipping.postalCode),destination_area_id:shipping.areaId||undefined,destination_coordinate:coordinate(shipping.latitude,shipping.longitude),delivery_type:'now',order_note:shippingNote||undefined,items:entries.map(item=>({name:parcelDescription,description:parcelDescription,category:'hobby',value:Math.max(0,item.unitAmount??0),quantity:item.quantity,weight:100,length:18,width:13,height:2}))})});
      draftId=created.id??created.draft_order_id??created.draft_order?.id??null;
      if(!draftId)throw new HttpError(502,'Biteship did not return a draft shipment ID.');
      await database.prepare("UPDATE checkout_orders SET biteship_draft_order_id=?,shipping_status='DRAFT',shipping_updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(draftId,id).run();
    }
    const rates=await biteshipRequest<Result>(`/draft_orders/${encodeURIComponent(draftId)}/rates`);
    const eligible=rates.pricing??rates.draft_order?.rates??[];
    const eligibleRate=eligible.find(rate=>(rate.company??rate.courier_code)===shipping.courierCompany&&rate.type===shipping.courierType);
    if(!eligibleRate)throw new HttpError(409,'The selected courier service is no longer available for this package.');
    const availableCollectionMethods=Array.isArray(eligibleRate.available_collection_method)?eligibleRate.available_collection_method:['pickup'];
    if(!availableCollectionMethods.includes(collectionMethod))throw new HttpError(409,collectionMethod==='drop_off'?'This courier service only offers pickup. Choose pickup to continue.':'This courier service no longer offers pickup. Refresh the order and choose an available option.');
    await biteshipRequest<Result>(`/draft_orders/${encodeURIComponent(draftId)}`,{method:'POST',body:JSON.stringify({courier_company:shipping.courierCompany,courier_type:shipping.courierType,origin_collection_method:collectionMethod,order_note:shippingNote||undefined,items:entries.map(item=>({name:parcelDescription,description:parcelDescription,category:'hobby',value:Math.max(0,item.unitAmount??0),quantity:item.quantity,weight:100,length:18,width:13,height:2}))})});
    const confirmed=await biteshipRequest<Result>(`/draft_orders/${encodeURIComponent(draftId)}/confirm`,{method:'POST',body:JSON.stringify({})});
    const order=confirmed.order??confirmed;
    const biteshipOrderId=confirmed.id??order.id??null;const trackingId=confirmed.courier?.tracking_id??order.tracking_id??confirmed.tracking_id??null;const waybill=confirmed.courier?.waybill_id??order.waybill_id??confirmed.waybill_id??null;const trackingUrl=confirmed.courier?.link??order.link??confirmed.link??null;
    if(!biteshipOrderId&&!trackingId)throw new HttpError(502,'Biteship confirmed the shipment without returning tracking details.');
    const courier=[shipping.courierName,shipping.courierServiceName].filter(Boolean).join(' ');
    const nextShipping={...shipping,shippingMethod:'biteship',collectionMethod,shippingNote:shippingNote||undefined,parcelDescription,courier,trackingNumber:waybill??trackingId??undefined,waybillId:waybill??undefined,trackingUrl:trackingUrl??undefined};
    await database.prepare("UPDATE checkout_orders SET status='SHIPPED',shipping_status='CONFIRMED',biteship_order_id=?,biteship_tracking_id=?,shipping_waybill_id=?,shipping_tracking_url=?,details=?,shipping_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PAID'").bind(biteshipOrderId,trackingId,waybill,trackingUrl,JSON.stringify(nextShipping),id).run();
    await sendMarketEmail(row.buyerId,'order-shipped',row.title||'Market order',id);
    return Response.json({ok:true,status:'SHIPPED',trackingNumber:waybill??trackingId,trackingUrl});
  }catch(error){
    try{const {id}=await params;await db().prepare("UPDATE checkout_orders SET shipping_status=CASE WHEN biteship_draft_order_id IS NULL THEN 'FAILED' ELSE 'DRAFT' END,shipping_updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PAID' AND shipping_status='CREATING'").bind(id).run()}catch{}
    return errorResponse(error);
  }
}
