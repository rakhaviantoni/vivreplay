import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKET_MAX_CARD_TYPES,
  MARKET_MAX_COPIES_PER_CARD,
  MARKET_MAX_LISTING_COPIES,
  listingLimitMessage,
  listingLimitViolation,
} from '../lib/market/listing-limits';

test('a listing supports 50 cards plus a Leader, or a four-copy playset', () => {
  const deck = Array.from({length: MARKET_MAX_CARD_TYPES}, (_, index) => ({printingId: `p-${index}`, quantity: 1}));
  assert.equal(deck.length, 51);
  assert.equal(deck.reduce((sum, item) => sum + item.quantity, 0), MARKET_MAX_LISTING_COPIES);
  assert.equal(listingLimitViolation(deck), null);
  assert.equal(listingLimitViolation([{printingId: 'leader', quantity: MARKET_MAX_COPIES_PER_CARD}]), null);
});

test('alternate printings share the same four-copy limit for one card identity', () => {
  const identities = new Map([['base-en', 'card-1'], ['parallel-en', 'card-1']]);
  assert.equal(listingLimitViolation([
    {printingId: 'base-en', quantity: 3},
    {printingId: 'parallel-en', quantity: 1},
  ], identities), null);
  assert.equal(listingLimitViolation([
    {printingId: 'base-en', quantity: 3},
    {printingId: 'parallel-en', quantity: 2},
  ], identities), 'too-many-copies-of-card');
});

test('the listing rejects more than 51 copies total or four copies of one card', () => {
  assert.equal(listingLimitViolation([{printingId: 'p-1', quantity: MARKET_MAX_LISTING_COPIES + 1}]), 'too-many-copies');
  assert.equal(listingLimitViolation([{printingId: 'p-1', quantity: MARKET_MAX_COPIES_PER_CARD + 1}]), 'too-many-copies-of-card');
});

test('plan bundle caps reject items beyond the selected membership limits',()=>{
  const free={maxListingCopies:51,maxCopiesPerCard:4,maxCardTypes:51};
  assert.equal(listingLimitViolation([{printingId:'a',quantity:5}],new Map(),free),'too-many-copies-of-card');
  assert.equal(listingLimitViolation(Array.from({length:52},(_,index)=>({printingId:`p-${index}`,quantity:1})),new Map(),free),'too-many-copies');
  assert.equal(listingLimitViolation(Array.from({length:51},(_,index)=>({printingId:`deck-${index}`,quantity:1})),new Map(),free),null);
  const annual={maxListingCopies:100,maxCopiesPerCard:20,maxCardTypes:100};
  assert.equal(listingLimitViolation(Array.from({length:100},(_,index)=>({printingId:`p-${index}`,quantity:1})),new Map(),annual),null);
  assert.equal(listingLimitViolation([{printingId:'one-card',quantity:21}],new Map(),annual),'too-many-copies-of-card');
  assert.equal(listingLimitMessage('too-many-copies','EN',annual),'A listing can include up to 100 cards, with no more than 20 copies of the same card.');
});
