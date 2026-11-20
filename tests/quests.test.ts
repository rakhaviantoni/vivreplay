import assert from 'node:assert/strict';
import test from 'node:test';
import { computeQuestBoard, PRO_TRIAL_QUEST_KEY } from '../lib/quests';

test('computeQuestBoard tracks incomplete, ready, and claimed quests accurately', () => {
  const board = computeQuestBoard(
    {
      vaultCards: 7,
      decks: 1,
      hasDeliveryAddress: true,
      listings: 0,
      wishlists: 2,
      paidOrders: 0,
    },
    new Set(['vault_first_cards', 'deck_builder', 'delivery_ready'])
  );

  assert.equal(board.claimedCount, 3);
  assert.equal(board.earnedPoints, 150);
  assert.equal(board.readyCount, 1); // first_wishlist is ready
  assert.equal(board.proRewardUnlocked, true);
  assert.equal(board.proRewardClaimed, false);

  const vault25 = board.quests.find((q) => q.key === 'vault_collector_25');
  assert.equal(vault25?.progress, 7);
  assert.equal(vault25?.completed, false);
});

test('computeQuestBoard marks Pro trial claimed when key is present', () => {
  const board = computeQuestBoard(
    {
      vaultCards: 30,
      decks: 1,
      hasDeliveryAddress: true,
      listings: 1,
      wishlists: 1,
      paidOrders: 1,
    },
    new Set(['vault_first_cards', 'deck_builder', 'delivery_ready', PRO_TRIAL_QUEST_KEY])
  );

  assert.equal(board.proRewardUnlocked, true);
  assert.equal(board.proRewardClaimed, true);
  assert.equal(board.readyCount, 4);
});
