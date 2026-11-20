import { z } from 'zod';
import { db, errorResponse, guard, HttpError, user } from '@/lib/server/store';
import {
  computeQuestBoard,
  PRO_TRIAL_DAYS,
  PRO_TRIAL_QUEST_KEY,
  PRO_TRIAL_REQUIRED_CLAIMS,
  QUEST_DEFINITIONS,
  type QuestStats,
} from '@/lib/quests';

const claimSchema = z.object({
  questKey: z.string().min(1).max(64),
});

async function loadQuestBoard(ownerId: string) {
  const database = db();
  const [vaultRow, deckRow, addressRow, listingRow, wishlistRow, orderRow, claimRows] =
    await Promise.all([
      database
        .prepare(
          'SELECT COALESCE(SUM(quantity), 0) AS total FROM collectible_instances WHERE owner_id=? AND deleted_at IS NULL'
        )
        .bind(ownerId)
        .first<{ total: number }>(),
      database
        .prepare('SELECT COUNT(*) AS total FROM decks WHERE owner_id=? AND deleted_at IS NULL')
        .bind(ownerId)
        .first<{ total: number }>(),
      database
        .prepare(
          "SELECT 1 AS ok FROM seller_shipping_origins WHERE owner_id=? AND COALESCE(trim(address_line),'')<>'' AND COALESCE(trim(city),'')<>'' LIMIT 1"
        )
        .bind(ownerId)
        .first<{ ok: number }>(),
      database
        .prepare('SELECT COUNT(*) AS total FROM listings WHERE seller_id=?')
        .bind(ownerId)
        .first<{ total: number }>(),
      database
        .prepare('SELECT COUNT(*) AS total FROM wishlists WHERE owner_id=?')
        .bind(ownerId)
        .first<{ total: number }>(),
      database
        .prepare(
          "SELECT COUNT(*) AS total FROM checkout_orders WHERE buyer_id=? AND kind='MARKET' AND status IN ('PROCESSING','PAID','SHIPPED','RECEIVED','COMPLETED')"
        )
        .bind(ownerId)
        .first<{ total: number }>(),
      database
        .prepare('SELECT quest_key AS questKey FROM quest_claims WHERE owner_id=?')
        .bind(ownerId)
        .all<{ questKey: string }>(),
    ]);

  const stats: QuestStats = {
    vaultCards: Number(vaultRow?.total ?? 0),
    decks: Number(deckRow?.total ?? 0),
    hasDeliveryAddress: Boolean(addressRow?.ok),
    listings: Number(listingRow?.total ?? 0),
    wishlists: Number(wishlistRow?.total ?? 0),
    paidOrders: Number(orderRow?.total ?? 0),
  };
  const claimedKeys = new Set(claimRows.results.map((row) => row.questKey));
  return computeQuestBoard(stats, claimedKeys);
}

export async function GET() {
  try {
    const profile = await user();
    const board = await loadQuestBoard(profile.id);
    return Response.json(board, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    guard(request);
    const profile = await user();
    const { questKey } = claimSchema.parse(await request.json());
    const database = db();
    const board = await loadQuestBoard(profile.id);

    if (questKey === PRO_TRIAL_QUEST_KEY) {
      if (board.claimedCount < PRO_TRIAL_REQUIRED_CLAIMS) {
        throw new HttpError(409, 'Complete and claim at least 3 quests first.');
      }
      const insert = await database
        .prepare(
          "INSERT OR IGNORE INTO quest_claims (id, owner_id, quest_key, reward_type, reward_value) VALUES (?, ?, ?, 'pro_days', ?)"
        )
        .bind(crypto.randomUUID(), profile.id, PRO_TRIAL_QUEST_KEY, PRO_TRIAL_DAYS)
        .run();
      if (insert.meta.changes > 0) {
        await database
          .prepare(
            `UPDATE profiles
             SET tier='pro',
                 pro_expires_at=datetime(CASE WHEN pro_expires_at IS NOT NULL AND datetime(pro_expires_at) > datetime('now') THEN pro_expires_at ELSE 'now' END, ?),
                 updated_at=CURRENT_TIMESTAMP
             WHERE id=?`
          )
          .bind(`+${PRO_TRIAL_DAYS} days`, profile.id)
          .run();
      }
      const updated = await loadQuestBoard(profile.id);
      return Response.json(updated);
    }

    const quest = QUEST_DEFINITIONS.find((item) => item.key === questKey);
    if (!quest) throw new HttpError(404, 'Quest was not found.');
    const state = board.quests.find((item) => item.key === questKey);
    if (!state?.completed) {
      throw new HttpError(409, 'Complete this quest before claiming its reward.');
    }

    await database
      .prepare(
        "INSERT OR IGNORE INTO quest_claims (id, owner_id, quest_key, reward_type, reward_value) VALUES (?, ?, ?, 'vp', ?)"
      )
      .bind(crypto.randomUUID(), profile.id, quest.key, quest.points)
      .run();

    const updated = await loadQuestBoard(profile.id);
    return Response.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
