type GatewayIntent={payment_id:string;order_id:string;amount:number;currency:string;status:string;expires_at:string|null;checkout_url:string};
type GatewayInstrument={transactionId:string;referenceId:string;method:string;channel:string;paymentNo:string;paymentName:string;total:number;fee:number;expiresAt:string|null;url:string|null;qrString:string|null};

function gatewayConfig(){
  const baseUrl=(process.env.AZEKHA_PAYMENT_GATEWAY_URL??'').trim().replace(/\/$/,'');
  const key=(process.env.AZEKHA_PAYMENT_PROJECT_KEY??'').trim();
  if(!baseUrl||!key)throw new Error('VivrePlay checkout is not configured yet.');
  return {baseUrl,key};
}

async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const {baseUrl,key}=gatewayConfig();
  const response=await fetch(`${baseUrl}${path}`,{
    ...init,
    headers:{'content-type':'application/json','x-api-key':key,...init.headers},
    cache:'no-store',
  });
  const payload=await response.json().catch(()=>null) as (T&{error?:{message?:string}})|null;
  if(!response.ok||!payload)throw new Error(payload?.error?.message||'The payment service is temporarily unavailable.');
  return payload;
}

export function hasAzekhaPaymentConfig(){
  return Boolean(process.env.AZEKHA_PAYMENT_GATEWAY_URL?.trim()&&process.env.AZEKHA_PAYMENT_PROJECT_KEY?.trim());
}

export function createAzekhaIntent(input:{orderId:string;amount:number;customer:{name:string;email:string;mobile:string};successUrl:string;cancelUrl:string}){
  return request<GatewayIntent>('/payments/v1/intents',{method:'POST',body:JSON.stringify({
    order_id:input.orderId,
    amount:input.amount,
    currency:'IDR',
    expires_in_hours:24,
    provider:'azekha',
    success_return_url:input.successUrl,
    cancel_return_url:input.cancelUrl,
    customer:input.customer,
  })});
}

export function getAzekhaIntent(paymentId:string){
  return request<GatewayIntent>(`/payments/v1/intents/${encodeURIComponent(paymentId)}`,{method:'GET'});
}

export async function createAzekhaInstrument(paymentId:string,method:'qris'|'va'|'ewallet',channel:string){
  const {baseUrl}=gatewayConfig();
  const response=await fetch(`${baseUrl}/payments/custom/${encodeURIComponent(paymentId)}/instruments`,{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,channel}),cache:'no-store',
  });
  const payload=await response.json().catch(()=>null) as {instrument?:GatewayInstrument;error?:{message?:string}}|null;
  if(!response.ok||!payload?.instrument)throw new Error(payload?.error?.message||'This payment method could not be prepared.');
  return payload.instrument;
}
