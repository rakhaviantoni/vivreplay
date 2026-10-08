import { db, errorResponse } from '@/lib/server/store';
import {
  fetchMarketPolicies,
  type AccountTier,
  type ListingTierPolicy,
} from '@/lib/market/policy';
import { z } from 'zod';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';
import {getProPricing,type ProPricing} from '@/lib/market/pro-pricing';

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
const pricingSchema=z.object({
  amount:z.number().int().min(1000).max(100_000_000),
  durationDays:z.number().int().min(1).max(365),
  introAmount:z.number().int().min(1000).max(100_000_000).nullable(),
  introEndsAt:z.string().datetime().nullable(),
  introLimit:z.number().int().min(0).max(1_000_000),
}).refine(value=>value.introAmount===null||value.introAmount<value.amount,{message:'Introductory price must be lower than the regular price.',path:['introAmount']});

async function requireAdmin(){
  if(!await isCurrentUserAdmin())throw new Error('ADMIN_ACCESS_REQUIRED');
}

export async function GET() {
  try {
    await requireAdmin();
    const d = db();
    const policies = await fetchMarketPolicies(d);

    const [activeListings, totalSellers,proPricing] = await Promise.all([
      d.prepare(
        "SELECT COUNT(*) AS total FROM listings WHERE status='ACTIVE' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)"
      ).first<{ total: number }>(),
      d.prepare(
        "SELECT COUNT(DISTINCT seller_id) AS total FROM listings WHERE status='ACTIVE'"
      ).first<{ total: number }>(),
      getProPricing(d),
    ]);

    return Response.json({
      policies,
      proPricing,
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
    const parsed = policySchema.extend({proPricing:pricingSchema}).parse(body);

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
    const pricing:ProPricing=parsed.proPricing;
    const pricingJson=JSON.stringify(pricing);
    await d.batch([d.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('market_policy', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
    `).bind(jsonValue),d.prepare(`
      INSERT INTO app_settings (key,value,updated_at) VALUES ('pro_pricing',?,CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP
    `).bind(pricingJson)]);

    return Response.json({
      success: true,
      policies: payload,
      proPricing:pricing,
    });
  } catch (e) {
    if(e instanceof Error&&e.message==='ADMIN_ACCESS_REQUIRED')return Response.json({error:'Admin access is required.'},{status:403});
    return errorResponse(e);
  }
}
