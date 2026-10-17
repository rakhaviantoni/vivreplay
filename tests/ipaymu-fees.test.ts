import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateIpaymuFee} from '../lib/market/ipaymu-fees';

test('iPaymu channel estimates follow published percentage and fixed fees',()=>{
  const option=(method:string,channel:string,fee=0,feeType:'FLAT'|'PERCENT'='FLAT',additionalFee=0)=>({method,channel,fee,feeType,additionalFee});
  assert.equal(estimateIpaymuFee(option('paylater','akulaku',3500),100_000),6_500);
  assert.equal(estimateIpaymuFee(option('va','bca',4000),100_000),4_500);
  assert.equal(estimateIpaymuFee(option('ewallet','dana',3500),100_000),3_500);
  assert.equal(estimateIpaymuFee(option('ewallet','shopeepay',3500),50_000),1_750);
  assert.equal(estimateIpaymuFee(option('cc','cc',2.8,'PERCENT',5000),100_000),4_500);
});

test('QRIS fee is excluded from buyer estimate because the request makes the merchant pay it',()=>{
  assert.equal(estimateIpaymuFee({method:'qris',channel:'mpm',fee:.7,feeType:'PERCENT',additionalFee:0},250_000),0);
});

test('channels without a published override use the live iPaymu channel fee',()=>{
  assert.equal(estimateIpaymuFee({method:'va',channel:'bni',fee:3500,feeType:'FLAT',additionalFee:0},80_000),3500);
});
