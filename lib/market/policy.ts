export type AccountTier = 'free' | 'pro';

export interface ListingTierPolicy {
  tier: AccountTier;
  durationDays: number;
  maxActiveListings: number;
  canAutoRenew: boolean;
  commissionPercent: number;
}

export interface MarketPolicies extends Record<AccountTier, ListingTierPolicy> {
  buyerFeeMinimum: number;
  sellerFeeMinimum: number;
  shippingVoucherMinSubtotal: number;
}

export const MARKET_BUYER_FEE_MINIMUM = 2_000;
export const MARKET_SELLER_FEE_MINIMUM = 1_000;

export const LISTING_POLICIES: MarketPolicies = {
  free: {
    tier: 'free',
    durationDays: 7,
    maxActiveListings: 25,
    canAutoRenew: false,
    commissionPercent: 1.5,
  },
  pro: {
    tier: 'pro',
    durationDays: 30,
    maxActiveListings: 2500,
    canAutoRenew: true,
    commissionPercent: 0.75,
  },
  buyerFeeMinimum: MARKET_BUYER_FEE_MINIMUM,
  sellerFeeMinimum: MARKET_SELLER_FEE_MINIMUM,
  shippingVoucherMinSubtotal: 500_000,
};

export const MARKET_BUYER_FEE_PERCENT = LISTING_POLICIES.free.commissionPercent;
export const MARKET_PRO_BUYER_FEE_PERCENT = LISTING_POLICIES.pro.commissionPercent;
export const MARKET_BUYER_FEE_CAP_BANDS = [
  { maxSubtotal: 5_000_000, cap: 75_000 },
  { maxSubtotal: 10_000_000, cap: 150_000 },
  { maxSubtotal: 20_000_000, cap: 300_000 },
  { maxSubtotal: 50_000_000, cap: 500_000 },
  { maxSubtotal: 100_000_000, cap: 750_000 },
  { maxSubtotal: 250_000_000, cap: 1_000_000 },
  { maxSubtotal: Number.POSITIVE_INFINITY, cap: 1_500_000 },
] as const;
export const MARKET_BUYER_FEE_CAP = MARKET_BUYER_FEE_CAP_BANDS.at(-1)!.cap;
export const MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH = 2;
export const MARKET_PRO_SHIPPING_VOUCHERS_PER_YEAR = MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH * 12;
export const MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL = 500_000;
export const MARKET_PRO_SHIPPING_VOUCHER_SHARE = 0.5;
export const MARKET_PRO_SHIPPING_VOUCHER_CAP = 5_000;

export function getMarketBuyerFeeCap(subtotal: number): number {
  const safeSubtotal = Math.max(0, subtotal);
  return MARKET_BUYER_FEE_CAP_BANDS.find(band => safeSubtotal <= band.maxSubtotal)?.cap ?? MARKET_BUYER_FEE_CAP;
}

export function calculateBuyerServiceFee(subtotal: number, percent: number, minimum = MARKET_BUYER_FEE_MINIMUM): number {
  const safeSubtotal = Math.max(0, subtotal);
  if (!safeSubtotal) return 0;
  return Math.min(Math.max(Math.round(safeSubtotal * Math.max(0, percent) / 100), Math.max(0, minimum)), getMarketBuyerFeeCap(safeSubtotal));
}

export function calculateSellerServiceFee(subtotal: number, percent: number, minimum = MARKET_SELLER_FEE_MINIMUM): number {
  const safeSubtotal = Math.max(0, subtotal);
  if (!safeSubtotal) return 0;
  return Math.min(safeSubtotal, Math.max(Math.round(safeSubtotal * Math.max(0, percent) / 100), Math.max(0, minimum)));
}

export function parseMarketPolicies(rawJson: string | null | undefined): MarketPolicies {
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
      buyerFeeMinimum: Number.isSafeInteger(parsed.buyerFeeMinimum) ? Math.max(0, Math.min(100_000, parsed.buyerFeeMinimum)) : LISTING_POLICIES.buyerFeeMinimum,
      sellerFeeMinimum: Number.isSafeInteger(parsed.sellerFeeMinimum) ? Math.max(0, Math.min(100_000, parsed.sellerFeeMinimum)) : LISTING_POLICIES.sellerFeeMinimum,
      shippingVoucherMinSubtotal: Number.isSafeInteger(parsed.shippingVoucherMinSubtotal) ? Math.max(0, Math.min(100_000_000, parsed.shippingVoucherMinSubtotal)) : LISTING_POLICIES.shippingVoucherMinSubtotal,
    };
  } catch {
    return LISTING_POLICIES;
  }
}

export async function fetchMarketPolicies(db: any): Promise<MarketPolicies> {
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
