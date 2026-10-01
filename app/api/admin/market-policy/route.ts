import { db, errorResponse } from '@/lib/server/store';
import {
  fetchMarketPolicies,
  type AccountTier,
  type ListingTierPolicy,
} from '@/lib/market/policy';
import { z } from 'zod';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

const policySchema = z.object({
  free: z.object({
    durationDays: z.number().int().min(1).max(365),
    maxActiveListings: z.number().int().min(1).max(100000),
    commissionPercent: z.number().min(0).max(100),
    canAutoRenew: z.boolean().default(false),
  }),
  pro: z.object({
    durationDays: z.number().int().min(1).max(365),
    maxActiveListings: z.number().int().min(1).max(100000),
    commissionPercent: z.number().min(0).max(100),
    canAutoRenew: z.boolean().default(true),
  }),
});

async function requireAdmin(){
  if(!await isCurrentUserAdmin())throw new Error('ADMIN_ACCESS_REQUIRED');
}

export async function GET() {
  try {
    await requireAdmin();
    const d = db();
    const policies = await fetchMarketPolicies(d);

    const [activeListings, totalSellers] = await Promise.all([
      d.prepare(
        "SELECT COUNT(*) AS total FROM listings WHERE status='ACTIVE' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)"
      ).first<{ total: number }>(),
      d.prepare(
        "SELECT COUNT(DISTINCT seller_id) AS total FROM listings WHERE status='ACTIVE'"
      ).first<{ total: number }>(),
    ]);

    return Response.json({
      policies,
      stats: {
        activeListings: activeListings?.total ?? 0,
        activeSellers: totalSellers?.total ?? 0,
      },
    });
  } catch (e) {
    if(e instanceof Error&&e.message==='ADMIN_ACCESS_REQUIRED')return Response.json({error:'Admin access is required.'},{status:403});
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const d = db();
    const body = await req.json();
    const parsed = policySchema.parse(body);

    const payload: Record<AccountTier, ListingTierPolicy> = {
      free: {
        tier: 'free',
        durationDays: parsed.free.durationDays,
        maxActiveListings: parsed.free.maxActiveListings,
        canAutoRenew: false,
        commissionPercent: parsed.free.commissionPercent,
      },
      pro: {
        tier: 'pro',
        durationDays: parsed.pro.durationDays,
        maxActiveListings: parsed.pro.maxActiveListings,
        canAutoRenew: parsed.pro.canAutoRenew,
        commissionPercent: parsed.pro.commissionPercent,
      },
    };

    const jsonValue = JSON.stringify(payload);
    await d.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('market_policy', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
    `).bind(jsonValue).run();

    return Response.json({
      success: true,
      policies: payload,
    });
  } catch (e) {
    if(e instanceof Error&&e.message==='ADMIN_ACCESS_REQUIRED')return Response.json({error:'Admin access is required.'},{status:403});
    return errorResponse(e);
  }
}
