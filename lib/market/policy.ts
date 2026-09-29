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
    durationDays: 30,
    maxActiveListings: 25,
    canAutoRenew: false,
    commissionPercent: 2,
  },
  pro: {
    tier: 'pro',
    durationDays: 60,
    maxActiveListings: 1000,
    canAutoRenew: true,
    commissionPercent: 1,
  },
};

export function getListingPolicy(tier?: string | null): ListingTierPolicy {
  const normalized = (tier ?? '').trim().toLowerCase();
  if (normalized === 'pro') return LISTING_POLICIES.pro;
  return LISTING_POLICIES.free;
}

export function computeListingExpiration(durationDays: number, fromDate = new Date()): string {
  const expires = new Date(fromDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  // Returns SQLite compatible UTC datetime string 'YYYY-MM-DD HH:MM:SS'
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
