import assert from 'node:assert/strict';
import test from 'node:test';
import {MARKET_REVIEW_WINDOW_MS,marketReviewRemainingMs} from '../lib/market/review-window';

test('the delivery review countdown starts at 48 hours and reaches zero at the deadline',()=>{
  const delivered='2026-10-16 08:00:00';
  const timestamp=Date.parse('2026-10-16T08:00:00Z');
  assert.equal(marketReviewRemainingMs(delivered,timestamp),MARKET_REVIEW_WINDOW_MS);
  assert.equal(marketReviewRemainingMs(delivered,timestamp+MARKET_REVIEW_WINDOW_MS-60_000),60_000);
  assert.equal(marketReviewRemainingMs(delivered,timestamp+MARKET_REVIEW_WINDOW_MS),0);
  assert.equal(marketReviewRemainingMs(delivered,timestamp+MARKET_REVIEW_WINDOW_MS+1),0);
});

test('the review countdown accepts timezone-aware timestamps and hides invalid dates',()=>{
  const delivered='2026-10-16T08:00:00+07:00';
  const timestamp=Date.parse(delivered);
  assert.equal(marketReviewRemainingMs(delivered,timestamp),MARKET_REVIEW_WINDOW_MS);
  assert.equal(marketReviewRemainingMs('not-a-date',timestamp),null);
  assert.equal(marketReviewRemainingMs(null,timestamp),null);
});
