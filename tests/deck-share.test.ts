import assert from 'node:assert/strict';
import test from 'node:test';
import {parseSharedDeck, sharedDeckSearch} from '../lib/deck-share';

test('serializes a stable deck builder URL query', () => {
  const query = sharedDeckSearch({leaderCode: 'eb01-008', title: 'Blue list', entries: [{code: 'OP07-035', quantity: 4}, {code: 'EB01-007', quantity: 1}]});
  assert.equal(query, 'view=deck&game=onepiece&leader=EB01-008&name=Blue+list&deck=1xEB01-007%7C4xOP07-035');
});

test('restores valid entries while enforcing deck limits', () => {
  const shared = parseSharedDeck(new URLSearchParams('game=onepiece&leader=eb01-008&deck=9xEB01-007%7C2xOP07-035%7Cbad'));
  assert.deepEqual(shared, {leaderCode: 'EB01-008', title: undefined, entries: [{code: 'EB01-007', quantity: 4}, {code: 'OP07-035', quantity: 2}]});
});

test('ignores a shared query for a different game', () => {
  assert.equal(parseSharedDeck(new URLSearchParams('game=other&deck=1xOP07-035')), undefined);
});
