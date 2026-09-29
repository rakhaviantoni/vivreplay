import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getListingPolicy,
  computeListingExpiration,
  isListingExpired,
  getDaysUntilExpiration,
  LISTING_POLICIES,
} from '../lib/market/policy.ts';

test('listing policy defaults to free tier (30 days, 25 max listings)', () => {
  const policy = getListingPolicy(null);
  assert.equal(policy.tier, 'free');
  assert.equal(policy.durationDays, 30);
  assert.equal(policy.maxActiveListings, 25);
  assert.equal(policy.canAutoRenew, false);
  assert.equal(policy.commissionPercent, 2);
});

test('listing policy supports pro tier (60 days, 1000 max listings)', () => {
  const policy = getListingPolicy('pro');
  assert.equal(policy.tier, 'pro');
  assert.equal(policy.durationDays, 60);
  assert.equal(policy.maxActiveListings, 1000);
  assert.equal(policy.canAutoRenew, true);
  assert.equal(policy.commissionPercent, 1);
});

test('computeListingExpiration computes correct date offset', () => {
  const base = new Date('2026-09-29T12:00:00Z');
  const expiresAt = computeListingExpiration(30, base);
  assert.equal(expiresAt, '2026-10-29 12:00:00');
});

test('isListingExpired detects expired vs active timestamps', () => {
  assert.equal(isListingExpired('2020-01-01 00:00:00'), true);
  assert.equal(isListingExpired('2030-01-01 00:00:00'), false);
  assert.equal(isListingExpired(null), false);
  assert.equal(isListingExpired(undefined), false);
});

test('getDaysUntilExpiration computes remaining days', () => {
  const future = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
  const days = getDaysUntilExpiration(future);
  assert.ok(days !== null && days >= 14 && days <= 16);
});
