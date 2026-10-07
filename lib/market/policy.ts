export type AccountTier = 'free' | 'pro';

export interface ListingTierPolicy {
  tier: AccountTier;
  durationDays: number;
  maxActiveListings: number;
  canAutoRenew: boolean;
  commissionPercent: number;
}

export const LISTING_POLICIES: Record<AccountTier, ListingTierPolicy> = {
  free: {
    tier: 'free',
    durationDays: 7,
    maxActiveListings: 12,
    canAutoRenew: false,
    commissionPercent: 1,
  },
  pro: {
    tier: 'pro',
    durationDays: 14,
    maxActiveListings: 500,
    canAutoRenew: true,
    commissionPercent: 0,
  },
};

export function parseMarketPolicies(rawJson: string | null | undefined): Record<AccountTier, ListingTierPolicy> {
  if (!rawJson) return LISTING_POLICIES;
  try {
    const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    return {
      free: {
        tier: 'free',
        durationDays: Math.max(1, Number(parsed.free?.durationDays) || LISTING_POLICIES.free.durationDays),
        maxActiveListings: Math.max(1, Number(parsed.free?.maxActiveListings) || LISTING_POLICIES.free.maxActiveListings),
        canAutoRenew: Boolean(parsed.free?.canAutoRenew),
        commissionPercent: Number.isFinite(Number(parsed.free?.commissionPercent)) ? Math.max(0, Number(parsed.free.commissionPercent)) : LISTING_POLICIES.free.commissionPercent,
      },
      pro: {
        tier: 'pro',
        durationDays: Math.max(1, Number(parsed.pro?.durationDays) || LISTING_POLICIES.pro.durationDays),
        maxActiveListings: Math.max(1, Number(parsed.pro?.maxActiveListings) || LISTING_POLICIES.pro.maxActiveListings),
        canAutoRenew: parsed.pro?.canAutoRenew !== false,
        commissionPercent: Number.isFinite(Number(parsed.pro?.commissionPercent)) ? Math.max(0, Number(parsed.pro.commissionPercent)) : LISTING_POLICIES.pro.commissionPercent,
      },
    };
  } catch {
    return LISTING_POLICIES;
  }
}

export async function fetchMarketPolicies(db: any): Promise<Record<AccountTier, ListingTierPolicy>> {
  try {
    const row = await (db.prepare("SELECT value FROM app_settings WHERE key='market_policy'") as any).first() as { value: string } | null;
    return parseMarketPolicies(row?.value);
  } catch {
    return LISTING_POLICIES;
  }
}

export async function getDynamicListingPolicy(tier: string | null | undefined, db: any): Promise<ListingTierPolicy> {
  const policies = await fetchMarketPolicies(db);
  const normalized = (tier ?? '').trim().toLowerCase();
  if (normalized === 'pro') return policies.pro;
  return policies.free;
}

export function getListingPolicy(tier?: string | null): ListingTierPolicy {
  const normalized = (tier ?? '').trim().toLowerCase();
  if (normalized === 'pro') return LISTING_POLICIES.pro;
  return LISTING_POLICIES.free;
}

export function computeListingExpiration(durationDays: number, fromDate = new Date()): string {
  const expires = new Date(fromDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  return expires.toISOString().replace('T', ' ').substring(0, 19);
}

export function isListingExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const iso = expiresAt.includes('T') ? expiresAt : `${expiresAt.replace(' ', 'T')}Z`;
  const time = new Date(iso).getTime();
  return !Number.isNaN(time) && Date.now() > time;
}

export function getDaysUntilExpiration(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  const iso = expiresAt.includes('T') ? expiresAt : `${expiresAt.replace(' ', 'T')}Z`;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  const diffMs = time - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
