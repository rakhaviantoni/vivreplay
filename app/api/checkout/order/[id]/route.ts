import {db,errorResponse,user,HttpError} from '@/lib/server/store';
import {sendMarketEmail} from '@/lib/server/market-notifications';
import {completeDeliveredMarketOrder} from '@/lib/server/market-order-fulfillment';
import {marketCardThumbnails} from '@/lib/server/market-card-thumbnails';
import {getIpaymuMode,getIpaymuTransaction,ipaymuExpiryTimestamp,ipaymuPayableTotal,ipaymuQrImageUrl} from '@/lib/server/ipaymu';
import {marketShippingDeadline} from '@/lib/market/shipping-deadline';

type OrderRow={id:string;kind:string;buyerId:string;sellerId:string|null;listingId:string|null;items:string;details:string;subtotal:number;sellerNetAmount:number|null;shippingFee:number;amount:number;currency:string;paymentId:string|null;status:string;expiresAt:string|null;createdAt:string|null;updatedAt:string|null;paidAt:string|null;title:string|null;deliveredAt:string|null;disputeStatus:string|null;trackingId:string|null};

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();
    const {id}=await params;
    const database=db();
    const order=await database.prepare(`SELECT o.id,o.kind,o.buyer_id AS buyerId,o.seller_id AS sellerId,o.listing_id AS listingId,o.items,o.details,o.subtotal,o.seller_net_amount AS sellerNetAmount,o.shipping_fee AS shippingFee,o.amount,o.currency,o.payment_id AS paymentId,o.status,o.expires_at AS expiresAt,o.created_at AS createdAt,o.updated_at AS updatedAt,o.paid_at AS paidAt,o.delivered_at AS deliveredAt,(SELECT status FROM market_disputes d WHERE d.order_id=o.id) AS disputeStatus,o.biteship_tracking_id AS trackingId,o.shipping_waybill_id AS waybillId,o.shipping_tracking_url AS trackingUrl,l.title FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.id=?`).bind(id).first<OrderRow&{waybillId:string|null;trackingUrl:string|null}>();
    if(!order||(order.buyerId!==profile.id&&order.sellerId!==profile.id))throw new HttpError(404,'Checkout was not found.');
    if(order.kind==='MARKET'&&order.status==='SHIPPED'&&order.deliveredAt){
      const completed=await completeDeliveredMarketOrder(order.id,order.buyerId,true);
      if(completed.completed)order.status=completed.status;
    }
    const viewerRole=order.buyerId===profile.id?'buyer':'seller';

    let items:unknown[]=[];let details:Record<string,unknown>={};
    try{items=JSON.parse(order.items) as unknown[]}catch{}
    try{const parsed=JSON.parse(order.details) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
    let paymentAwaitingConfirmation=details.ipaymuPaymentAwaitingConfirmation===true;
    const recordedAttemptCount=Number(details.ipaymuAttemptCount)||1;
    const lastAttemptStatusCheck=Date.parse(String(details.ipaymuAttemptStatusCheckedAt??''));
    const attemptIds=Array.isArray(details.ipaymuActiveTransactionIds)?[...new Set(details.ipaymuActiveTransactionIds.map(String).filter(value=>/^\d{3,20}$/.test(value)))].slice(0,5):[];
    if(viewerRole==='buyer'&&order.status==='PENDING_PAYMENT'&&recordedAttemptCount>1&&attemptIds.length>1&&(!Number.isFinite(lastAttemptStatusCheck)||Date.now()-lastAttemptStatusCheck>30_000)){
      try{
        const originalPaymentId=order.paymentId;
        const attempts=await Promise.all(attemptIds.map(async transactionId=>{
          try{
            const gateway=await getIpaymuTransaction(transactionId);
            const status=Number(gateway.Status);
            if(!Number.isFinite(status)||(gateway.ReferenceId&&String(gateway.ReferenceId)!==order.id))return null;
            return {transactionId,gateway,status};
          }catch{return null}
        }));
        if(attempts.every((attempt):attempt is NonNullable<typeof attempt>=>attempt!==null)){
          const successfulAttempt=attempts.find(attempt=>attempt.status===1||attempt.status===6);
          const pendingAttempts=attempts.filter(attempt=>attempt.status===0);
          const currentAttempt=pendingAttempts.find(attempt=>attempt.transactionId===String(details.ipaymuTransactionId??''));
          const selectedAttempt=successfulAttempt??currentAttempt??pendingAttempts[0]??null;
          details.ipaymuAttemptStatusCheckedAt=new Date().toISOString();
          details.ipaymuAttemptCount=successfulAttempt?1:pendingAttempts.length;
          details.ipaymuActiveTransactionIds=successfulAttempt?[successfulAttempt.transactionId]:pendingAttempts.map(attempt=>attempt.transactionId);
          paymentAwaitingConfirmation=Boolean(successfulAttempt);
          details.ipaymuPaymentAwaitingConfirmation=paymentAwaitingConfirmation;
          if(selectedAttempt){
            const {gateway,transactionId}=selectedAttempt;
            const sessionId=String(gateway.SessionId??gateway.SessionID??transactionId);
            const method=String(gateway.Via??details.ipaymuPaymentMethod??'').toLowerCase();
            const channel=String(gateway.Channel??details.ipaymuPaymentChannel??'').toLowerCase();
            const rawUrl=typeof gateway.Url==='string'?gateway.Url:null;
            let checkoutUrl:string|null=null;
            try{
              if(rawUrl){
                const parsed=new URL(rawUrl);
                const sandbox=getIpaymuMode()==='sandbox';
                const allowedHosts=sandbox?['sandbox.ipaymu.com','sandbox-payment.ipaymu.com']:['my.ipaymu.com','payment.ipaymu.com'];
                if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&(!parsed.port||parsed.port==='443')&&allowedHosts.includes(parsed.hostname))checkoutUrl=parsed.toString();
              }
            }catch{}
            details.ipaymuPaymentMethod=method||details.ipaymuPaymentMethod;
            details.ipaymuPaymentChannel=channel||details.ipaymuPaymentChannel;
            details.ipaymuPaymentName=String(gateway.PaymentName??details.ipaymuPaymentName??details.ipaymuSelectedName??channel.toUpperCase());
            details.ipaymuPaymentNo=gateway.PaymentNo==null?null:String(gateway.PaymentNo);
            details.ipaymuCheckoutUrl=checkoutUrl;
            details.ipaymuTransactionId=transactionId;
            details.ipaymuSessionId=sessionId;
            details.ipaymuPaymentFee=Number.isFinite(Number(gateway.Fee))?Math.round(Number(gateway.Fee)):null;
            details.ipaymuPaymentTotal=ipaymuPayableTotal(order.amount,method,details.ipaymuPaymentFee,gateway.Total);
            details.ipaymuPaymentCreatedAt=gateway.CreatedDate??details.ipaymuPaymentCreatedAt;
            details.ipaymuPaymentExpiresAt=gateway.ExpiredDate??details.ipaymuPaymentExpiresAt;
            details.ipaymuMode=getIpaymuMode();
            order.paymentId=sessionId;
            if(gateway.ExpiredDate)order.expiresAt=String(gateway.ExpiredDate);
          }else{
            for(const key of ['ipaymuPaymentMethod','ipaymuPaymentChannel','ipaymuPaymentName','ipaymuPaymentNo','ipaymuPaymentInstructionsUrl','ipaymuCheckoutUrl','ipaymuPaymentQrImage','ipaymuPaymentQrString','ipaymuTransactionId','ipaymuSessionId','ipaymuPaymentFee','ipaymuPaymentTotal','ipaymuPaymentCreatedAt','ipaymuPaymentExpiresAt','ipaymuMode','ipaymuPaymentAwaitingConfirmation'])delete details[key];
            paymentAwaitingConfirmation=false;
            order.paymentId=null;
          }
          const saved=await database.prepare("UPDATE checkout_orders SET payment_id=?,details=?,expires_at=COALESCE(?,expires_at),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id IS ?").bind(order.paymentId,JSON.stringify(details),selectedAttempt?.gateway.ExpiredDate??null,order.id,originalPaymentId).run();
          if(!saved.meta.changes){
            const latest=await database.prepare('SELECT payment_id AS paymentId FROM checkout_orders WHERE id=?').bind(order.id).first<{paymentId:string|null}>();
            order.paymentId=latest?.paymentId??order.paymentId;
          }
        }
      }catch(error){console.error('ipaymu_attempt_status_refresh_failed',{orderId:order.id,error:error instanceof Error?error.message:'unknown'})}
    }
    const paymentExpiry=order.paymentId&&details.ipaymuPaymentMethod?ipaymuExpiryTimestamp(details.ipaymuPaymentExpiresAt,details.ipaymuPaymentCreatedAt,order.updatedAt):null;
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
    const canViewShipping=(viewerRole==='seller'&&shippingStatusAllowsAddress)||viewerRole==='buyer';
    const shipping=canViewShipping?{recipientName:details.recipientName,addressLine:details.addressLine,city:details.city,postalCode:details.postalCode,phone:details.phone,label:details.shippingLabel,courierName:details.courierName,courierCode:details.courierCode,courierServiceName:details.courierServiceName,shippingMethod:details.shippingMethod==='manual'?'manual':'biteship',shippingNote:details.shippingMethod==='manual'?null:typeof details.shippingNote==='string'?details.shippingNote:null,availableCollectionMethods:Array.isArray(details.availableCollectionMethods)?details.availableCollectionMethods.filter((method):method is string=>method==='pickup'||method==='drop_off'):['pickup'],collectionMethod:details.collectionMethod==='drop_off'?'drop_off':details.collectionMethod==='pickup'?'pickup':null,trackingStatus:details.trackingStatus,trackingHistory:Array.isArray(details.trackingHistory)?details.trackingHistory:[],waybillId:order.waybillId,trackingUrl:order.trackingUrl}:null;
    const printingIds=items.flatMap(item=>item&&typeof item==='object'&&typeof (item as {printingId?:unknown}).printingId==='string'?[(item as {printingId:string}).printingId]:[]);
    const cards=await marketCardThumbnails(printingIds);
    const sourceIds=[...new Set(items.flatMap(item=>item&&typeof item==='object'&&typeof (item as {listingId?:unknown}).listingId==='string'?[(item as {listingId:string}).listingId]:[]))];
    const sourceTitles=new Map<string,string>();if(sourceIds.length){const sources=await database.prepare(`SELECT id,title FROM listings WHERE id IN (${sourceIds.map(()=>'?').join(',')})`).bind(...sourceIds).all<{id:string;title:string}>();for(const source of sources.results)sourceTitles.set(source.id,source.title);}
    const orderItems=items.map(item=>{if(!item||typeof item!=='object')return item;const entry=item as Record<string,unknown>;const photoIds=Array.isArray(entry.photoIds)?entry.photoIds.filter((value):value is string=>typeof value==='string'):[];return {...entry,listingId:entry.listingId??order.listingId,listingTitle:sourceTitles.get(String(entry.listingId??order.listingId))??order.title,photoUrls:photoIds.map(photoId=>`/api/market/product-photos/${encodeURIComponent(photoId)}`),card:cards.get(String(entry.printingId??''))??null};});
    const cartListingTitles=sourceIds.map(sourceId=>sourceTitles.get(sourceId)).filter((title):title is string=>Boolean(title));
    const displayTitle=cartListingTitles.length>1?`${cartListingTitles.slice(0,2).join(' + ')}${cartListingTitles.length>2?` + ${cartListingTitles.length-2} more listings`:''}`:order.title??'Market order';
    const paymentExpired=Boolean(order.paymentId&&details.ipaymuPaymentMethod)&&(order.status!=='PENDING_PAYMENT'||paymentExpiry===null||paymentExpiry<=Date.now());
    const paymentTotal=ipaymuPayableTotal(order.amount,details.ipaymuPaymentMethod,details.ipaymuPaymentFee,details.ipaymuPaymentTotal);
    const paymentMode=details.ipaymuMode??process.env.IPAYMU_MODE;
    const paymentQrSource=viewerRole==='buyer'&&details.ipaymuPaymentMethod==='qris'&&!paymentExpired?ipaymuQrImageUrl(details.ipaymuPaymentQrImage,paymentMode):null;
    // iPaymu's QR URL serves an HTML page with an embedded PNG, not an image
    // response. Keep the browser same-origin and let the QR route extract it.
    const paymentQrImage=details.ipaymuPaymentMethod==='qris'&&paymentQrSource?`/api/checkout/order/${encodeURIComponent(order.id)}/qris`:null;
    const legacyPaymentCheck=order.status==='PENDING_PAYMENT'&&!order.paymentId&&typeof details.ipaymuSelectedMethod==='string';
    const updatedAtMs=order.updatedAt?Date.parse(`${order.updatedAt.replace(' ','T')}Z`):NaN;
    const createdAtMs=order.createdAt?Date.parse(`${order.createdAt.replace(' ','T')}Z`):NaN;
    const unmarkedPaymentCheck=order.status==='PENDING_PAYMENT'&&!order.paymentId&&!details.ipaymuPaymentRecoveryCheckedAt&&Number.isFinite(updatedAtMs)&&Number.isFinite(createdAtMs)&&updatedAtMs-createdAtMs>45_000;
    const paymentCreating=order.status==='PENDING_PAYMENT'&&Boolean(order.paymentId?.startsWith('CREATING:')||legacyPaymentCheck||unmarkedPaymentCheck);
    const hasActivePayment=order.status==='PENDING_PAYMENT'&&Boolean(order.paymentId&&!paymentCreating);
    const paymentNeedsHelp=hasActivePayment&&details.ipaymuPaymentMethod!=='qris'&&!details.ipaymuCheckoutUrl&&!details.ipaymuPaymentNo;
    const canCancel=order.kind==='MARKET'&&order.status==='PENDING_PAYMENT'&&!order.paymentId&&(!order.expiresAt||new Date(`${order.expiresAt.replace(' ','T')}Z`).getTime()>Date.now());
    const manualShippingReimbursement=viewerRole==='seller'&&details.shippingMethod==='manual'?Math.max(0,order.shippingFee-(typeof details.marketProShippingDiscount==='number'?details.marketProShippingDiscount:0)-disputeShippingRefund):0;
    const response=Response.json({id:order.id,kind:order.kind,status:order.status,viewerRole,shippingDeadline:order.kind==='MARKET'&&order.status==='PAID'?marketShippingDeadline(order.paidAt):null,listingId:order.listingId,title:order.kind==='PRO'?'VivrePlay Market Pro':displayTitle,membershipDurationDays:order.kind==='PRO'&&Number.isInteger(Number(details.durationDays))?Number(details.durationDays):null,items:orderItems,details:{},shipping,sellerNetAmount:order.sellerNetAmount,manualShippingReimbursement,marketFeePercent,marketSellerTier,marketStandardFeePercent,marketBuyerFeePercent,marketBuyerFeeAmount,disputeRefundAmount,disputeShippingRefund,shippingDiscount:viewerRole==='buyer'&&typeof details.marketProShippingDiscount==='number'?details.marketProShippingDiscount:0,trackingId:order.trackingId,waybillId:order.waybillId,trackingUrl:order.trackingUrl,deliveredAt:order.deliveredAt,disputeStatus:order.disputeStatus,checkoutUrl:viewerRole==='buyer'&&!paymentExpired&&typeof details.ipaymuCheckoutUrl==='string'?details.ipaymuCheckoutUrl:null,paymentMethod:viewerRole==='buyer'?details.ipaymuPaymentMethod??details.ipaymuSelectedMethod??null:null,paymentChannel:viewerRole==='buyer'?details.ipaymuPaymentChannel??details.ipaymuSelectedChannel??null:null,paymentName:viewerRole==='buyer'?details.ipaymuPaymentName??details.ipaymuSelectedName??null:null,paymentNo:viewerRole==='buyer'&&!paymentExpired?details.ipaymuPaymentNo??null:null,paymentInstructionsUrl:viewerRole==='buyer'?details.ipaymuPaymentInstructionsUrl??null:null,paymentMode:paymentMode==='sandbox'?'sandbox':'production',paymentFee:viewerRole==='buyer'&&typeof details.ipaymuPaymentFee==='number'?details.ipaymuPaymentFee:null,paymentTotal:viewerRole==='buyer'?paymentTotal:order.amount,paymentExpiresAt:paymentExpiresAt,paymentExpired,paymentQrImage,paymentQrString:viewerRole==='buyer'&&!paymentExpired&&typeof details.ipaymuPaymentQrString==='string'?details.ipaymuPaymentQrString:null,canCancel,paymentCreating,hasActivePayment,paymentNeedsHelp,paymentAwaitingConfirmation,activeAttemptCount:Number(details.ipaymuAttemptCount)||1,subtotal:order.subtotal,shippingFee:order.shippingFee,amount:order.amount,currency:order.currency,expiresAt:effectiveExpiry});response.headers.set('Cache-Control','private, no-store, max-age=0');return response;
  }catch(error){return errorResponse(error)}
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();
    const {id}=await params;
    const result=await completeDeliveredMarketOrder(id,profile.id);
    return Response.json({ok:true,status:result.status});
  }catch(error){return errorResponse(error)}
}
