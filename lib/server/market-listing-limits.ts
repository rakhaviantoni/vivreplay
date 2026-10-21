import {HttpError, type db} from './store';
import {listingLimitMessage, listingLimitViolation, type ListingLimitItem} from '@/lib/market/listing-limits';
import type {ListingTierPolicy} from '@/lib/market/policy';

export async function enforceMarketListingLimits(database: ReturnType<typeof db>, items: ListingLimitItem[], policy?:ListingTierPolicy) {
  const printingIds = [...new Set(items.map(item => item.printingId))];
  if (!printingIds.length) throw new HttpError(400, 'Add at least one card to this listing.');
  const placeholders = printingIds.map(() => '?').join(',');
  const rows = await database.prepare(`SELECT id,identity_id AS identityId FROM card_printings WHERE id IN (${placeholders})`)
    .bind(...printingIds).all<{id: string; identityId: string}>();
  const identityByPrinting = new Map((rows.results ?? []).map(row => [row.id, row.identityId]));
  if (identityByPrinting.size !== printingIds.length) {
    throw new HttpError(400, 'One or more selected cards are no longer available. Refresh the catalog and try again.');
  }
  const limits=policy??{maxListingCopies:51,maxCopiesPerCard:4,maxCardTypes:51};
  const violation = listingLimitViolation(items, identityByPrinting, limits);
  if (violation) throw new HttpError(400, listingLimitMessage(violation,'EN',limits));
}
