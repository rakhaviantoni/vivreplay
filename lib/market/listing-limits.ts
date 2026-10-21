export type ListingBundleLimits = {maxListingCopies:number;maxCopiesPerCard:number;maxCardTypes:number};
export const MARKET_MAX_CARD_TYPES = 51;
export const MARKET_MAX_COPIES_PER_CARD = 4;
// A complete One Piece deck has 50 cards plus one Leader. Listings may also
// contain up to four copies of a single card, such as a Leader playset.
export const MARKET_MAX_LISTING_COPIES = 51;
export const MARKET_ABSOLUTE_MAX_LISTING_COPIES = 100;
export const DEFAULT_LISTING_BUNDLE_LIMITS:ListingBundleLimits={maxListingCopies:MARKET_MAX_LISTING_COPIES,maxCopiesPerCard:MARKET_MAX_COPIES_PER_CARD,maxCardTypes:MARKET_MAX_CARD_TYPES};

export type ListingLimitItem = { printingId: string; quantity: number };

export function listingLimitViolation(
  items: ListingLimitItem[],
  identityByPrinting: ReadonlyMap<string, string> = new Map(),
  limits: ListingBundleLimits = DEFAULT_LISTING_BUNDLE_LIMITS,
): 'too-many-copies' | 'too-many-types' | 'too-many-copies-of-card' | null {
  if (items.reduce((total, item) => total + item.quantity, 0) > limits.maxListingCopies) return 'too-many-copies';

  const quantityByIdentity = new Map<string, number>();
  for (const item of items) {
    const identity = identityByPrinting.get(item.printingId) ?? item.printingId;
    quantityByIdentity.set(identity, (quantityByIdentity.get(identity) ?? 0) + item.quantity);
  }
  if (quantityByIdentity.size > limits.maxCardTypes) return 'too-many-types';
  if ([...quantityByIdentity.values()].some(quantity => quantity > limits.maxCopiesPerCard)) return 'too-many-copies-of-card';
  return null;
}

export function listingLimitMessage(
  violation: ReturnType<typeof listingLimitViolation>,
  locale: 'EN' | 'ID' = 'EN',
  limits: ListingBundleLimits = DEFAULT_LISTING_BUNDLE_LIMITS,
): string {
  if (locale === 'ID') {
    if (violation === 'too-many-types') return `Listing dapat memuat maksimal ${limits.maxCardTypes} jenis kartu.`;
    if (violation === 'too-many-copies-of-card') return `Maksimal ${limits.maxCopiesPerCard} salinan untuk setiap kartu.`;
    if (violation === 'too-many-copies') return `Listing dapat memuat maksimal ${limits.maxListingCopies} kartu, dengan maksimal ${limits.maxCopiesPerCard} salinan untuk kartu yang sama.`;
    return '';
  }
  if (violation === 'too-many-types') return `A listing can include up to ${limits.maxCardTypes} different cards.`;
  if (violation === 'too-many-copies-of-card') return `A listing can include up to ${limits.maxCopiesPerCard} copies of each card.`;
  if (violation === 'too-many-copies') return `A listing can include up to ${limits.maxListingCopies} cards, with no more than ${limits.maxCopiesPerCard} copies of the same card.`;
  return '';
}
