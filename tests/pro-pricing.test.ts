import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PRO_PRICING,getProPricing} from '@/lib/market/pro-pricing';

function settingsDatabase(value:string|null){
  return {prepare(){return{async first<T=unknown>(){return value?{value} as T:null}}}};
}

test('annual Pro pricing defaults to one year at the configured annual rate',async()=>{
  const pricing=await getProPricing(settingsDatabase(null));
  assert.equal(pricing.annualAmount,249_000);
  assert.equal(pricing.annualDurationDays,365);
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
