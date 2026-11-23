export type AuctionDurationMode = 'FIXED' | 'ROLLING_24H' | 'ROLLING_48H';
export type AuctionStatus = 'ACTIVE' | 'ENDED' | 'CANCELLED';

export interface AuctionSummary {
  listingId: string;
  sellerId: string;
  startingBid: number;
  buyNowPrice?: number | null;
  minIncrement: number;
  currentBid: number;
  highestBidderId: string | null;
  highestBidderName: string | null;
  bidCount: number;
  durationMode: AuctionDurationMode;
  endsAt: string;
  status: AuctionStatus;
  winnerOrderId?: string | null;
}

export interface AuctionBidRecord {
  id: string;
  listingId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  createdAt: string;
}

export const AUCTION_DURATION_MODES: readonly AuctionDurationMode[] = [
  'ROLLING_24H',
  'ROLLING_48H',
  'FIXED',
] as const;

export const AUCTION_DEFAULT_MIN_INCREMENT = 10_000;
export const AUCTION_MAX_BID_AMOUNT = 100_000_000_000;
export const AUCTION_MIN_FIXED_HOURS = 1;
export const AUCTION_MAX_FIXED_HOURS = 168; // 7 days
export const AUCTION_MIN_FIXED_MS = 60 * 60 * 1000;
export const AUCTION_MAX_FIXED_MS = 30 * 24 * 60 * 60 * 1000;

export function validateFixedAuctionEndsAt(
  fixedEndsAt: string,
  nowMs: number = Date.now(),
): { ok: true; endsAtMs: number } | { ok: false; error: string } {
  const parsed = Date.parse(fixedEndsAt);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: 'Choose a valid end date and time.' };
  }
  if (parsed < nowMs + AUCTION_MIN_FIXED_MS) {
    return { ok: false, error: 'Auction end time must be at least 1 hour from now.' };
  }
  if (parsed > nowMs + AUCTION_MAX_FIXED_MS) {
    return { ok: false, error: 'Auction end time cannot exceed 30 days from now.' };
  }
  return { ok: true, endsAtMs: parsed };
}

export function computeInitialAuctionEndsAtMs(
  durationMode: AuctionDurationMode,
  nowMs: number,
  fixedHours?: number,
  fixedEndsAt?: string,
): number {
  if (durationMode === 'ROLLING_24H') {
    return nowMs + 24 * 60 * 60 * 1000;
  }
  if (durationMode === 'ROLLING_48H') {
    return nowMs + 48 * 60 * 60 * 1000;
  }
  if (fixedEndsAt) {
    const parsed = Date.parse(fixedEndsAt);
    if (Number.isFinite(parsed)) {
      return Math.min(nowMs + AUCTION_MAX_FIXED_MS, Math.max(nowMs + AUCTION_MIN_FIXED_MS, parsed));
    }
  }
  const hours = Math.min(
    AUCTION_MAX_FIXED_HOURS,
    Math.max(AUCTION_MIN_FIXED_HOURS, Math.round(Number(fixedHours) || 24)),
  );
  return nowMs + hours * 60 * 60 * 1000;
}

export function computeNextAuctionEndsAtMs(
  durationMode: AuctionDurationMode,
  nowMs: number,
  currentEndsAtMs: number,
): number {
  if (durationMode === 'ROLLING_24H') {
    return nowMs + 24 * 60 * 60 * 1000;
  }
  if (durationMode === 'ROLLING_48H') {
    return nowMs + 48 * 60 * 60 * 1000;
  }
  return currentEndsAtMs;
}

export function computeMinimumNextBid(params: {
  startingBid: number;
  currentBid: number;
  minIncrement: number;
  bidCount: number;
}): number {
  if (params.bidCount <= 0 || params.currentBid <= 0) {
    return Math.max(1_000, Math.round(params.startingBid));
  }
  return Math.round(params.currentBid) + Math.max(1_000, Math.round(params.minIncrement));
}

export function validateAuctionBid(params: {
  sellerId: string;
  bidderId: string;
  status: AuctionStatus;
  endsAtMs: number;
  nowMs: number;
  startingBid: number;
  currentBid: number;
  minIncrement: number;
  bidCount: number;
  highestBidderId: string | null;
  amount: number;
}): { ok: true; minimumBid: number } | { ok: false; status: number; error: string } {
  if (params.status !== 'ACTIVE') {
    return { ok: false, status: 409, error: 'This auction has already ended.' };
  }
  if (!Number.isFinite(params.endsAtMs) || params.nowMs >= params.endsAtMs) {
    return { ok: false, status: 409, error: 'This auction has already ended.' };
  }
  if (params.bidderId === params.sellerId) {
    return { ok: false, status: 400, error: 'You cannot bid on your own auction.' };
  }
  if (params.highestBidderId && params.bidderId === params.highestBidderId) {
    return { ok: false, status: 409, error: 'You already hold the highest bid.' };
  }
  const amount = Math.round(Number(params.amount));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > AUCTION_MAX_BID_AMOUNT) {
    return { ok: false, status: 400, error: 'Enter a valid bid amount.' };
  }
  const minimumBid = computeMinimumNextBid(params);
  if (amount < minimumBid) {
    return {
      ok: false,
      status: 400,
      error: `Minimum bid is Rp ${minimumBid.toLocaleString('id-ID')}.`,
    };
  }
  return { ok: true, minimumBid };
}

export function formatAuctionDurationLabel(
  mode: AuctionDurationMode,
  locale: 'EN' | 'ID' = 'EN',
): string {
  if (mode === 'ROLLING_24H') {
    return locale === 'ID' ? '24 jam setelah bid terakhir' : '24h after last bid';
  }
  if (mode === 'ROLLING_48H') {
    return locale === 'ID' ? '48 jam setelah bid terakhir' : '48h after last bid';
  }
  return locale === 'ID' ? 'Waktu akhir tetap' : 'Fixed end time';
}
