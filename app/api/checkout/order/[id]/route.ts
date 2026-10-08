import {db,errorResponse,user,HttpError} from '@/lib/server/store';
import {sendMarketEmail} from '@/lib/server/market-notifications';
import {marketCardThumbnails} from '@/lib/server/market-card-thumbnails';
import {ipaymuExpiryTimestamp,ipaymuQrImageUrl} from '@/lib/server/ipaymu';

type OrderRow={id:string;kind:string;buyerId:string;sellerId:string|null;listingId:string|null;items:string;details:string;subtotal:number;sellerNetAmount:number|null;shippingFee:number;amount:number;currency:string;paymentId:string|null;status:string;expiresAt:string|null;updatedAt:string|null;title:string|null;deliveredAt:string|null;disputeStatus:string|null};

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();
    const {id}=await params;
    const database=db();
    const order=await database.prepare(`SELECT o.id,o.kind,o.buyer_id AS buyerId,o.seller_id AS sellerId,o.listing_id AS listingId,o.items,o.details,o.subtotal,o.seller_net_amount AS sellerNetAmount,o.shipping_fee AS shippingFee,o.amount,o.currency,o.payment_id AS paymentId,o.status,o.expires_at AS expiresAt,o.updated_at AS updatedAt,o.delivered_at AS deliveredAt,(SELECT status FROM market_disputes d WHERE d.order_id=o.id) AS disputeStatus,o.shipping_waybill_id AS waybillId,o.shipping_tracking_url AS trackingUrl,l.title FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.id=?`).bind(id).first<OrderRow&{waybillId:string|null;trackingUrl:string|null}>();
    if(!order||(order.buyerId!==profile.id&&order.sellerId!==profile.id))throw new HttpError(404,'Checkout was not found.');
    const viewerRole=order.buyerId===profile.id?'buyer':'seller';

    let items:unknown[]=[];let details:Record<string,unknown>={};
    try{items=JSON.parse(order.items) as unknown[]}catch{}
    try{const parsed=JSON.parse(order.details) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
    const paymentExpiry=details.ipaymuPaymentMethod==='qris'?ipaymuExpiryTimestamp(details.ipaymuPaymentExpiresAt,details.ipaymuPaymentCreatedAt,order.updatedAt):null;
    const paymentExpiresAt=paymentExpiry===null?null:new Date(paymentExpiry).toISOString();
    // Earlier versions closed QRIS orders after the image's five-minute window.
    // Restore one of those orders only while iPaymu's transaction deadline is
    // still ahead and the original listing can safely cover every reserved copy.
    if(order.status==='EXPIRED'&&order.kind==='MARKET'&&order.paymentId&&paymentExpiry!==null&&paymentExpiry>Date.now()){
      const deadline=new Date(paymentExpiry).toISOString().slice(0,19).replace('T',' ');
      const reopened=await database.prepare(`UPDATE checkout_orders SET status='PENDING_PAYMENT',expires_at=?,updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND kind='MARKET' AND status='EXPIRED' AND payment_id IS NOT NULL
        AND EXISTS(
          SELECT 1 FROM listings l WHERE l.id=checkout_orders.listing_id AND l.status='ACTIVE'
            AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)
            AND NOT EXISTS(
              SELECT 1 FROM json_each(checkout_orders.items) mine
              WHERE CAST(json_extract(mine.value,'$.quantity') AS INTEGER)<1
                OR CAST(json_extract(mine.value,'$.quantity') AS INTEGER)+COALESCE((
                  SELECT SUM(CAST(json_extract(theirs.value,'$.quantity') AS INTEGER))
                  FROM checkout_orders other,json_each(other.items) theirs
                  WHERE other.id<>checkout_orders.id AND other.listing_id=checkout_orders.listing_id AND other.kind='MARKET'
                    AND (other.status='PROCESSING' OR (other.status='PENDING_PAYMENT' AND other.expires_at>CURRENT_TIMESTAMP))
                    AND ((json_extract(mine.value,'$.instanceId') IS NOT NULL AND json_extract(theirs.value,'$.instanceId')=json_extract(mine.value,'$.instanceId'))
                      OR (json_extract(mine.value,'$.instanceId') IS NULL AND json_extract(theirs.value,'$.instanceId') IS NULL AND json_extract(theirs.value,'$.printingId')=json_extract(mine.value,'$.printingId')))
                ),0)>COALESCE((
                  SELECT CAST(json_extract(stock.value,'$.quantity') AS INTEGER) FROM json_each(l.items) stock
                  WHERE ((json_extract(mine.value,'$.instanceId') IS NOT NULL AND json_extract(stock.value,'$.instanceId')=json_extract(mine.value,'$.instanceId'))
                    OR (json_extract(mine.value,'$.instanceId') IS NULL AND json_extract(stock.value,'$.instanceId') IS NULL AND json_extract(stock.value,'$.printingId')=json_extract(mine.value,'$.printingId')))
                  LIMIT 1
                ),l.quantity)
            )
        )`).bind(deadline,id).run();
      if(reopened.meta.changes)order.status='PENDING_PAYMENT';
    }
    let effectiveExpiry=paymentExpiresAt??order.expiresAt;
    if(order.status==='PENDING_PAYMENT'&&paymentExpiresAt){
      const providerExpirySql=new Date(paymentExpiry!).toISOString().slice(0,19).replace('T',' ');
      await database.prepare("UPDATE checkout_orders SET expires_at=? WHERE id=? AND status='PENDING_PAYMENT' AND payment_id IS NOT NULL").bind(providerExpirySql,id).run();
      effectiveExpiry=providerExpirySql;
    }
    if(order.status==='PENDING_PAYMENT'&&effectiveExpiry&&new Date(`${effectiveExpiry.replace(' ','T')}Z`).getTime()<=Date.now()){
      const expirySql=paymentExpiresAt?new Date(paymentExpiry!).toISOString().slice(0,19).replace('T',' '):effectiveExpiry;
      const expired=await database.prepare("UPDATE checkout_orders SET status='EXPIRED',expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT'").bind(expirySql,id).run();
      if(expired.meta.changes){
        order.status='EXPIRED';
        if(order.kind==='MARKET'){
          const title=order.title||'Market order';
          await Promise.all([sendMarketEmail(order.buyerId,'order-expired',title,order.id),...(order.sellerId?[sendMarketEmail(order.sellerId,'order-expired',title,order.id)]:[])]);
        }
      }
    }
    const marketFeePercent=typeof details.marketFeePercent==='number'?details.marketFeePercent:order.subtotal>0?Math.max(0,Math.round((order.subtotal-(order.sellerNetAmount??order.subtotal))*10000/order.subtotal)/100):0;
    const marketSellerTier=details.marketSellerTier==='pro'?'pro':details.marketSellerTier==='free'?'free':null;
    const marketStandardFeePercent=typeof details.marketStandardFeePercent==='number'?details.marketStandardFeePercent:null;
    const marketBuyerFeePercent=viewerRole==='buyer'&&typeof details.marketBuyerFeePercent==='number'?details.marketBuyerFeePercent:0;
    const marketBuyerFeeAmount=viewerRole==='buyer'&&typeof details.marketBuyerFeeAmount==='number'?details.marketBuyerFeeAmount:0;
    const marketDisputeRefund=details.marketDisputeResolution&&typeof details.marketDisputeResolution==='object'?details.marketDisputeResolution as {refundAmount?:unknown;shippingRefund?:unknown}:null;
    const disputeRefundAmount=typeof marketDisputeRefund?.refundAmount==='number'?marketDisputeRefund.refundAmount:0;
    const disputeShippingRefund=typeof marketDisputeRefund?.shippingRefund==='number'?marketDisputeRefund.shippingRefund:0;
    const shippingStatusAllowsAddress=['PAID','SHIPPED','RECEIVED','COMPLETED','FULFILLED','PROCESSING'].includes(order.status);
    const shipping=viewerRole==='seller'&&shippingStatusAllowsAddress?{recipientName:details.recipientName,addressLine:details.addressLine,city:details.city,postalCode:details.postalCode,phone:details.phone,label:details.shippingLabel,courierName:details.courierName,courierServiceName:details.courierServiceName,waybillId:order.waybillId,trackingUrl:order.trackingUrl}:viewerRole==='buyer'?{courierName:details.courierName,courierServiceName:details.courierServiceName,waybillId:order.waybillId,trackingUrl:order.trackingUrl}:null;
    const printingIds=items.flatMap(item=>item&&typeof item==='object'&&typeof (item as {printingId?:unknown}).printingId==='string'?[(item as {printingId:string}).printingId]:[]);
    const cards=await marketCardThumbnails(printingIds);
    const sourceIds=[...new Set(items.flatMap(item=>item&&typeof item==='object'&&typeof (item as {listingId?:unknown}).listingId==='string'?[(item as {listingId:string}).listingId]:[]))];
    const sourceTitles=new Map<string,string>();if(sourceIds.length){const sources=await database.prepare(`SELECT id,title FROM listings WHERE id IN (${sourceIds.map(()=>'?').join(',')})`).bind(...sourceIds).all<{id:string;title:string}>();for(const source of sources.results)sourceTitles.set(source.id,source.title);}
    const orderItems=items.map(item=>item&&typeof item==='object'?{...item as Record<string,unknown>,listingId:(item as {listingId?:unknown}).listingId??order.listingId,listingTitle:sourceTitles.get(String((item as {listingId?:unknown}).listingId??order.listingId))??order.title,card:cards.get(String((item as {printingId?:unknown}).printingId??''))??null}:item);
    const paymentExpired=details.ipaymuPaymentMethod==='qris'&&(order.status!=='PENDING_PAYMENT'||paymentExpiry===null||paymentExpiry<=Date.now());
    const paymentMode=details.ipaymuMode??process.env.IPAYMU_MODE;
    const paymentQrSource=viewerRole==='buyer'&&details.ipaymuPaymentMethod==='qris'&&!paymentExpired?ipaymuQrImageUrl(details.ipaymuPaymentQrImage,paymentMode):null;
    // iPaymu's QR URL serves an HTML page with an embedded PNG, not an image
    // response. Keep the browser same-origin and let the QR route extract it.
    const paymentQrImage=paymentQrSource?`/api/checkout/order/${encodeURIComponent(order.id)}/qris`:null;
    const hasActivePayment=order.status==='PENDING_PAYMENT'&&Boolean(order.paymentId);
    const canCancel=order.kind==='MARKET'&&order.status==='PENDING_PAYMENT'&&!order.paymentId&&(!order.expiresAt||new Date(`${order.expiresAt.replace(' ','T')}Z`).getTime()>Date.now());
    return Response.json({id:order.id,kind:order.kind,status:order.status,viewerRole,listingId:order.listingId,title:order.title??'VivrePlay Market Pro',membershipDurationDays:order.kind==='PRO'&&Number.isInteger(Number(details.durationDays))?Number(details.durationDays):null,items:orderItems,details:{},shipping,sellerNetAmount:order.sellerNetAmount,marketFeePercent,marketSellerTier,marketStandardFeePercent,marketBuyerFeePercent,marketBuyerFeeAmount,disputeRefundAmount,disputeShippingRefund,shippingDiscount:viewerRole==='buyer'&&typeof details.marketProShippingDiscount==='number'?details.marketProShippingDiscount:0,waybillId:order.waybillId,trackingUrl:order.trackingUrl,deliveredAt:order.deliveredAt,disputeStatus:order.disputeStatus,checkoutUrl:viewerRole==='buyer'&&!paymentExpired&&typeof details.ipaymuCheckoutUrl==='string'?details.ipaymuCheckoutUrl:null,paymentMethod:viewerRole==='buyer'?details.ipaymuPaymentMethod??null:null,paymentMode:paymentMode==='sandbox'?'sandbox':'production',paymentFee:viewerRole==='buyer'&&typeof details.ipaymuPaymentFee==='number'?details.ipaymuPaymentFee:null,paymentExpiresAt:paymentExpiresAt,paymentExpired,paymentQrImage,paymentQrString:viewerRole==='buyer'&&!paymentExpired&&typeof details.ipaymuPaymentQrString==='string'?details.ipaymuPaymentQrString:null,canCancel,hasActivePayment,subtotal:order.subtotal,shippingFee:order.shippingFee,amount:order.amount,currency:order.currency,expiresAt:effectiveExpiry});
  }catch(error){return errorResponse(error)}
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();
    const {id}=await params;
    const database=db();
    const order=await database.prepare("SELECT o.id,o.kind,o.buyer_id AS buyerId,o.seller_id AS sellerId,o.items,o.currency,o.status,l.title FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.id=?").bind(id).first<{id:string;kind:string;buyerId:string;sellerId:string|null;items:string;currency:string;status:string;title:string|null}>();
    if(!order||order.buyerId!==profile.id)throw new HttpError(404,'Order was not found.');
    if(order.kind!=='MARKET')throw new HttpError(400,'Only delivered Market orders can be added to your Vault.');
    if(order.status==='RECEIVED')return Response.json({ok:true,status:'RECEIVED'});
    if(order.status!=='SHIPPED')throw new HttpError(409,'The seller must arrange shipping before delivery can be confirmed.');
    let items:Array<{printingId:string;quantity:number;unitAmount?:number;condition?:string}>;
    try{items=JSON.parse(order.items) as typeof items}catch{throw new HttpError(500,'The order cards could not be loaded.');}
    if(!items.length)throw new HttpError(400,'This order has no cards to add.');
    const purchases=new Map<string,{printingId:string;condition:string;quantity:number;amount:number}>();
    for(const item of items){
      if(!item.printingId||!Number.isInteger(item.quantity)||item.quantity<1)throw new HttpError(500,'The order contains invalid card details.');
      const condition=item.condition||'NM';
      const key=`${item.printingId}:${condition}`;
      const purchase=purchases.get(key)??{printingId:item.printingId,condition,quantity:0,amount:0};
      purchase.quantity+=item.quantity;
      purchase.amount+=Math.max(0,Math.round(item.unitAmount??0))*item.quantity;
      purchases.set(key,purchase);
    }
    const statements=[];
    for(const purchase of purchases.values()){
      const existing=await database.prepare(`SELECT id,quantity,acquisition_amount AS acquisitionAmount FROM collectible_instances c WHERE owner_id=? AND printing_id=? AND type='RAW' AND condition=? AND currency=? AND deleted_at IS NULL AND visibility='private' AND NOT EXISTS(SELECT 1 FROM listings l WHERE l.instance_id=c.id AND l.status='ACTIVE') LIMIT 1`)
        .bind(order.buyerId,purchase.printingId,purchase.condition,order.currency).first<{id:string;quantity:number;acquisitionAmount:number}>();
      if(existing){
        statements.push(database.prepare('UPDATE collectible_instances SET quantity=?,acquisition_amount=? WHERE id=? AND owner_id=?').bind(existing.quantity+purchase.quantity,existing.acquisitionAmount+purchase.amount,existing.id,order.buyerId));
      }else{
        statements.push(database.prepare("INSERT INTO collectible_instances (id,owner_id,printing_id,type,quantity,condition,visibility,acquisition_amount,currency,acquired_at,notes) VALUES (?,?,?,'RAW',?,?,'private',?,?,CURRENT_TIMESTAMP,NULL)")
          .bind(crypto.randomUUID(),order.buyerId,purchase.printingId,purchase.quantity,purchase.condition,purchase.amount,order.currency));
      }
    }
    statements.push(database.prepare("UPDATE checkout_orders SET status='RECEIVED',fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND buyer_id=? AND status='RECEIVING'").bind(id,profile.id));
    const claim=await database.prepare(`UPDATE checkout_orders SET status='RECEIVING' WHERE id=? AND buyer_id=? AND status='SHIPPED' AND NOT EXISTS(SELECT 1 FROM market_disputes WHERE order_id=? AND status!='RESOLVED')`).bind(id,profile.id,id).run();
    if(!claim.meta.changes)throw new HttpError(409,'This order has an open report or was updated elsewhere. Refresh the order before continuing.');
    try{await database.batch(statements)}catch(error){await database.prepare("UPDATE checkout_orders SET status='SHIPPED' WHERE id=? AND status='RECEIVING'").bind(id).run();throw error;}
    if(order.sellerId)await sendMarketEmail(order.sellerId,'order-received',order.title||'Market order',order.id);
    const updated=await database.prepare('SELECT status FROM checkout_orders WHERE id=?').bind(id).first<{status:string}>();
    return Response.json({ok:true,status:updated?.status??'RECEIVED'});
  }catch(error){return errorResponse(error)}
}
