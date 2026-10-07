type IpaymuProduct={name:string;quantity:number;unitPrice:number;description:string};

type IpaymuRedirectBody={
  product:string[];qty:string[];price:string[];description:string[];
  returnUrl:string;notifyUrl:string;cancelUrl:string;referenceId:string;
  buyerName:string;buyerEmail:string;buyerPhone:string;expired:number;feeDirection:'MERCHANT';
};

function configuration(){
  const va=(process.env.IPAYMU_VA??'').trim();
  const apiKey=(process.env.IPAYMU_API_KEY??'').trim();
  const mode=(process.env.IPAYMU_MODE??'production').trim().toLowerCase();
  if(!va||!apiKey||(mode!=='production'&&mode!=='sandbox'))throw new Error('iPaymu checkout is not configured.');
  const production=mode==='production';
  if(production&&process.env.IPAYMU_PRODUCTION_READY!=='true')throw new Error('Production payments are awaiting gateway approval.');
  const baseUrl=production?'https://my.ipaymu.com':'https://sandbox.ipaymu.com';
  return {va,apiKey,baseUrl};
}

export function hasIpaymuPaymentConfig(){
  try{configuration();return true}catch{return false}
}

export function hasMarketIpaymuPaymentConfig(){
  return hasIpaymuPaymentConfig()&&((process.env.IPAYMU_MODE??'production').trim().toLowerCase()==='sandbox'||process.env.VIVREPLAY_MARKET_LIVE_PAYMENTS_ENABLED==='true');
}

export function isIpaymuProductionReady(){
  return Boolean((process.env.IPAYMU_MODE??'production').trim().toLowerCase()==='production'&&process.env.IPAYMU_PRODUCTION_READY==='true'&&process.env.IPAYMU_VA?.trim()&&process.env.IPAYMU_API_KEY?.trim());
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

async function requestSignature(bodyText:string,va:string,apiKey:string){
  const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bodyText)));
  return hmac(`POST:${va}:${digest}:${apiKey}`,apiKey);
}

export async function createIpaymuRedirect(input:{orderId:string;products:IpaymuProduct[];buyer:{name:string;email:string;phone:string};returnUrl:string;cancelUrl:string;notifyUrl:string}){
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
    feeDirection:'MERCHANT',
  };
  const bodyText=JSON.stringify(body);
  const now=new Date();
  const timestamp=`${now.getUTCFullYear()}${String(now.getUTCMonth()+1).padStart(2,'0')}${String(now.getUTCDate()).padStart(2,'0')}${String(now.getUTCHours()).padStart(2,'0')}${String(now.getUTCMinutes()).padStart(2,'0')}${String(now.getUTCSeconds()).padStart(2,'0')}`;
  const response=await fetch(`${baseUrl}/api/v2/payment`,{method:'POST',headers:{'Content-Type':'application/json',va,timestamp,signature:await requestSignature(bodyText,va,apiKey)},body:bodyText,cache:'no-store'});
  const payload=await response.json().catch(()=>null) as {Status?:number;Message?:string;Data?:{SessionID?:string;Url?:string}}|null;
  const url=payload?.Data?.Url;
  const sessionId=payload?.Data?.SessionID;
  if(!response.ok||payload?.Status!==200||!sessionId||!url)throw new Error('iPaymu could not start this payment. Please try again.');
  const parsed=new URL(url);
  const allowedHosts=baseUrl==='https://sandbox.ipaymu.com'?['sandbox-payment.ipaymu.com','sandbox.ipaymu.com']:['my.ipaymu.com','payment.ipaymu.com'];
  if(parsed.protocol!=='https:'||!allowedHosts.includes(parsed.hostname))throw new Error('iPaymu returned an invalid checkout address.');
  return {sessionId,url:parsed.toString()};
}

export async function createIpaymuQris(input:{orderId:string;amount:number;buyer:{name:string;email:string;phone:string};returnUrl:string;notifyUrl:string}){
  const {va,apiKey,baseUrl}=configuration();
  if(!Number.isSafeInteger(input.amount)||input.amount<1)throw new Error('This checkout has an invalid amount.');
  const body={
    name:input.buyer.name.slice(0,100),
    phone:input.buyer.phone.slice(0,30),
    email:input.buyer.email.slice(0,150),
    amount:input.amount,
    notifyUrl:input.notifyUrl,
    referenceId:input.orderId,
    paymentMethod:'qris',
    paymentChannel:'mpm',
    feeDirection:'MERCHANT',
    successUrl:input.returnUrl,
    comments:`VivrePlay Market order ${input.orderId}`.slice(0,255),
  };
  const bodyText=JSON.stringify(body);
  const now=new Date();
  const timestamp=`${now.getUTCFullYear()}${String(now.getUTCMonth()+1).padStart(2,'0')}${String(now.getUTCDate()).padStart(2,'0')}${String(now.getUTCHours()).padStart(2,'0')}${String(now.getUTCMinutes()).padStart(2,'0')}${String(now.getUTCSeconds()).padStart(2,'0')}`;
  const response=await fetch(`${baseUrl}/api/v2/payment/direct`,{method:'POST',headers:{'Content-Type':'application/json',va,timestamp,signature:await requestSignature(bodyText,va,apiKey)},body:bodyText,cache:'no-store'});
  const payload=await response.json().catch(()=>null) as {Status?:number;Message?:string;Data?:{SessionId?:string|number;TransactionId?:string|number;QrImage?:string;QrString?:string;Total?:number|string;Fee?:number|string;Expired?:string}}|null;
  const data=payload?.Data;
  const transactionId=data?.TransactionId;
  const sessionId=data?.SessionId;
  const qrImage=data?.QrImage;
  if(!response.ok||payload?.Status!==200||transactionId===undefined||sessionId===undefined||!qrImage)throw new Error('QRIS could not be started. Check that QRIS is enabled for this iPaymu account, then try again.');
  const providerTotal=Number(data.Total);
  if(Number.isFinite(providerTotal)&&providerTotal>0&&Math.round(providerTotal)!==input.amount)throw new Error('The QRIS amount did not match this order. Please try again.');
  const parsed=ipaymuQrImageUrl(qrImage,baseUrl.includes('sandbox')?'sandbox':'production');
  if(!parsed)throw new Error('iPaymu returned an invalid payment address.');
  const fee=Number(data.Fee);
  return {sessionId:String(sessionId),transactionId:String(transactionId),qrImage:parsed,qrString:typeof data.QrString==='string'?data.QrString:null,fee:Number.isFinite(fee)&&fee>=0?Math.round(fee):null,total:Number.isFinite(providerTotal)&&providerTotal>0?Math.round(providerTotal):input.amount,expiresAt:typeof data.Expired==='string'&&data.Expired?data.Expired:new Date(Date.now()+5*60*1000).toISOString()};
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

export function ipaymuExpiryTimestamp(value:unknown){
  if(typeof value!=='string'||!value.trim())return null;
  const raw=value.trim();
  const withZone=/Z$|[+-]\d{2}:?\d{2}$/.test(raw)?raw:`${raw.replace(' ','T')}+07:00`;
  const timestamp=Date.parse(withZone);
  return Number.isFinite(timestamp)?timestamp:null;
}

export function callbackStatus(payload:IpaymuCallback):'EXPIRED'|'FAILED'|'PENDING_PAYMENT'{
  const status=String(payload.status??'').toLowerCase();
  return Number(payload.status_code)===-2||Number(payload.transaction_status_code)===-2||status==='expired'?'EXPIRED':Number(payload.status_code)<0||status==='failed'?'FAILED':'PENDING_PAYMENT';
}
