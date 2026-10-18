import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeListingItemPrices} from '../lib/market/normalize-listing-prices';

test('fills a missing legacy unit price from the stored listing total',()=>{
  const items=normalizeListingItemPrices([{printingId:'p1',quantity:1,unitAmount:0}],125_000);
  assert.equal(items[0].unitAmount,125_000);
});

test('keeps saved prices and allocates the remainder across unpriced copies',()=>{
  const items=normalizeListingItemPrices([{printingId:'p1',quantity:1,unitAmount:50_000},{printingId:'p2',quantity:2,unitAmount:0}],150_000);
  assert.deepEqual(items.map(item=>item.unitAmount),[50_000,50_000]);
});

test('does not invent a price when the listing and item prices are both missing',()=>{
  const items=normalizeListingItemPrices([{printingId:'p1',quantity:1,unitAmount:0}],0);
  assert.equal(items[0].unitAmount,0);
});
