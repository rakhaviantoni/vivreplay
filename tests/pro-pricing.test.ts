import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PRO_PRICING,getProPricing} from '@/lib/market/pro-pricing';
import {MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH,MARKET_PRO_SHIPPING_VOUCHERS_PER_YEAR} from '@/lib/market/policy';

function settingsDatabase(value:string|null){
  return {prepare(){return{async first<T=unknown>(){return value?{value} as T:null}}}};
}

test('annual Pro pricing defaults to one year at the configured annual rate',async()=>{
  const pricing=await getProPricing(settingsDatabase(null));
  assert.equal(pricing.annualAmount,249_000);
  assert.equal(pricing.annualDurationDays,365);
});

test('annual Pro+ includes twelve monthly voucher allowances in one term pool',()=>{
  assert.equal(MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH,2);
  assert.equal(MARKET_PRO_SHIPPING_VOUCHERS_PER_YEAR,24);
});

test('older saved monthly pricing gains annual defaults without losing its values',async()=>{
  const pricing=await getProPricing(settingsDatabase(JSON.stringify({amount:29_900,durationDays:30,introAmount:null,introEndsAt:null,introLimit:0})));
  assert.equal(pricing.amount,29_900);
  assert.equal(pricing.annualAmount,DEFAULT_PRO_PRICING.annualAmount);
  assert.equal(pricing.annualDurationDays,365);
});

test('admin-saved annual price and term are returned',async()=>{
  const pricing=await getProPricing(settingsDatabase(JSON.stringify({...DEFAULT_PRO_PRICING,annualAmount:299_000,annualDurationDays:360})));
  assert.equal(pricing.annualAmount,299_000);
  assert.equal(pricing.annualDurationDays,360);
});
