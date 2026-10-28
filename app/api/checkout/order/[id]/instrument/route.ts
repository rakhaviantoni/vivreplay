import {db,errorResponse,user,HttpError} from '@/lib/server/store';
import {getCurrentUser} from '@/lib/server/auth';
import {clearIpaymuPaymentAttempt,createIpaymuDirectPayment,createIpaymuRedirect,findIpaymuTransactionsByReference,getEnabledIpaymuPaymentChannels,getIpaymuAttemptState,getIpaymuMode,getIpaymuPaymentChannels,getIpaymuTransaction,hasIpaymuPaymentConfig,hasMarketIpaymuPaymentConfig,ipaymuCheckoutExpiresAt,ipaymuExpiryTimestamp,ipaymuPayableTotal,ipaymuQrImageUrl} from '@/lib/server/ipaymu';
import {estimateIpaymuFee} from '@/lib/market/ipaymu-fees';
import {sendMarketEmail} from '@/lib/server/market-notifications';
import {sealedProductById,sealedProductKinds} from '@/lib/market/sealed-products';

type Order={id:string;kind:string;buyerId:string;sellerId:string|null;listingId:string|null;items:string;details:string;subtotal:number;amount:number;shippingFee:number;title:string|null;paymentId:string|null;status:string;expiresAt:string|null;updatedAt:string|null;createdAt:string|null};
type OrderItem={printingId:string;quantity:number;unitAmount:number;sealedProductId?:string;generalProduct?:{category:string;brand?:string;model?:string}};
type PaymentChoice={paymentMethod?:string;paymentChannel?:string};

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const profile=await user();
    const {id}=await params;
    const database=db();
    const order=await database.prepare("SELECT id,kind,buyer_id AS buyerId,payment_id AS paymentId,status,details,amount,created_at AS createdAt,updated_at AS updatedAt FROM checkout_orders WHERE id=?").bind(id).first<{id:string;kind:string;buyerId:string;paymentId:string|null;status:string;details:string;amount:number;createdAt:string|null;updatedAt:string|null}>();
    if(!order||order.buyerId!==profile.id)throw new HttpError(404,'Checkout was not found.');
    if(order.status!=='PENDING_PAYMENT')throw new HttpError(409,'This checkout is no longer payable.');
    let details:Record<string,unknown>={};
    try{const parsed=JSON.parse(order.details) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
    let paymentId=order.paymentId;
    let paymentRecovery:'none'|'recovered'|'cleared'|'multiple'='none';
    const claimCreatedAt=order.updatedAt?Date.parse(`${order.updatedAt.replace(' ','T')}Z`):NaN;
    const legacyAttempt=!paymentId&&typeof details.ipaymuSelectedMethod==='string'&&!details.ipaymuPaymentRecoveryCheckedAt;
    const staleAttempt=Number.isFinite(claimCreatedAt)&&Date.now()-claimCreatedAt>45_000;
    const createdAt=order.createdAt?Date.parse(`${order.createdAt.replace(' ','T')}Z`):NaN;
    const updatedAfterCreation=Number.isFinite(claimCreatedAt)&&Number.isFinite(createdAt)&&claimCreatedAt-createdAt>45_000;
    const unmarkedAttempt=!paymentId&&!legacyAttempt&&!details.ipaymuPaymentRecoveryCheckedAt&&updatedAfterCreation;
    let shouldRecover=(paymentId?.startsWith('CREATING:')&&!details.ipaymuPaymentMethod&&staleAttempt)||(legacyAttempt&&staleAttempt)||unmarkedAttempt;
    if((legacyAttempt&&staleAttempt)||unmarkedAttempt){
      const recoveryClaim=`CREATING:${crypto.randomUUID()}`;
      const claimed=await database.prepare("UPDATE checkout_orders SET payment_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id IS NULL").bind(recoveryClaim,order.id).run();
      if(claimed.meta.changes)paymentId=recoveryClaim;
      else{
        const latest=await database.prepare("SELECT payment_id AS paymentId FROM checkout_orders WHERE id=?").bind(order.id).first<{paymentId:string|null}>();
        paymentId=latest?.paymentId??null;
        shouldRecover=false;
      }
    }
    if(shouldRecover){
      try{
        const from=new Date(claimCreatedAt-24*60*60*1000).toISOString().slice(0,10);
        const through=new Date(Date.now()+24*60*60*1000).toISOString().slice(0,10);
        const recoveryIds=Array.isArray(details.ipaymuRecoveryTransactionIds)?[...new Set(details.ipaymuRecoveryTransactionIds.map(String).filter(value=>/^\d{3,20}$/.test(value)))].slice(0,5):[];
        const recoveredById=new Map<string,Awaited<ReturnType<typeof getIpaymuTransaction>>>();
        const directAttempts=await Promise.all(recoveryIds.map(async transactionId=>{
          try{
            const gateway=await getIpaymuTransaction(transactionId);
            const status=Number(gateway.Status);
            const reference=String(gateway.ReferenceId??'');
            if(![0,1,6].includes(status)||(reference&&reference!==order.id))return null;
            recoveredById.set(transactionId,gateway);
            return {transactionId,referenceId:reference||order.id,amount:Number.isSafeInteger(Number(gateway.Amount))?Number(gateway.Amount):null,status,type:String(gateway.TypeDesc??gateway.Notes??''),createdAt:String(gateway.CreatedDate??'')};
          }catch{return null}
        }));
        const directActive=directAttempts.filter((transaction):transaction is NonNullable<typeof transaction>=>Boolean(transaction)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
        const history=directActive.length?[]:await findIpaymuTransactionsByReference(order.id,from,through);
        const active=(directActive.length?directActive:history.filter(transaction=>transaction.status!==null&&[0,1,6].includes(transaction.status))).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
        if(active.length){
          const latest=active[0];
          const gateway=recoveredById.get(latest.transactionId)??await getIpaymuTransaction(latest.transactionId);
          const descriptor=[latest.type,gateway.TypeDesc,gateway.Notes].filter(Boolean).join(' ').toLowerCase();
          let method=String(gateway.Via??details.ipaymuSelectedMethod??'').toLowerCase();
          if(!['va','cstore','qris','cc','paylater','ewallet'].includes(method)){
            method=descriptor.includes('qris')?'qris':descriptor.includes('credit card')||descriptor.includes('card payment')?'cc':descriptor.includes('e-wallet')||descriptor.includes('ewallet')||descriptor.includes('dana')||descriptor.includes('shopeepay')||descriptor.includes('gopay')?'ewallet':descriptor.includes('virtual account')||descriptor.includes('virtual bank')?'va':descriptor.includes('convenience store')||descriptor.includes('indomaret')||descriptor.includes('alfamart')?'cstore':descriptor.includes('paylater')?'paylater':'';
          }
          let channel=String(gateway.Channel??details.ipaymuSelectedChannel??'').toLowerCase();
          if(!/^[a-z0-9_]{2,24}$/.test(channel)&&method){
            const channels=await getIpaymuPaymentChannels().catch(()=>[]);
            const candidates=channels.filter(option=>option.method===method&&(descriptor.includes(option.channel)||descriptor.includes(option.name.toLowerCase())));
            const methodChannels=channels.filter(option=>option.method===method);
            if(candidates.length===1)channel=candidates[0].channel;
            else if(methodChannels.length===1)channel=methodChannels[0].channel;
          }
          const validMethod=['va','cstore','qris','cc','paylater','ewallet'].includes(method);
          const sessionId=String(gateway.SessionId??gateway.SessionID??latest.transactionId);
          if(validMethod&&/^[a-z0-9_]{2,24}$/.test(channel)&&(!gateway.ReferenceId||String(gateway.ReferenceId)===order.id)){
            const rawUrl=typeof gateway.Url==='string'?gateway.Url:null;
            let checkoutUrl:string|null=null;
            try{if(rawUrl){const parsed=new URL(rawUrl);const sandbox=String(details.ipaymuMode??getIpaymuMode())==='sandbox';const hosts=sandbox?['sandbox.ipaymu.com','sandbox-payment.ipaymu.com']:['my.ipaymu.com','payment.ipaymu.com'];if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&(!parsed.port||parsed.port==='443')&&hosts.includes(parsed.hostname))checkoutUrl=parsed.toString()}}catch{}
            details.ipaymuPaymentMethod=method;
            details.ipaymuPaymentChannel=channel;
            details.ipaymuPaymentName=String(gateway.PaymentName??details.ipaymuSelectedName??gateway.Notes??(active[0].type||channel.toUpperCase()));
            details.ipaymuPaymentNo=gateway.PaymentNo==null?details.ipaymuPaymentNo??null:String(gateway.PaymentNo);
            details.ipaymuCheckoutUrl=checkoutUrl??details.ipaymuCheckoutUrl??null;
            details.ipaymuTransactionId=latest.transactionId;
            details.ipaymuSessionId=sessionId;
            details.ipaymuPaymentFee=Number.isFinite(Number(gateway.Fee))?Math.round(Number(gateway.Fee)):null;
            details.ipaymuPaymentTotal=ipaymuPayableTotal(order.amount,method,details.ipaymuPaymentFee,gateway.Total);
            details.ipaymuPaymentCreatedAt=gateway.CreatedDate??latest.createdAt;
            details.ipaymuPaymentExpiresAt=gateway.ExpiredDate??null;
            details.ipaymuMode=getIpaymuMode();
            details.ipaymuActiveTransactionIds=active.map(transaction=>transaction.transactionId);
            delete details.ipaymuRecoveryTransactionIds;
            if(active.length>1)details.ipaymuAttemptCount=active.length;
            const saved=await database.prepare("UPDATE checkout_orders SET payment_id=?,details=?,expires_at=COALESCE(?,expires_at),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id=?").bind(sessionId,JSON.stringify(details),details.ipaymuPaymentExpiresAt??null,order.id,paymentId).run();
            if(saved.meta.changes){paymentId=sessionId;paymentRecovery=active.length>1?'multiple':'recovered'}
          }
        }else if(history.some(transaction=>transaction.status===null)){
          console.error('ipaymu_payment_recovery_status_unknown',{orderId:order.id,matchingTransactions:history.length});
        }else{
          details=clearIpaymuPaymentAttempt(details);
          const checkoutExpiry=ipaymuCheckoutExpiresAt(details.ipaymuCheckoutExpiresAt,order.createdAt);
          const cleared=await database.prepare("UPDATE checkout_orders SET payment_id=NULL,details=?,expires_at=COALESCE(?,expires_at),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id=?").bind(JSON.stringify(details),checkoutExpiry,order.id,paymentId).run();
          if(cleared.meta.changes){paymentId=null;paymentRecovery='cleared'}
        }
      }catch(error){console.error('ipaymu_payment_recovery_failed',{orderId:order.id,error:error instanceof Error?error.message:'unknown'})}
    }
    const configured=order.kind==='MARKET'?hasMarketIpaymuPaymentConfig():hasIpaymuPaymentConfig();
    let paymentChannels:Awaited<ReturnType<typeof getEnabledIpaymuPaymentChannels>>=[];
    let paymentChannelStatus:'not_configured'|'provider_unavailable'|'settings_unavailable'|'no_active_channels'|'all_disabled'|'ready'='not_configured';
    if(configured){
      try{
        const reported=await getIpaymuPaymentChannels({forceRefresh:true});
        if(reported.length){paymentChannels=await getEnabledIpaymuPaymentChannels(database);paymentChannelStatus=paymentChannels.length?'ready':'all_disabled'}
        else paymentChannelStatus='no_active_channels';
      }catch{paymentChannelStatus='provider_unavailable'}
    }
    const paymentCreating=Boolean(paymentId?.startsWith('CREATING:')||legacyAttempt&&!shouldRecover);
    return Response.json({paymentChannels,paymentChannelStatus,selectedMethod:details.ipaymuPaymentMethod??details.ipaymuSelectedMethod??'qris',selectedChannel:details.ipaymuPaymentChannel??details.ipaymuSelectedChannel??'mpm',canChange:!paymentId&&!paymentCreating,hasActivePayment:Boolean(paymentId&&!paymentId.startsWith('CREATING:')),paymentCreating,paymentRecovery,activeAttemptCount:Number(details.ipaymuAttemptCount)||1},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const input=await request.json().catch(()=>({})) as PaymentChoice;
    const hasRequestedMethod=typeof input.paymentMethod==='string'||typeof input.paymentChannel==='string';
    if(hasRequestedMethod&&(typeof input.paymentMethod!=='string'||typeof input.paymentChannel!=='string'))throw new HttpError(400,'Choose a valid payment method.');
    const profile=await user();
    const account=await getCurrentUser();
    if(!account?.email)throw new HttpError(401,'Sign in with an email address to continue.');
    const {id}=await params;
    const database=db();
    const order=await database.prepare(`SELECT o.id,o.kind,o.buyer_id AS buyerId,o.seller_id AS sellerId,o.listing_id AS listingId,o.items,o.details,o.subtotal,o.amount,o.shipping_fee AS shippingFee,o.payment_id AS paymentId,o.status,o.expires_at AS expiresAt,o.updated_at AS updatedAt,o.created_at AS createdAt,l.title FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.id=?`).bind(id).first<Order>();
    if(!order||order.buyerId!==profile.id)throw new HttpError(404,'Checkout was not found.');
    if(order.kind==='MARKET'&&!hasMarketIpaymuPaymentConfig()||order.kind==='PRO'&&!hasIpaymuPaymentConfig())throw new HttpError(503,'Checkout is temporarily unavailable.');
    if(order.status!=='PENDING_PAYMENT')throw new HttpError(409,'This checkout is no longer payable.');
    let details:Record<string,unknown>={};
    try{details=JSON.parse(order.details) as Record<string,unknown>}catch{}
    if(!order.paymentId&&typeof details.ipaymuSelectedMethod==='string'&&!details.ipaymuPaymentRecoveryCheckedAt)throw new HttpError(409,'We’re still checking the previous payment. Refresh in a moment before choosing another method.');
    const method=typeof input.paymentMethod==='string'?input.paymentMethod:typeof details.ipaymuSelectedMethod==='string'?details.ipaymuSelectedMethod:'qris';
    const channel=typeof input.paymentChannel==='string'?input.paymentChannel:typeof details.ipaymuSelectedChannel==='string'?details.ipaymuSelectedChannel:'mpm';
    if(!['va','cstore','qris','cc','paylater','ewallet'].includes(method)||!(/^[a-z0-9_]{2,24}$/.test(channel)))throw new HttpError(400,'Choose a valid payment method.');
    let existingPaymentExpiry=order.paymentId&&details.ipaymuPaymentMethod?ipaymuExpiryTimestamp(details.ipaymuPaymentExpiresAt,details.ipaymuPaymentCreatedAt,order.updatedAt):null;
    if(order.paymentId&&!order.paymentId.startsWith('CREATING:')&&existingPaymentExpiry!==null&&existingPaymentExpiry<=Date.now()){
      const state=await getIpaymuAttemptState(String(details.ipaymuTransactionId??''),order.id);
      if(state==='paid')throw new HttpError(409,'Payment received. Refresh this order while we confirm it.');
      if(state!=='expired')throw new HttpError(409,'We’re still checking the previous payment. Try again in a moment.');
      const checkoutExpiry=ipaymuCheckoutExpiresAt(details.ipaymuCheckoutExpiresAt,order.createdAt);
      if(!checkoutExpiry||Date.parse(checkoutExpiry)<=Date.now()){
        const expirySql=checkoutExpiry?new Date(checkoutExpiry).toISOString().slice(0,19).replace('T',' '):order.expiresAt;
        const expired=await database.prepare("UPDATE checkout_orders SET status='EXPIRED',expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id=?").bind(expirySql,order.id,order.paymentId).run();
        if(expired.meta.changes&&order.kind==='MARKET'){
          const title=order.title||'Market order';
          await Promise.all([sendMarketEmail(order.buyerId,'order-expired',title,order.id),...(order.sellerId?[sendMarketEmail(order.sellerId,'order-expired',title,order.id)]:[])]);
        }
        throw new HttpError(409,'This checkout has expired. Start a new checkout to continue.');
      }
      const clearedDetails=clearIpaymuPaymentAttempt(details);
      const released=await database.prepare("UPDATE checkout_orders SET payment_id=NULL,details=?,expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id=?").bind(JSON.stringify(clearedDetails),checkoutExpiry,order.id,order.paymentId).run();
      if(!released.meta.changes)throw new HttpError(409,'This order changed while the payment was being checked. Refresh and try again.');
      order.paymentId=null;
      order.expiresAt=checkoutExpiry;
      details=clearedDetails;
      existingPaymentExpiry=null;
    }
    if(order.paymentId){
      if(order.paymentId.startsWith('CREATING:'))throw new HttpError(409,'A payment is already being started. Refresh this order to check its status.');
      if(hasRequestedMethod&&(details.ipaymuPaymentMethod!==method||details.ipaymuPaymentChannel!==channel))throw new HttpError(409,'A payment has already started for this order. Wait for it to expire before choosing another method.');
    }
    const effectiveExpiry=order.paymentId&&existingPaymentExpiry!==null?new Date(existingPaymentExpiry).toISOString():order.expiresAt;
    if(effectiveExpiry&&new Date(`${effectiveExpiry.replace(' ','T')}Z`).getTime()<=Date.now()){
      const expirySql=existingPaymentExpiry!==null?new Date(existingPaymentExpiry).toISOString().slice(0,19).replace('T',' '):effectiveExpiry;
      const expired=await database.prepare("UPDATE checkout_orders SET status='EXPIRED',expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id IS ?").bind(expirySql,id,order.paymentId).run();
      if(expired.meta.changes&&order.kind==='MARKET'){
        const title=order.title||'Market order';
        await Promise.all([sendMarketEmail(order.buyerId,'order-expired',title,order.id),...(order.sellerId?[sendMarketEmail(order.sellerId,'order-expired',title,order.id)]:[])]);
      }
      throw new HttpError(409,'This checkout has expired. Start a new checkout to continue.');
    }
    const existingUrl=typeof details.ipaymuCheckoutUrl==='string'?details.ipaymuCheckoutUrl:null;
    const existingQrImage=typeof details.ipaymuPaymentQrImage==='string'?details.ipaymuPaymentQrImage:null;
    const existingQrUrl=ipaymuQrImageUrl(existingQrImage,details.ipaymuMode);
    if(order.paymentId&&existingQrImage&&details.ipaymuPaymentMethod==='qris'&&existingPaymentExpiry!==null&&existingPaymentExpiry>Date.now()){
      if(!existingQrUrl)throw new HttpError(502,'Could not load the payment code. Please try again.');
      return Response.json({paymentMethod:'qris',qrImage:`/api/checkout/order/${encodeURIComponent(order.id)}/qris`,qrString:details.ipaymuPaymentQrString??null,paymentFee:details.ipaymuPaymentFee??null,expiresAt:new Date(existingPaymentExpiry).toISOString(),reused:true});
    }
    if(order.paymentId&&details.ipaymuPaymentMethod&&details.ipaymuPaymentMethod!=='qris')return Response.json({checkoutUrl:existingUrl,paymentMethod:details.ipaymuPaymentMethod,paymentChannel:details.ipaymuPaymentChannel??null,paymentNo:details.ipaymuPaymentNo??null,paymentName:details.ipaymuPaymentName??null,instructionsUrl:details.ipaymuPaymentInstructionsUrl??null,paymentFee:details.ipaymuPaymentFee??null,paymentTotal:ipaymuPayableTotal(order.amount,details.ipaymuPaymentMethod,details.ipaymuPaymentFee,details.ipaymuPaymentTotal),expiresAt:details.ipaymuPaymentExpiresAt??order.expiresAt,reused:true});

    const baseUrl=process.env.VIVREPLAY_PUBLIC_URL?.trim().replace(/\/$/,'')||'https://vivreplay.com';
    const callbackOrigin=new URL(request.url).origin;
    const paymentMode=getIpaymuMode();
    const origin=paymentMode==='sandbox'?callbackOrigin:baseUrl;
    const notifyUrl=process.env.IPAYMU_CALLBACK_URL?.trim()||`${origin}/api/checkout/ipaymu/callback`;
    let products:OrderItem[]=[];
    if(order.kind==='MARKET'){
      try{products=JSON.parse(order.items) as OrderItem[]}catch{throw new HttpError(500,'The selected cards could not be loaded.');}
      if(!products.length||products.some(item=>!item.printingId||!Number.isInteger(item.quantity)||item.quantity<1||!Number.isSafeInteger(item.unitAmount)||item.unitAmount<0))throw new HttpError(500,'The selected cards could not be loaded.');
    }
    const productLines=order.kind==='PRO'
      ?[{name:'VivrePlay Market Pro',quantity:1,unitPrice:order.amount,description:`Market Pro membership · ${Number(details.durationDays)||0} days`}]
      :[
        ...products.map(item=>{const product=sealedProductById(item.sealedProductId??item.printingId);return product?{name:product.name,quantity:item.quantity,unitPrice:item.unitAmount,description:`${sealedProductKinds[product.kind]} from ${product.setCode}`}:item.generalProduct?{name:order.title??item.generalProduct.model??'Market item',quantity:item.quantity,unitPrice:item.unitAmount,description:'Market item'}:{name:item.printingId,quantity:item.quantity,unitPrice:item.unitAmount,description:`Trading card ${item.printingId}`}}),
        ...(order.shippingFee>0?[{name:'Delivery',quantity:1,unitPrice:order.shippingFee,description:'Courier delivery for this Market order'}]:[]),
      ];
    let buyerServiceFee=order.kind==='MARKET'&&Number.isSafeInteger(details.marketBuyerFeeAmount)?Number(details.marketBuyerFeeAmount):0;
    // The order's saved subtotal and delivery fee are the checkout snapshot. Rebuilding
    // the total from card lines can drift for grouped or repriced listings, even though
    // the amount shown to the buyer is still correct.
    if(order.kind==='MARKET'){
      const shippingDiscount=Number.isSafeInteger(details.marketProShippingDiscount)?Number(details.marketProShippingDiscount):0;
      const savedFee=order.amount-order.subtotal-order.shippingFee+shippingDiscount;
      if(!Number.isSafeInteger(savedFee)||savedFee<0)throw new HttpError(409,'This order needs to be refreshed before payment.');
      if(savedFee!==buyerServiceFee){
        buyerServiceFee=savedFee;
        details.marketBuyerFeeAmount=savedFee;
        await database.prepare("UPDATE checkout_orders SET details=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id IS NULL").bind(JSON.stringify(details),id).run();
      }
    }
    const total=order.kind==='MARKET'
      ?order.subtotal+order.shippingFee-(Number.isSafeInteger(details.marketProShippingDiscount)?Number(details.marketProShippingDiscount):0)+buyerServiceFee
      :productLines.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0);
    if(total!==order.amount)throw new HttpError(409,'This order needs to be refreshed before payment.');
    const availableChannels=await getEnabledIpaymuPaymentChannels(database,{forceRefresh:true}).catch(()=>{throw new HttpError(503,'Payment options could not be refreshed. Try again shortly.');});
    if(!availableChannels.some(option=>option.method===method&&option.channel===channel))throw new HttpError(409,'This payment method is no longer available. Choose an active option at checkout.');
    const selectedChannel=availableChannels.find(option=>option.method===method&&option.channel===channel)!;
    details.ipaymuCheckoutExpiresAt??=ipaymuCheckoutExpiresAt(order.expiresAt,order.createdAt);
    details.ipaymuSelectedMethod=method;
    details.ipaymuSelectedChannel=channel;
    details.ipaymuSelectedName=selectedChannel.name;
    details.ipaymuSelectedLogo=selectedChannel.logo;
    const name=typeof details.customerName==='string'?details.customerName:typeof details.recipientName==='string'?details.recipientName:profile.display_name||'VivrePlay customer';
    const phone=typeof details.customerPhone==='string'?details.customerPhone:typeof details.phone==='string'?details.phone:'';
    const paymentClaim=`CREATING:${crypto.randomUUID()}`;
    const claimed=await database.prepare("UPDATE checkout_orders SET payment_id=?,details=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id IS NULL").bind(paymentClaim,JSON.stringify(details),id).run();
    if(!claimed.meta.changes)throw new HttpError(409,'This order is already being paid or has changed. Refresh to check its status.');
    let payment: {checkoutUrl:string|null;sessionId:string;transactionId:string;paymentMethod:string;paymentChannel:string;paymentNo:string|null;paymentName:string|null;instructionsUrl:string|null;qrImage:string|null;qrString:string|null;fee:number|null;total:number;paymentCreatedAt:string;expiresAt:string};
    try{
      if(method==='cc'){
        const paymentCreatedAt=new Date().toISOString();
        const paymentTotal=order.amount+estimateIpaymuFee(selectedChannel,order.amount);
        const checkout=await createIpaymuRedirect({orderId:order.id,products:productLines.map(item=>({name:item.name,quantity:item.quantity,unitPrice:item.unitPrice,description:item.description})),buyer:{name,email:account.email,phone},returnUrl:`${origin}/checkout/order/${encodeURIComponent(order.id)}`,cancelUrl:`${origin}/checkout/order/${encodeURIComponent(order.id)}`,notifyUrl,paymentMethod:'cc',feeDirection:'BUYER'});
        payment={checkoutUrl:checkout.url,sessionId:checkout.sessionId,transactionId:checkout.sessionId,paymentMethod:'cc',paymentChannel:channel,paymentNo:null,paymentName:null,instructionsUrl:null,qrImage:null,qrString:null,fee:paymentTotal-order.amount,total:paymentTotal,paymentCreatedAt,expiresAt:new Date(Date.parse(paymentCreatedAt)+24*60*60*1000).toISOString()};
      }else{
        payment=await createIpaymuDirectPayment({orderId:order.id,amount:order.amount,buyer:{name,email:account.email,phone},returnUrl:`${origin}/checkout/order/${encodeURIComponent(order.id)}`,notifyUrl,method:method as 'va'|'cstore'|'qris'|'paylater'|'ewallet',channel});
      }
    }catch(error){
      // The request may have reached iPaymu even if its response timed out or
      // could not be parsed. Keep the claim so the next status check can find
      // the transaction instead of creating a second one.
      console.error('ipaymu_payment_start_needs_reconciliation',{orderId:id,error:error instanceof Error?error.message:'unknown'});
      throw new HttpError(502,error instanceof Error?error.message:'We couldn’t start this payment. Choose another method or try again later.');
    }
    details.ipaymuPaymentMethod=payment.paymentMethod;
    details.ipaymuPaymentChannel=payment.paymentChannel;
    details.ipaymuPaymentName=payment.paymentName??details.ipaymuSelectedName??payment.paymentChannel.toUpperCase();
    details.ipaymuPaymentNo=payment.paymentNo;
    details.ipaymuPaymentInstructionsUrl=payment.instructionsUrl;
    details.ipaymuCheckoutUrl=payment.checkoutUrl;
    details.ipaymuPaymentQrImage=payment.qrImage;
    details.ipaymuPaymentQrString=payment.qrString;
    details.ipaymuTransactionId=payment.transactionId;
    details.ipaymuSessionId=payment.sessionId;
    details.ipaymuPaymentFee=payment.fee;
    details.ipaymuPaymentTotal=payment.paymentMethod==='qris'?order.amount:Math.max(payment.total,order.amount+(payment.fee??0));
    details.ipaymuPaymentCreatedAt=payment.paymentCreatedAt;
    details.ipaymuPaymentExpiresAt=payment.expiresAt;
    details.ipaymuMode=paymentMode;
    const paymentId=payment.sessionId;
    if(!paymentId){await database.prepare("UPDATE checkout_orders SET payment_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id=?").bind(id,paymentClaim).run();throw new HttpError(502,'Could not start payment. Please try again.');}
    const paymentExpirySql=payment.expiresAt?new Date(payment.expiresAt).toISOString().slice(0,19).replace('T',' '):order.expiresAt;
    const updated=await database.prepare("UPDATE checkout_orders SET payment_id=?,details=?,expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT' AND payment_id IS ?").bind(paymentId,JSON.stringify(details),paymentExpirySql,id,paymentClaim).run();
    if(!updated.meta.changes){
      const latest=await database.prepare('SELECT payment_id AS paymentId,details FROM checkout_orders WHERE id=?').bind(id).first<{paymentId:string|null;details:string}>();
      let latestDetails:Record<string,unknown>={};try{latestDetails=JSON.parse(latest?.details??'{}') as Record<string,unknown>}catch{}
      if(latest?.paymentId&&typeof latestDetails.ipaymuPaymentQrImage==='string'){
        const latestQrUrl=ipaymuQrImageUrl(latestDetails.ipaymuPaymentQrImage,latestDetails.ipaymuMode);
        if(!latestQrUrl)throw new HttpError(502,'Could not load the payment code. Please try again.');
        return Response.json({paymentMethod:'qris',qrImage:`/api/checkout/order/${encodeURIComponent(order.id)}/qris`,qrString:latestDetails.ipaymuPaymentQrString??null,paymentFee:latestDetails.ipaymuPaymentFee??null,expiresAt:latestDetails.ipaymuPaymentExpiresAt??null,reused:true});
      }
      if(latest?.paymentId&&typeof latestDetails.ipaymuPaymentMethod==='string')return Response.json({checkoutUrl:latestDetails.ipaymuCheckoutUrl??null,paymentMethod:latestDetails.ipaymuPaymentMethod,paymentChannel:latestDetails.ipaymuPaymentChannel??null,paymentNo:latestDetails.ipaymuPaymentNo??null,paymentName:latestDetails.ipaymuPaymentName??null,instructionsUrl:latestDetails.ipaymuPaymentInstructionsUrl??null,paymentFee:latestDetails.ipaymuPaymentFee??null,paymentTotal:ipaymuPayableTotal(order.amount,latestDetails.ipaymuPaymentMethod,latestDetails.ipaymuPaymentFee,latestDetails.ipaymuPaymentTotal),expiresAt:latestDetails.ipaymuPaymentExpiresAt??null,reused:true});
      throw new HttpError(409,'This checkout has already been updated. Refresh the page.');
    }
    return Response.json({paymentMethod:payment.paymentMethod,paymentChannel:payment.paymentChannel,qrImage:payment.qrImage?`/api/checkout/order/${encodeURIComponent(order.id)}/qris`:null,qrString:payment.qrString,paymentNo:payment.paymentNo,paymentName:details.ipaymuPaymentName,instructionsUrl:payment.instructionsUrl,checkoutUrl:payment.checkoutUrl,paymentFee:payment.fee,paymentTotal:details.ipaymuPaymentTotal,expiresAt:payment.expiresAt,reused:false});
  }catch(error){return errorResponse(error)}
}
