type IpaymuProduct={name:string;quantity:number;unitPrice:number;description:string};

type IpaymuRedirectBody={
  product:string[];qty:string[];price:string[];description:string[];
  returnUrl:string;notifyUrl:string;cancelUrl:string;referenceId:string;
  buyerName:string;buyerEmail:string;buyerPhone:string;expired:number;feeDirection:'BUYER'|'MERCHANT';paymentMethod?:PaymentMethodCode;
};

function configuration(){
  const va=(process.env.IPAYMU_VA??'').trim();
  const apiKey=(process.env.IPAYMU_API_KEY??'').trim();
  if(!va||!apiKey)throw new Error('iPaymu checkout is not configured.');
  const rawMode=(process.env.IPAYMU_MODE??'').trim().toLowerCase();
  const isSandboxKey=apiKey.toLowerCase().startsWith('sandbox');
  const mode=rawMode==='production'||rawMode==='sandbox'
    ? (rawMode==='sandbox'&&!isSandboxKey? 'production' : rawMode)
    : (isSandboxKey?'sandbox':'production');
  const production=mode==='production';
  if(production&&process.env.IPAYMU_PRODUCTION_READY==='false')throw new Error('Production payments are awaiting gateway approval.');
  const baseUrl=production?'https://my.ipaymu.com':'https://sandbox.ipaymu.com';
  return {va,apiKey,baseUrl,mode};
}

export function getIpaymuMode():'sandbox'|'production'{
  try{return configuration().mode as 'sandbox'|'production'}catch{return (process.env.IPAYMU_MODE??'').trim().toLowerCase()==='sandbox'?'sandbox':'production'}
}

export function hasIpaymuPaymentConfig(){
  try{configuration();return true}catch{return false}
}

export async function getIpaymuMerchantBalance(){
  const {va,apiKey,baseUrl}=configuration();
  const body=JSON.stringify({account:va});
  const now=new Date();
  const timestamp=`${now.getUTCFullYear()}${String(now.getUTCMonth()+1).padStart(2,'0')}${String(now.getUTCDate()).padStart(2,'0')}${String(now.getUTCHours()).padStart(2,'0')}${String(now.getUTCMinutes()).padStart(2,'0')}${String(now.getUTCSeconds()).padStart(2,'0')}`;
  const response=await fetch(`${baseUrl}/api/v2/balance`,{method:'POST',headers:{'Content-Type':'application/json',va,timestamp,signature:await requestSignature(body,va,apiKey)},body,cache:'no-store',signal:AbortSignal.timeout(12_000)});
  const payload=await response.json().catch(()=>null) as {Status?:number;Data?:{MerchantBalance?:string|number;MemberBalance?:string|number};Message?:string}|null;
  const merchantBalance=Number(payload?.Data?.MerchantBalance);
  const memberBalance=Number(payload?.Data?.MemberBalance??0);
  if(!response.ok||payload?.Status!==200||!Number.isFinite(merchantBalance)||merchantBalance<0)throw new Error('iPaymu balance could not be checked.');
  return {merchantBalance:Math.round(merchantBalance),memberBalance:Number.isFinite(memberBalance)?Math.round(memberBalance):0,mode:baseUrl.includes('sandbox')?'sandbox':'production',checkedAt:new Date().toISOString()};
}

export function hasMarketIpaymuPaymentConfig(){
  return hasIpaymuPaymentConfig();
}

export function isIpaymuProductionReady(){
  return getIpaymuMode()==='production'&&hasIpaymuPaymentConfig();
}

export function ipaymuQrImageUrl(value:unknown,mode:unknown=process.env.IPAYMU_MODE){
  if(typeof value!=='string')return null;
  try{
    const parsed=new URL(value);
    const sandbox=String(mode??'').trim().toLowerCase()==='sandbox';
    const allowedHosts=sandbox?['sandbox-payment.ipaymu.com','sandbox.ipaymu.com']:['my.ipaymu.com','payment.ipaymu.com'];
    return parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&allowedHosts.includes(parsed.hostname)?parsed.toString():null;
  }catch{return null}
}

function hex(bytes:ArrayBuffer){return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('')}

async function hmac(value:string,key:string){
  const encoder=new TextEncoder();
  const cryptoKey=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',cryptoKey,encoder.encode(value)));
}

async function signedIpaymuPost(path:string,body:Record<string,unknown>){
  const {va,apiKey,baseUrl}=configuration();
  const bodyText=JSON.stringify(body);
  const now=new Date();
  const timestamp=`${now.getUTCFullYear()}${String(now.getUTCMonth()+1).padStart(2,'0')}${String(now.getUTCDate()).padStart(2,'0')}${String(now.getUTCHours()).padStart(2,'0')}${String(now.getUTCMinutes()).padStart(2,'0')}${String(now.getUTCSeconds()).padStart(2,'0')}`;
  const response=await fetch(`${baseUrl}/api/v2/${path}`,{method:'POST',headers:{'Content-Type':'application/json',va,timestamp,signature:await requestSignature(bodyText,va,apiKey)},body:bodyText,cache:'no-store',signal:AbortSignal.timeout(12_000)});
  const payload=await response.json().catch(()=>null) as {Status?:number;Success?:boolean;Data?:unknown}|null;
  if(!response.ok||payload?.Status!==200||!payload.Data)throw new Error('iPaymu transaction details could not be checked.');
  return payload.Data;
}

export type IpaymuHistoryTransaction={transactionId:string;referenceId:string|null;amount:number|null;status:number|null;type:string;createdAt:string};

export function ipaymuPayableTotal(amount:number,method:unknown,fee:unknown,reportedTotal:unknown){
  if(method==='qris')return amount;
  const feeAmount=Number(fee);
  const parsedTotal=Number(reportedTotal);
  const minimumTotal=amount+(Number.isFinite(feeAmount)&&feeAmount>0?Math.round(feeAmount):0);
  return Math.max(Number.isSafeInteger(parsedTotal)&&parsedTotal>=amount?parsedTotal:amount,minimumTotal);
}

export async function findIpaymuTransactionsByReference(referenceId:string,startDate:string,endDate:string){
  const matches:IpaymuHistoryTransaction[]=[];
  const append=(rows:Array<{TransactionId?:string|number;ReferenceId?:string|null;Amount?:string|number;Status?:string|number;StatusDesc?:string;TypeDesc?:string;CreatedDate?:string}>)=>{
    for(const row of rows){
      if(String(row.ReferenceId??'')!==referenceId)continue;
      const amount=Number(row.Amount),rawStatus=Number(row.Status),label=String(row.StatusDesc??'').toLowerCase();
      const status=Number.isFinite(rawStatus)?rawStatus:label.includes('pending')?0:label.includes('success')||label.includes('berhasil')?1:label.includes('expired')||label.includes('kedaluwarsa')?-2:label.includes('cancel')||label.includes('batal')?2:null;
      const transactionId=String(row.TransactionId??'');
      if(!transactionId)continue;
      matches.push({transactionId,referenceId,amount:Number.isSafeInteger(amount)?amount:null,status,type:String(row.TypeDesc??''),createdAt:String(row.CreatedDate??'')});
    }
  };
  for(let page=1;page<=5;page++){
    const data=await signedIpaymuPost('history',{date:'created_at',startdate:startDate,enddate:endDate,page:String(page),limit:'20',orderBy:'created_at',order:'DESC',lang:'en'}) as {Total_Page?:number;Results?:Array<{TransactionId?:string|number;ReferenceId?:string|null;Amount?:string|number;Status?:string|number;StatusDesc?:string;TypeDesc?:string;CreatedDate?:string}>};
    const results=Array.isArray(data.Results)?data.Results:[];
    append(results);
    if(page>=Number(data.Total_Page??1)||results.length<20)break;
  }
  if(!matches.length){
    for(let page=1;page<=20;page++){
      const data=await signedIpaymuPost('history',{page:String(page),limit:'20',orderBy:'id',order:'DESC',lang:'en'}) as {Total_Page?:number;Results?:Array<{TransactionId?:string|number;ReferenceId?:string|null;Amount?:string|number;Status?:string|number;StatusDesc?:string;TypeDesc?:string;CreatedDate?:string}>};
      const results=Array.isArray(data.Results)?data.Results:[];
      append(results);
      if(matches.length||page>=Number(data.Total_Page??1)||!results.length)break;
    }
  }
  return matches;
}

export async function getIpaymuTransaction(transactionId:string){
  return await signedIpaymuPost('transaction',{transactionId}) as {TransactionId?:string|number;SessionId?:string;SessionID?:string;ReferenceId?:string|null;Amount?:number|string;Fee?:number|string;Status?:number|string;TypeDesc?:string;Notes?:string;CreatedDate?:string;ExpiredDate?:string;Via?:string;Channel?:string;PaymentNo?:string|number|null;PaymentName?:string;Url?:string;PaymentInstructionsDoc?:string;Total?:number|string};
}

async function requestSignature(bodyText:string,va:string,apiKey:string){
  const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bodyText)));
  return hmac(`POST:${va}:${digest}:${apiKey}`,apiKey);
}

type PaymentMethodCode='va'|'cstore'|'qris'|'cc'|'paylater'|'ewallet';
export type IpaymuPaymentChannel={method:PaymentMethodCode;channel:string;name:string;logo:string;fee:number;feeType:'FLAT'|'PERCENT';additionalFee:number};
let paymentChannelsCache:{expiresAt:number;channels:IpaymuPaymentChannel[]}|null=null;

type PaymentSettingsDatabase={prepare:(query:string)=>{bind:(...values:unknown[])=>{first:<T>()=>Promise<T|null>}}};
export type IpaymuPaymentChannelSettings={disabledChannels:string[]};
const PAYMENT_CHANNEL_SETTINGS_KEY='ipaymu_payment_channels';

function paymentChannelKey(method:string,channel:string){return `${method}:${channel}`}

export function parseIpaymuPaymentChannelSettings(value:unknown):IpaymuPaymentChannelSettings{
  try{
    const parsed=typeof value==='string'?JSON.parse(value) as unknown:value;
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {disabledChannels:[]};
    const disabledChannels=Array.isArray((parsed as {disabledChannels?:unknown}).disabledChannels)?(parsed as {disabledChannels:unknown[]}).disabledChannels.filter((item):item is string=>typeof item==='string'&&/^(va|cstore|qris|cc|paylater|ewallet):[a-z0-9_]{2,24}$/.test(item)):[];
    return {disabledChannels:[...new Set(disabledChannels)].slice(0,300)};
  }catch{return {disabledChannels:[]}}
}

export async function getIpaymuPaymentChannelSettings(database:PaymentSettingsDatabase):Promise<IpaymuPaymentChannelSettings>{
  const row=await database.prepare('SELECT value FROM app_settings WHERE key=?').bind(PAYMENT_CHANNEL_SETTINGS_KEY).first<{value:string}>();
  return parseIpaymuPaymentChannelSettings(row?.value);
}

export async function getIpaymuPaymentChannels(options:{forceRefresh?:boolean}={}):Promise<IpaymuPaymentChannel[]>{
  if(!options.forceRefresh&&paymentChannelsCache&&paymentChannelsCache.expiresAt>Date.now())return paymentChannelsCache.channels;
  const {va,apiKey,baseUrl}=configuration();
  const timestampValue=new Date();
  const timestamp=`${timestampValue.getUTCFullYear()}${String(timestampValue.getUTCMonth()+1).padStart(2,'0')}${String(timestampValue.getUTCDate()).padStart(2,'0')}${String(timestampValue.getUTCHours()).padStart(2,'0')}${String(timestampValue.getUTCMinutes()).padStart(2,'0')}${String(timestampValue.getUTCSeconds()).padStart(2,'0')}`;
  // iPaymu signs GET query parameters as JSON. With no parameters, the
  // canonical request body is an empty JSON object.
  const queryDigest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('{}')));
  const signature=await hmac(`GET:${va}:${queryDigest}:${apiKey}`,apiKey);
  const response=await fetch(`${baseUrl}/api/v2/payment-channels`,{method:'GET',headers:{'Content-Type':'application/json',va,timestamp,signature},cache:'no-store'});
  const payload=await response.json().catch(()=>null) as {Status?:number;Data?:Array<{Code?:string;Channels?:Array<{Code?:string;Name?:string;Logo?:string;FeatureStatus?:string;HealthStatus?:string;TransactionFee?:{ActualFee?:number;ActualFeeType?:string;AdditionalFee?:number}}>} >}|null;
  if(!response.ok||payload?.Status!==200||!Array.isArray(payload.Data))throw new Error('Payment options could not be loaded.');
  const allowedMethods=new Set<PaymentMethodCode>(['va','cstore','qris','cc','paylater','ewallet']);
  const channels=payload.Data.flatMap(method=>{
    const code=String(method.Code??'').toLowerCase() as PaymentMethodCode;
    if(!allowedMethods.has(code)||!Array.isArray(method.Channels))return [];
    return method.Channels.flatMap(channel=>{
      const channelCode=String(channel.Code??'').toLowerCase();
      const name=String(channel.Name??'').trim();
      if(!/^[a-z0-9_]{2,24}$/.test(channelCode)||!name||channel.FeatureStatus?.toLowerCase()!=='active'||channel.HealthStatus?.toLowerCase()!=='online')return [];
      let logo='';
      try{const parsed=new URL(String(channel.Logo??''));if(parsed.protocol==='https:'&&(parsed.hostname==='storage.googleapis.com'||parsed.hostname==='ipaymu.com'||parsed.hostname.endsWith('.ipaymu.com')))logo=parsed.toString()}catch{}
      const fee=Number(channel.TransactionFee?.ActualFee??0);
      const additionalFee=Number(channel.TransactionFee?.AdditionalFee??0);
      const feeType:'FLAT'|'PERCENT'=String(channel.TransactionFee?.ActualFeeType??'FLAT').toUpperCase()==='PERCENT'?'PERCENT':'FLAT';
      return [{method:code,channel:channelCode,name,logo,fee:Number.isFinite(fee)&&fee>=0?fee:0,feeType,additionalFee:Number.isFinite(additionalFee)&&additionalFee>=0?additionalFee:0}];
    });
  });
  paymentChannelsCache={channels,expiresAt:Date.now()+30*1000};
  return channels;
}

export async function getEnabledIpaymuPaymentChannels(database:PaymentSettingsDatabase,options:{forceRefresh?:boolean}={}):Promise<IpaymuPaymentChannel[]>{
  const [channels,settings]=await Promise.all([getIpaymuPaymentChannels(options),getIpaymuPaymentChannelSettings(database)]);
  const disabled=new Set(settings.disabledChannels);
  return channels.filter(channel=>!disabled.has(paymentChannelKey(channel.method,channel.channel)));
}

export async function createIpaymuRedirect(input:{orderId:string;products:IpaymuProduct[];buyer:{name:string;email:string;phone:string};returnUrl:string;cancelUrl:string;notifyUrl:string;paymentMethod?:PaymentMethodCode;feeDirection?:'BUYER'|'MERCHANT'}){
  const {va,apiKey,baseUrl}=configuration();
  if(!input.products.length||input.products.length>50)throw new Error('This checkout has an invalid product list.');
  const body:IpaymuRedirectBody={
    product:input.products.map(product=>product.name.slice(0,100)),
    qty:input.products.map(product=>String(product.quantity)),
    price:input.products.map(product=>String(product.unitPrice)),
    description:input.products.map(product=>product.description.slice(0,255)),
    returnUrl:input.returnUrl,
    notifyUrl:input.notifyUrl,
    cancelUrl:input.cancelUrl,
    referenceId:input.orderId,
    buyerName:input.buyer.name.slice(0,100),
    buyerEmail:input.buyer.email.slice(0,150),
    buyerPhone:input.buyer.phone.slice(0,30),
    expired:24,
    feeDirection:input.feeDirection??'MERCHANT',
    ...(input.paymentMethod?{paymentMethod:input.paymentMethod}:{}),
  };
  const bodyText=JSON.stringify(body);
  const now=new Date();
  const timestamp=`${now.getUTCFullYear()}${String(now.getUTCMonth()+1).padStart(2,'0')}${String(now.getUTCDate()).padStart(2,'0')}${String(now.getUTCHours()).padStart(2,'0')}${String(now.getUTCMinutes()).padStart(2,'0')}${String(now.getUTCSeconds()).padStart(2,'0')}`;
  const response=await fetch(`${baseUrl}/api/v2/payment`,{method:'POST',headers:{'Content-Type':'application/json',va,timestamp,signature:await requestSignature(bodyText,va,apiKey)},body:bodyText,cache:'no-store'});
  const payload=await response.json().catch(()=>null) as {Status?:number;Message?:string;Data?:{SessionID?:string;Url?:string}}|null;
  const url=payload?.Data?.Url;
  const sessionId=payload?.Data?.SessionID;
  if(!response.ok||payload?.Status!==200||!sessionId||!url)throw new Error('We couldn’t start this payment. Please try again.');
  const parsed=new URL(url);
  const allowedHosts=baseUrl==='https://sandbox.ipaymu.com'?['sandbox-payment.ipaymu.com','sandbox.ipaymu.com']:['my.ipaymu.com','payment.ipaymu.com'];
  if(parsed.protocol!=='https:'||!allowedHosts.includes(parsed.hostname))throw new Error('The payment page could not be opened. Choose another method or try again.');
  return {sessionId,url:parsed.toString()};
}

export async function createIpaymuDirectPayment(input:{orderId:string;amount:number;buyer:{name:string;email:string;phone:string};returnUrl:string;notifyUrl:string;method:PaymentMethodCode;channel:string}){
  const {va,apiKey,baseUrl}=configuration();
  if(!Number.isSafeInteger(input.amount)||input.amount<1)throw new Error('This checkout has an invalid amount.');
  if(!/^[a-z0-9_]{2,24}$/.test(input.channel))throw new Error('This payment option is unavailable.');
  const rawPhone=input.buyer.phone.trim();
  const phone=rawPhone.replace(/[\s().-]/g,'');
  const phoneDigits=phone.replace(/\D/g,'');
  if(!/^\+?\d{5,15}$/.test(phone)||phoneDigits.length<5||phoneDigits.length>15)throw new Error('Add a valid phone number with 5 to 15 digits before continuing.');
  const paymentCreatedAt=new Date().toISOString();
  const body={
    name:input.buyer.name.slice(0,100),
    phone:phoneDigits,
    email:input.buyer.email.slice(0,150),
    amount:input.amount,
    notifyUrl:input.notifyUrl,
    referenceId:input.orderId,
    paymentMethod:input.method,
    paymentChannel:input.channel,
    feeDirection:input.method==='qris'?'MERCHANT':'BUYER',
    ...(input.method==='va'&&input.channel==='bri'?{expired:2}:input.method==='va'&&input.channel==='bsi'?{expired:3}:input.method==='va'&&input.channel!=='bca'?{expired:24}:{}),
    successUrl:input.returnUrl,
    cancelUrl:input.returnUrl,
    comments:`VivrePlay Market order ${input.orderId}`.slice(0,255),
  };
  const bodyText=JSON.stringify(body);
  const now=new Date();
  const timestamp=`${now.getUTCFullYear()}${String(now.getUTCMonth()+1).padStart(2,'0')}${String(now.getUTCDate()).padStart(2,'0')}${String(now.getUTCHours()).padStart(2,'0')}${String(now.getUTCMinutes()).padStart(2,'0')}${String(now.getUTCSeconds()).padStart(2,'0')}`;
  const response=await fetch(`${baseUrl}/api/v2/payment/direct`,{method:'POST',headers:{'Content-Type':'application/json',va,timestamp,signature:await requestSignature(bodyText,va,apiKey)},body:bodyText,cache:'no-store',signal:AbortSignal.timeout(20_000)});
  const payload=await response.json().catch(()=>null) as {Status?:number;Message?:string;Data?:{SessionId?:string|number;SessionID?:string|number;TransactionId?:string|number;QrImage?:string;QrString?:string;Url?:string;PaymentNo?:string|number;PaymentName?:string;PaymentInstructionsDoc?:string;Total?:number|string;Fee?:number|string;Expired?:string}}|null;
  const data=payload?.Data;
  const transactionId=data?.TransactionId;
  // Direct Payment may omit SessionId; TransactionId is also accepted by our callback matcher.
  const sessionId=data?.SessionId??data?.SessionID??transactionId;
  const qrImage=data?.QrImage;
  const paymentNo=data?.PaymentNo===undefined?null:String(data.PaymentNo);
  const url=typeof data?.Url==='string'?data.Url:null;
  if(!response.ok||payload?.Status!==200||!data||transactionId===undefined||sessionId===undefined){
    const providerMessage=typeof payload?.Message==='string'?payload.Message.replace(/[\r\n\t]+/g,' ').slice(0,180):null;
    console.error('ipaymu_direct_payment_failed',{method:input.method,channel:input.channel,httpStatus:response.status,providerStatus:payload?.Status??null,providerMessage,responseFields:data?Object.keys(data).sort():[]});
    throw new Error('We couldn’t start this payment. Choose another method or try again later.');
  }
  const providerTotal=Number(data.Total);
  if(input.method==='qris'&&(!qrImage||!Number.isFinite(providerTotal)||Math.round(providerTotal)!==input.amount))throw new Error('The QRIS amount did not match this order. Please try again.');
  const parsedQr=input.method==='qris'&&qrImage?ipaymuQrImageUrl(qrImage,baseUrl.includes('sandbox')?'sandbox':'production'):null;
  if(input.method==='qris'&&(!qrImage||!parsedQr))throw new Error('We couldn’t open the QR code. Choose another method or try again.');
  let checkoutUrl:string|null=null;
  if(url){try{const parsedUrl=new URL(url);if(parsedUrl.protocol!=='https:'||parsedUrl.username||parsedUrl.password||(parsedUrl.port&&parsedUrl.port!=='443')||!parsedUrl.hostname||parsedUrl.hostname==='localhost')throw new Error();checkoutUrl=parsedUrl.toString()}catch{throw new Error('The payment page could not be opened. Choose another method or try again.')}}
  if(input.method!=='qris'&&!paymentNo&&!checkoutUrl)throw new Error('Payment instructions aren’t available. Choose another method or try again later.');
  let instructionsUrl:string|null=null;
  if(typeof data.PaymentInstructionsDoc==='string'){try{const parsedUrl=new URL(data.PaymentInstructionsDoc);if(parsedUrl.protocol==='https:'&&(parsedUrl.hostname==='storage.googleapis.com'||parsedUrl.hostname==='ipaymu.com'||parsedUrl.hostname.endsWith('.ipaymu.com')))instructionsUrl=parsedUrl.toString()}catch{}}
  const fee=Number(data.Fee);
  const providerExpiry=ipaymuExpiryTimestamp(data.Expired,paymentCreatedAt);
  const createdTimestamp=Date.parse(paymentCreatedAt);
  const expiresAt=providerExpiry!==null&&providerExpiry>createdTimestamp?providerExpiry:createdTimestamp+24*60*60*1000;
  return {sessionId:String(sessionId),transactionId:String(transactionId),paymentMethod:input.method,paymentChannel:input.channel,qrImage:parsedQr,qrString:typeof data.QrString==='string'?data.QrString:null,checkoutUrl,paymentNo,paymentName:typeof data.PaymentName==='string'?data.PaymentName:null,instructionsUrl,fee:Number.isFinite(fee)&&fee>=0?Math.round(fee):null,total:Number.isFinite(providerTotal)&&providerTotal>=input.amount?Math.round(providerTotal):input.amount,paymentCreatedAt,expiresAt:new Date(expiresAt).toISOString()};
}

export async function createIpaymuQris(input:{orderId:string;amount:number;buyer:{name:string;email:string;phone:string};returnUrl:string;notifyUrl:string}){
  const payment=await createIpaymuDirectPayment({...input,method:'qris',channel:'mpm'});
  if(!payment.qrImage)throw new Error('We couldn’t open the QR code. Choose another method or try again.');
  return payment;
}

type CallbackValue=string|number|boolean|null|unknown[];
export type IpaymuCallback=Record<string,CallbackValue>;

function normalizeCallback(raw:Record<string,unknown>):IpaymuCallback{
  const normalized:IpaymuCallback={};
  for(const [key,value] of Object.entries(raw)){
    if(key==='signature')continue;
    if(['trx_id','status_code','transaction_status_code','paid_off'].includes(key)){
      const number=Number(value);normalized[key]=Number.isFinite(number)?Math.trunc(number):String(value);
    }else if(key==='is_escrow')normalized[key]=value===true||value==='true'||value==='1'||value===1;
    else if(key==='additional_info'){
      if(value==='[]'||value==null)normalized[key]=[];
      else if(Array.isArray(value))normalized[key]=value;
      else {try{normalized[key]=JSON.parse(String(value)) as unknown[]}catch{normalized[key]=String(value)}}
    }else if(value===null||typeof value==='number'||typeof value==='boolean'||Array.isArray(value))normalized[key]=value as CallbackValue;
    else normalized[key]=String(value);
  }
  if(!Object.hasOwn(normalized,'additional_info'))normalized.additional_info=[];
  return normalized;
}

export async function parseAndVerifyIpaymuCallback(request:Request):Promise<IpaymuCallback|null>{
  const signature=request.headers.get('x-signature')?.trim().toLowerCase();
  const va=process.env.IPAYMU_VA?.trim();
  if(!signature||!va)return null;
  const contentType=request.headers.get('content-type')??'';
  const raw:Record<string,unknown>={};
  if(contentType.includes('application/json')){
    const data=await request.json().catch(()=>null);
    if(!data||typeof data!=='object'||Array.isArray(data))return null;
    Object.assign(raw,data);
  }else{
    const form=new URLSearchParams(await request.text());
    form.forEach((value,key)=>{raw[key]=value});
  }
  const normalized=normalizeCallback(raw);
  const sorted=Object.fromEntries(Object.keys(normalized).sort((a,b)=>a.localeCompare(b)).map(key=>[key,normalized[key]]));
  const canonical=JSON.stringify(sorted).replace(/\//g,'\\/');
  const expected=await hmac(canonical,va);
  if(expected.length!==signature.length)return null;
  let mismatch=0;
  for(let index=0;index<expected.length;index++)mismatch|=expected.charCodeAt(index)^signature.charCodeAt(index);
  return mismatch===0?normalized:null;
}

export function callbackIsSuccessful(payload:IpaymuCallback){
  const statusCode=Number(payload.status_code);
  const transactionStatus=payload.transaction_status_code===undefined?undefined:Number(payload.transaction_status_code);
  const status=String(payload.status??'').toLowerCase();
  return statusCode===1&&(transactionStatus===undefined||transactionStatus===1||transactionStatus===6)&&(status===''||status==='berhasil'||status==='success');
}

export function callbackAmount(payload:IpaymuCallback){
  const candidates=[payload.amount,payload.total,payload.sub_total];
  for(const value of candidates){if(value!==undefined&&value!==null&&String(value).trim()!==''){const amount=Number(value);if(Number.isSafeInteger(amount))return amount}}
  return null;
}

export function callbackReference(payload:IpaymuCallback){return String(payload.reference_id??payload.referenceId??'')}

export function callbackSessionId(payload:IpaymuCallback){return String(payload.sid??'')}
export function callbackTransactionId(payload:IpaymuCallback){return String(payload.trx_id??'')}

function timestamp(value:unknown,defaultZone:'+07:00'|'Z'='+07:00'){
  if(typeof value!=='string'||!value.trim())return null;
  const raw=value.trim();
  const withZone=/Z$|[+-]\d{2}:?\d{2}$/.test(raw)?raw:`${raw.replace(' ','T')}${defaultZone}`;
  const timestamp=Date.parse(withZone);
  return Number.isFinite(timestamp)?timestamp:null;
}

export function ipaymuExpiryTimestamp(value:unknown,paymentCreatedAt?:unknown,legacyUpdatedAt?:unknown){
  // iPaymu's timezone-less `Expired` is the transaction's payable-until time.
  const providerExpiry=timestamp(value);
  if(providerExpiry!==null)return providerExpiry;
  // Some responses omit it; keep the checkout aligned with iPaymu's default
  // transaction window. Refreshing an image must never expire the order.
  const created=timestamp(paymentCreatedAt);
  if(created!==null)return created+24*60*60*1000;
  // Older orders did not store the QRIS creation instant. Their updated_at is
  // the nearest available timestamp for when the gateway payment was created.
  const legacyCreated=timestamp(legacyUpdatedAt,'Z');
  if(legacyCreated!==null)return legacyCreated+24*60*60*1000-10_000;
  return null;
}

export function callbackStatus(payload:IpaymuCallback):'EXPIRED'|'FAILED'|'PENDING_PAYMENT'{
  const status=String(payload.status??'').toLowerCase();
  return Number(payload.status_code)===-2||Number(payload.transaction_status_code)===-2||status==='expired'?'EXPIRED':Number(payload.status_code)<0||status==='failed'?'FAILED':'PENDING_PAYMENT';
}
