import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKET_MAX_CARD_TYPES,
  MARKET_MAX_COPIES_PER_CARD,
  MARKET_MAX_LISTING_COPIES,
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
