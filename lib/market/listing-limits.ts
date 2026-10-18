export const MARKET_MAX_CARD_TYPES = 51;
export const MARKET_MAX_COPIES_PER_CARD = 4;
// A complete One Piece deck has 50 cards plus one Leader. Listings may also
// contain up to four copies of a single card, such as a Leader playset.
export const MARKET_MAX_LISTING_COPIES = 51;

export type ListingLimitItem = { printingId: string; quantity: number };

export function listingLimitViolation(
  items: ListingLimitItem[],
  identityByPrinting: ReadonlyMap<string, string> = new Map(),
): 'too-many-copies' | 'too-many-types' | 'too-many-copies-of-card' | null {
  if (items.reduce((total, item) => total + item.quantity, 0) > MARKET_MAX_LISTING_COPIES) return 'too-many-copies';

  const quantityByIdentity = new Map<string, number>();
  for (const item of items) {
    const identity = identityByPrinting.get(item.printingId) ?? item.printingId;
    quantityByIdentity.set(identity, (quantityByIdentity.get(identity) ?? 0) + item.quantity);
  }
  if (quantityByIdentity.size > MARKET_MAX_CARD_TYPES) return 'too-many-types';
  if ([...quantityByIdentity.values()].some(quantity => quantity > MARKET_MAX_COPIES_PER_CARD)) return 'too-many-copies-of-card';
  return null;
}

export function listingLimitMessage(
  violation: ReturnType<typeof listingLimitViolation>,
  locale: 'EN' | 'ID' = 'EN',
): string {
  if (locale === 'ID') {
    if (violation === 'too-many-types') return `Listing dapat memuat maksimal ${MARKET_MAX_CARD_TYPES} jenis kartu.`;
    if (violation === 'too-many-copies-of-card') return `Maksimal ${MARKET_MAX_COPIES_PER_CARD} salinan untuk setiap kartu.`;
    if (violation === 'too-many-copies') return `Listing dapat memuat maksimal ${MARKET_MAX_LISTING_COPIES} kartu, dengan maksimal ${MARKET_MAX_COPIES_PER_CARD} salinan untuk kartu yang sama.`;
    return '';
  }
  if (violation === 'too-many-types') return `A listing can include up to ${MARKET_MAX_CARD_TYPES} different cards.`;
  if (violation === 'too-many-copies-of-card') return `A listing can include up to ${MARKET_MAX_COPIES_PER_CARD} copies of each card.`;
  if (violation === 'too-many-copies') return `A listing can include up to ${MARKET_MAX_LISTING_COPIES} cards, with no more than ${MARKET_MAX_COPIES_PER_CARD} copies of the same card.`;
  return '';
}
