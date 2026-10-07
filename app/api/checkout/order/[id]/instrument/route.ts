import {db,errorResponse,user,HttpError} from '@/lib/server/store';
import {getCurrentUser} from '@/lib/server/auth';
import {createIpaymuQris,createIpaymuRedirect,hasMarketIpaymuPaymentConfig,ipaymuExpiryTimestamp,ipaymuQrImageUrl} from '@/lib/server/ipaymu';

type Order={id:string;kind:string;buyerId:string;sellerId:string|null;listingId:string|null;items:string;details:string;subtotal:number;amount:number;shippingFee:number;title:string|null;paymentId:string|null;status:string;expiresAt:string|null;updatedAt:string|null};
type OrderItem={printingId:string;quantity:number;unitAmount:number};

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();
    const account=await getCurrentUser();
    if(!account?.email)throw new HttpError(401,'Sign in with an email address to continue.');
    const {id}=await params;
    const database=db();
    const order=await database.prepare(`SELECT o.id,o.kind,o.buyer_id AS buyerId,o.seller_id AS sellerId,o.listing_id AS listingId,o.items,o.details,o.subtotal,o.amount,o.shipping_fee AS shippingFee,o.payment_id AS paymentId,o.status,o.expires_at AS expiresAt,o.updated_at AS updatedAt,l.title FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.id=?`).bind(id).first<Order>();
    if(!order||order.buyerId!==profile.id)throw new HttpError(404,'Checkout was not found.');
    if(order.kind==='MARKET'&&!hasMarketIpaymuPaymentConfig())throw new HttpError(503,'Market payments require an iPaymu sandbox account or explicit live-payment enablement.');
    if(order.status!=='PENDING_PAYMENT')throw new HttpError(409,'This checkout is no longer payable.');
    if(order.expiresAt&&new Date(`${order.expiresAt.replace(' ','T')}Z`).getTime()<=Date.now()){
      await database.prepare("UPDATE checkout_orders SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT'").bind(id).run();
      throw new HttpError(409,'This checkout has expired. Start a new checkout to continue.');
    }
    let details:Record<string,unknown>={};
    try{details=JSON.parse(order.details) as Record<string,unknown>}catch{}
    const existingPaymentExpiry=details.ipaymuPaymentMethod==='qris'?ipaymuExpiryTimestamp(details.ipaymuPaymentExpiresAt,details.ipaymuPaymentCreatedAt,order.updatedAt):null;
    const existingUrl=typeof details.ipaymuCheckoutUrl==='string'?details.ipaymuCheckoutUrl:null;
    const existingQrImage=typeof details.ipaymuPaymentQrImage==='string'?details.ipaymuPaymentQrImage:null;
    const existingQrUrl=ipaymuQrImageUrl(existingQrImage,details.ipaymuMode);
    if(order.paymentId&&existingQrImage&&details.ipaymuPaymentMethod==='qris'&&existingPaymentExpiry!==null&&existingPaymentExpiry>Date.now()){
      if(!existingQrUrl)throw new HttpError(502,'The payment provider returned an invalid QR code address.');
      return Response.json({paymentMethod:'qris',qrImage:`/api/checkout/order/${encodeURIComponent(order.id)}/qris`,qrString:details.ipaymuPaymentQrString??null,paymentFee:details.ipaymuPaymentFee??null,expiresAt:new Date(existingPaymentExpiry).toISOString(),reused:true});
    }
    if(order.paymentId&&existingUrl&&details.ipaymuPaymentMethod!=='qris')return Response.json({checkoutUrl:existingUrl,paymentMethod:details.ipaymuPaymentMethod??'hosted',expiresAt:null,reused:true});
    if(order.paymentId&&details.ipaymuPaymentMethod==='qris'&&existingPaymentExpiry!==null&&existingPaymentExpiry<=Date.now()){
      throw new HttpError(409,'This QRIS window has ended. We are confirming the payment status; you cannot start another payment for this order yet.');
    }

    const baseUrl=process.env.VIVREPLAY_PUBLIC_URL?.trim().replace(/\/$/,'')||'https://vivreplay.com';
    const callbackOrigin=new URL(request.url).origin;
    const origin=process.env.IPAYMU_MODE==='sandbox'?callbackOrigin:baseUrl;
    const notifyUrl=process.env.IPAYMU_CALLBACK_URL?.trim()||`${origin}/api/checkout/ipaymu/callback`;
    let products:OrderItem[]=[];
    if(order.kind==='MARKET'){
      try{products=JSON.parse(order.items) as OrderItem[]}catch{throw new HttpError(500,'The selected cards could not be loaded.');}
      if(!products.length||products.some(item=>!item.printingId||!Number.isInteger(item.quantity)||item.quantity<1||!Number.isSafeInteger(item.unitAmount)||item.unitAmount<0))throw new HttpError(500,'The selected cards could not be loaded.');
    }
    const productLines=order.kind==='PRO'
      ?[{name:'VivrePlay Market Pro',quantity:1,unitPrice:order.amount,description:`Market Pro membership · ${Number(details.durationDays)||0} days`}]
      :[
        ...products.map(item=>({name:item.printingId,quantity:item.quantity,unitPrice:item.unitAmount,description:`One Piece Card Game card · ${item.printingId}`})),
        ...(order.shippingFee>0?[{name:'Delivery',quantity:1,unitPrice:order.shippingFee,description:'Courier delivery for this Market order'}]:[]),
      ];
    let buyerServiceFee=order.kind==='MARKET'&&Number.isSafeInteger(details.marketBuyerFeeAmount)?Number(details.marketBuyerFeeAmount):0;
    // The order's saved subtotal and delivery fee are the checkout snapshot. Rebuilding
    // the total from card lines can drift for grouped or repriced listings, even though
    // the amount shown to the buyer is still correct.
    if(order.kind==='MARKET'){
      const savedFee=order.amount-order.subtotal-order.shippingFee;
      if(!Number.isSafeInteger(savedFee)||savedFee<0)throw new HttpError(409,'This order needs to be refreshed before payment.');
      if(savedFee!==buyerServiceFee){
        buyerServiceFee=savedFee;
        details.marketBuyerFeeAmount=savedFee;
        await database.prepare("UPDATE checkout_orders SET details=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id IS NULL").bind(JSON.stringify(details),id).run();
      }
    }
    const total=order.kind==='MARKET'
      ?order.subtotal+order.shippingFee+buyerServiceFee
      :productLines.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0);
    if(total!==order.amount)throw new HttpError(409,'This order needs to be refreshed before payment.');
    const name=typeof details.customerName==='string'?details.customerName:typeof details.recipientName==='string'?details.recipientName:profile.display_name||'VivrePlay customer';
    const phone=typeof details.customerPhone==='string'?details.customerPhone:typeof details.phone==='string'?details.phone:'';
    const paymentClaim=order.kind==='MARKET'?`CREATING:${crypto.randomUUID()}`:null;
    if(paymentClaim){
      const claimed=await database.prepare("UPDATE checkout_orders SET payment_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id IS NULL").bind(paymentClaim,id).run();
      if(!claimed.meta.changes)throw new HttpError(409,'This order is already being paid or has changed. Refresh to check its status.');
    }
    let payment: {url?:string;sessionId?:string;transactionId?:string;qrImage?:string;qrString?:string|null;fee?:number|null;paymentCreatedAt?:string;expiresAt?:string|null};
    try{
      payment=order.kind==='MARKET'
        ?await createIpaymuQris({orderId:order.id,amount:order.amount,buyer:{name,email:account.email,phone},returnUrl:`${origin}/checkout/order/${encodeURIComponent(order.id)}`,notifyUrl})
        :await createIpaymuRedirect({orderId:order.id,products:productLines,buyer:{name,email:account.email,phone},returnUrl:`${origin}/checkout/order/${encodeURIComponent(order.id)}`,cancelUrl:`${origin}/checkout/order/${encodeURIComponent(order.id)}?payment=cancelled`,notifyUrl});
    }catch(error){
      if(paymentClaim)await database.prepare("UPDATE checkout_orders SET payment_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id=?").bind(id,paymentClaim).run();
      throw error;
    }
    details.ipaymuPaymentMethod=order.kind==='MARKET'?'qris':'hosted';
    if(order.kind==='MARKET'){
      details.ipaymuPaymentQrImage=payment.qrImage;
      details.ipaymuPaymentQrString=payment.qrString;
      details.ipaymuTransactionId=payment.transactionId;
      details.ipaymuSessionId=payment.sessionId;
      details.ipaymuPaymentFee=payment.fee;
      details.ipaymuPaymentCreatedAt=payment.paymentCreatedAt;
      details.ipaymuPaymentExpiresAt=payment.expiresAt;
    }else{
      if(!payment.url)throw new HttpError(502,'The payment provider returned an incomplete payment session.');
      details.ipaymuCheckoutUrl=payment.url;
    }
    details.ipaymuMode=process.env.IPAYMU_MODE==='sandbox'?'sandbox':'production';
    const paymentId=payment.sessionId;
    if(!paymentId){if(paymentClaim)await database.prepare("UPDATE checkout_orders SET payment_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id=?").bind(id,paymentClaim).run();throw new HttpError(502,'The payment provider returned an incomplete payment session.');}
    const updated=await database.prepare("UPDATE checkout_orders SET payment_id=?,details=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id IS ?").bind(paymentId,JSON.stringify(details),id,paymentClaim).run();
    if(!updated.meta.changes){
      const latest=await database.prepare('SELECT payment_id AS paymentId,details FROM checkout_orders WHERE id=?').bind(id).first<{paymentId:string|null;details:string}>();
      let latestDetails:Record<string,unknown>={};try{latestDetails=JSON.parse(latest?.details??'{}') as Record<string,unknown>}catch{}
      if(latest?.paymentId&&typeof latestDetails.ipaymuPaymentQrImage==='string'){
        const latestQrUrl=ipaymuQrImageUrl(latestDetails.ipaymuPaymentQrImage,latestDetails.ipaymuMode);
        if(!latestQrUrl)throw new HttpError(502,'The payment provider returned an invalid QR code address.');
        return Response.json({paymentMethod:'qris',qrImage:`/api/checkout/order/${encodeURIComponent(order.id)}/qris`,qrString:latestDetails.ipaymuPaymentQrString??null,paymentFee:latestDetails.ipaymuPaymentFee??null,expiresAt:latestDetails.ipaymuPaymentExpiresAt??null,reused:true});
      }
      if(latest?.paymentId&&typeof latestDetails.ipaymuCheckoutUrl==='string')return Response.json({checkoutUrl:latestDetails.ipaymuCheckoutUrl,paymentMethod:latestDetails.ipaymuPaymentMethod??'hosted',expiresAt:latestDetails.ipaymuPaymentExpiresAt??null,reused:true});
      throw new HttpError(409,'This checkout has already been updated. Refresh the page.');
    }
    return Response.json(order.kind==='MARKET'?{paymentMethod:'qris',qrImage:`/api/checkout/order/${encodeURIComponent(order.id)}/qris`,qrString:payment.qrString,paymentFee:payment.fee,expiresAt:payment.expiresAt,reused:false}:{checkoutUrl:payment.url,paymentMethod:'hosted',expiresAt:null,reused:false});
  }catch(error){return errorResponse(error)}
}
