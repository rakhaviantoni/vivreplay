export type ListingBoostPlanId = '24h' | '3d' | '7d';

export interface ListingBoostPlan {
  id: ListingBoostPlanId;
  days: number;
  amount: number;
  proAmount: number;
  labelEn: string;
  labelId: string;
  descriptionEn: string;
  descriptionId: string;
}

export const MARKET_PRO_MONTHLY_BOOST_CREDITS = 2;
export const MARKET_PRO_ANNUAL_BOOST_CREDITS_PER_MONTH = 4;

export const LISTING_BOOST_PLANS: Record<ListingBoostPlanId, ListingBoostPlan> = {
  '24h': {
    id: '24h',
    days: 1,
    amount: 4_000,
    proAmount: 2_000,
    labelEn: '24-Hour Flash Boost',
    labelId: 'Sorotan Kilat 24 Jam',
    descriptionEn: 'Quick top-of-feed push for ending auctions or weekend drops.',
    descriptionId: 'Dorongan cepat di bagian atas feed untuk lelang atau drop akhir pekan.',
  },
  '3d': {
    id: '3d',
    days: 3,
    amount: 8_000,
    proAmount: 4_000,
    labelEn: '3-Day Spotlight',
    labelId: 'Sorotan 3 Hari',
    descriptionEn: 'Pinned near the top of the Market feed with a Featured badge for 3 days.',
    descriptionId: 'Diprioritaskan di bagian atas feed Market dengan lencana Unggulan selama 3 hari.',
  },
  '7d': {
    id: '7d',
    days: 7,
    amount: 15_000,
    proAmount: 7_500,
    labelEn: '7-Day Spotlight',
    labelId: 'Sorotan 7 Hari',
    descriptionEn: 'Full-week Featured placement for high-value cards, slabs, and collectibles.',
    descriptionId: 'Penempatan Unggulan seminggu penuh untuk kartu, slab, dan koleksi bernilai tinggi.',
  },
};

export function getBoostPlanAmount(planId: ListingBoostPlanId, isPro: boolean, isAnnual = false): number {
  const plan = LISTING_BOOST_PLANS[planId];
  if (!isPro) return plan.amount;
  return isAnnual ? Math.round(plan.amount * 0.4) : plan.proAmount;
}

export function isListingBoosted(boostedUntil?: string | null, nowMs: number = Date.now()): boolean {
  if (!boostedUntil) return false;
  const parsed = Date.parse(boostedUntil);
  return Number.isFinite(parsed) && parsed > nowMs;
}
