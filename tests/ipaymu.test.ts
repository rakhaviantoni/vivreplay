import test from 'node:test';
import assert from 'node:assert/strict';
import {callbackAmount,callbackIsSuccessful,callbackReference,callbackSessionId,createIpaymuRedirect,parseAndVerifyIpaymuCallback} from '../lib/server/ipaymu';

const encoder=new TextEncoder();
const hex=(data:ArrayBuffer)=>[...new Uint8Array(data)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
async function signature(text:string,key:string){const cryptoKey=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',cryptoKey,encoder.encode(text)))}

test('iPaymu callback verification normalizes documented numeric fields and defaults additional_info',async()=>{
  const previous=process.env.IPAYMU_VA;
  process.env.IPAYMU_VA='merchant-va-test';
  const fields:Record<string,string>={reference_id:'order-123',sid:'session-456',status:'berhasil',status_code:'1',transaction_status_code:'6',amount:'125000',trx_id:'77'};
  const canonical=JSON.stringify(Object.fromEntries(Object.keys({...fields,additional_info:[]}).sort((a,b)=>a.localeCompare(b)).map(key=>[key,key==='additional_info'?[]:['status_code','transaction_status_code','trx_id'].includes(key)?Number(fields[key]):fields[key]]))).replace(/\//g,'\\/');
  const form=new URLSearchParams(fields);
  const request=new Request('https://vivreplay.com/api/checkout/ipaymu/callback',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-signature':await signature(canonical,'merchant-va-test')},body:form});
  const payload=await parseAndVerifyIpaymuCallback(request);
  assert.ok(payload);
  assert.equal(callbackReference(payload),'order-123');
  assert.equal(callbackSessionId(payload),'session-456');
  assert.equal(callbackAmount(payload),125000);
  assert.equal(callbackIsSuccessful(payload),true);
  assert.deepEqual(payload.additional_info,[]);
  if(previous===undefined)delete process.env.IPAYMU_VA;else process.env.IPAYMU_VA=previous;
});

test('iPaymu callback rejects modified payloads',async()=>{
  const previous=process.env.IPAYMU_VA;
  process.env.IPAYMU_VA='merchant-va-test';
  const request=new Request('https://vivreplay.com/api/checkout/ipaymu/callback',{method:'POST',headers:{'content-type':'application/json','x-signature':'0'.repeat(64)},body:JSON.stringify({reference_id:'order-123',sid:'session-456',status:'berhasil',status_code:1,amount:'1000'})});
  assert.equal(await parseAndVerifyIpaymuCallback(request),null);
  if(previous===undefined)delete process.env.IPAYMU_VA;else process.env.IPAYMU_VA=previous;
});

test('iPaymu hosted checkout signs the exact JSON body sent to the gateway',async()=>{
  const previous={mode:process.env.IPAYMU_MODE,va:process.env.IPAYMU_VA,key:process.env.IPAYMU_API_KEY,fetch:globalThis.fetch};
  process.env.IPAYMU_MODE='sandbox';process.env.IPAYMU_VA='sandbox-va';process.env.IPAYMU_API_KEY='sandbox-key';
  let capturedBody='';let capturedSignature='';let capturedTimestamp='';
  globalThis.fetch=(async(_input,init)=>{
    capturedBody=String(init?.body);const headers=new Headers(init?.headers);capturedSignature=headers.get('signature')??'';capturedTimestamp=headers.get('timestamp')??'';
    return Response.json({Status:200,Data:{SessionID:'session-123',Url:'https://sandbox.ipaymu.com/payment/session-123'}});
  }) as typeof fetch;
  try{
    const result=await createIpaymuRedirect({orderId:'order-123',products:[{name:'Market Pro',quantity:1,unitPrice:15000,description:'Market Pro · 14 days'}],buyer:{name:'Test buyer',email:'test@example.com',phone:'+628123456789'},returnUrl:'https://vivreplay.com/checkout/order/order-123',cancelUrl:'https://vivreplay.com/checkout/order/order-123?cancelled',notifyUrl:'https://vivreplay.com/api/checkout/ipaymu/callback'});
    const body=JSON.parse(capturedBody) as Record<string,unknown>;
    const bodyHash=hex(await crypto.subtle.digest('SHA-256',encoder.encode(capturedBody)));
    const expected=await signature(`POST:sandbox-va:${bodyHash}:sandbox-key`,'sandbox-key');
    assert.equal(capturedSignature,expected);
    assert.match(capturedTimestamp,/^\d{14}$/);
    assert.equal(body.referenceId,'order-123');
    assert.equal(body.product instanceof Array,true);
    assert.equal(result.sessionId,'session-123');
    assert.equal(result.url,'https://sandbox.ipaymu.com/payment/session-123');
  }finally{
    globalThis.fetch=previous.fetch;
    if(previous.mode===undefined)delete process.env.IPAYMU_MODE;else process.env.IPAYMU_MODE=previous.mode;
    if(previous.va===undefined)delete process.env.IPAYMU_VA;else process.env.IPAYMU_VA=previous.va;
    if(previous.key===undefined)delete process.env.IPAYMU_API_KEY;else process.env.IPAYMU_API_KEY=previous.key;
  }
});
