export type ListingBoostPlanId = '3d' | '7d';

export interface ListingBoostPlan {
  id: ListingBoostPlanId;
  days: number;
  amount: number;
  labelEn: string;
  labelId: string;
  descriptionEn: string;
  descriptionId: string;
}

export const LISTING_BOOST_PLANS: Record<ListingBoostPlanId, ListingBoostPlan> = {
  '3d': {
    id: '3d',
    days: 3,
    amount: 15_000,
    labelEn: '3-Day Spotlight',
    labelId: 'Sorotan 3 Hari',
    descriptionEn: 'Pinned near the top of the Market feed with a Featured badge for 3 days.',
    descriptionId: 'Diprioritaskan di bagian atas feed Market dengan lencana Unggulan selama 3 hari.',
  },
  '7d': {
    id: '7d',
    days: 7,
    amount: 29_000,
    labelEn: '7-Day Spotlight',
    labelId: 'Sorotan 7 Hari',
    descriptionEn: 'Best value for high-ticket cards, slabs, figures, and auctions for a full week.',
    descriptionId: 'Paling hemat untuk kartu mahal, slab, figur, dan lelang selama seminggu penuh.',
  },
};

export function isListingBoosted(boostedUntil?: string | null, nowMs: number = Date.now()): boolean {
  if (!boostedUntil) return false;
  const parsed = Date.parse(boostedUntil);
  return Number.isFinite(parsed) && parsed > nowMs;
}
