import {db,errorResponse,user,HttpError} from '@/lib/server/store';
import {sendMarketEmail} from '@/lib/server/market-notifications';
import {marketCardThumbnails} from '@/lib/server/market-card-thumbnails';
import {ipaymuExpiryTimestamp,ipaymuQrImageUrl} from '@/lib/server/ipaymu';

type OrderRow={id:string;kind:string;buyerId:string;sellerId:string|null;listingId:string|null;items:string;details:string;subtotal:number;sellerNetAmount:number|null;shippingFee:number;amount:number;currency:string;paymentId:string|null;status:string;expiresAt:string|null;updatedAt:string|null;title:string|null};

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();
    const {id}=await params;
    const database=db();
    const order=await database.prepare(`SELECT o.id,o.kind,o.buyer_id AS buyerId,o.seller_id AS sellerId,o.listing_id AS listingId,o.items,o.details,o.subtotal,o.seller_net_amount AS sellerNetAmount,o.shipping_fee AS shippingFee,o.amount,o.currency,o.payment_id AS paymentId,o.status,o.expires_at AS expiresAt,o.updated_at AS updatedAt,o.shipping_waybill_id AS waybillId,o.shipping_tracking_url AS trackingUrl,l.title FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.id=?`).bind(id).first<OrderRow&{waybillId:string|null;trackingUrl:string|null}>();
    if(!order||(order.buyerId!==profile.id&&order.sellerId!==profile.id))throw new HttpError(404,'Checkout was not found.');
    const viewerRole=order.buyerId===profile.id?'buyer':'seller';

    let items:unknown[]=[];let details:Record<string,unknown>={};
    try{items=JSON.parse(order.items) as unknown[]}catch{}
    try{const parsed=JSON.parse(order.details) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
    const paymentExpiry=details.ipaymuPaymentMethod==='qris'?ipaymuExpiryTimestamp(details.ipaymuPaymentExpiresAt,details.ipaymuPaymentCreatedAt,order.updatedAt):null;
    const paymentExpiresAt=paymentExpiry===null?null:new Date(paymentExpiry).toISOString();
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
    const shippingStatusAllowsAddress=['PAID','SHIPPED','RECEIVED','COMPLETED','FULFILLED','PROCESSING'].includes(order.status);
    const shipping=viewerRole==='seller'&&shippingStatusAllowsAddress?{recipientName:details.recipientName,addressLine:details.addressLine,city:details.city,postalCode:details.postalCode,phone:details.phone,label:details.shippingLabel,courierName:details.courierName,courierServiceName:details.courierServiceName,waybillId:order.waybillId,trackingUrl:order.trackingUrl}:viewerRole==='buyer'?{courierName:details.courierName,courierServiceName:details.courierServiceName,waybillId:order.waybillId,trackingUrl:order.trackingUrl}:null;
    const printingIds=items.flatMap(item=>item&&typeof item==='object'&&typeof (item as {printingId?:unknown}).printingId==='string'?[(item as {printingId:string}).printingId]:[]);
    const cards=await marketCardThumbnails(printingIds);
    const orderItems=items.map(item=>item&&typeof item==='object'?{...item as Record<string,unknown>,card:cards.get(String((item as {printingId?:unknown}).printingId??''))??null}:item);
    const paymentExpired=details.ipaymuPaymentMethod==='qris'&&(paymentExpiry===null||paymentExpiry<=Date.now());
    const paymentMode=details.ipaymuMode??process.env.IPAYMU_MODE;
    const paymentQrSource=viewerRole==='buyer'&&details.ipaymuPaymentMethod==='qris'&&!paymentExpired?ipaymuQrImageUrl(details.ipaymuPaymentQrImage,paymentMode):null;
    // iPaymu serves this QR as an image URL. Use it directly so browser refreshes
    // can retrieve the provider image without relying on an HTML image proxy.
    const paymentQrImage=paymentQrSource;
    const hasActivePayment=order.status==='PENDING_PAYMENT'&&Boolean(order.paymentId);
    const canCancel=order.kind==='MARKET'&&order.status==='PENDING_PAYMENT'&&!order.paymentId&&(!order.expiresAt||new Date(`${order.expiresAt.replace(' ','T')}Z`).getTime()>Date.now());
    return Response.json({id:order.id,kind:order.kind,status:order.status,viewerRole,title:order.title??'VivrePlay Market Pro',items:orderItems,details:{},shipping,sellerNetAmount:order.sellerNetAmount,marketFeePercent,marketSellerTier,marketStandardFeePercent,marketBuyerFeePercent,marketBuyerFeeAmount,shippingDiscount:viewerRole==='buyer'&&typeof details.marketProShippingDiscount==='number'?details.marketProShippingDiscount:0,waybillId:order.waybillId,trackingUrl:order.trackingUrl,checkoutUrl:viewerRole==='buyer'&&!paymentExpired&&typeof details.ipaymuCheckoutUrl==='string'?details.ipaymuCheckoutUrl:null,paymentMethod:viewerRole==='buyer'?details.ipaymuPaymentMethod??null:null,paymentMode:paymentMode==='sandbox'?'sandbox':'production',paymentFee:viewerRole==='buyer'&&typeof details.ipaymuPaymentFee==='number'?details.ipaymuPaymentFee:null,paymentExpiresAt:order.kind==='MARKET'?paymentExpiresAt:null,paymentExpired,paymentQrImage,paymentQrString:viewerRole==='buyer'&&!paymentExpired&&typeof details.ipaymuPaymentQrString==='string'?details.ipaymuPaymentQrString:null,canCancel,hasActivePayment,subtotal:order.subtotal,shippingFee:order.shippingFee,amount:order.amount,currency:order.currency,expiresAt:effectiveExpiry});
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
    statements.push(database.prepare("UPDATE checkout_orders SET status='RECEIVED',fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND buyer_id=? AND status='SHIPPED'").bind(id,profile.id));
    await database.batch(statements);
    if(order.sellerId)await sendMarketEmail(order.sellerId,'order-received',order.title||'Market order',order.id);
    const updated=await database.prepare('SELECT status FROM checkout_orders WHERE id=?').bind(id).first<{status:string}>();
    return Response.json({ok:true,status:updated?.status??'RECEIVED'});
  }catch(error){return errorResponse(error)}
}
