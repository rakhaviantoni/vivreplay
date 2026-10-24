// Change this value after adding or correcting catalog data. The public card
// API uses it in the URL so Cloudflare and browsers stop using the old entry.
// Bump this after catalog imports or corrections. Card and set snapshots are
// immutable at the edge, so changing the revision is what exposes new D1 rows.
export const CARD_CATALOG_CACHE_REVISION = '20261024000000003';

export function versionedCardCatalogUrl(path: string) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}catalogRevision=${CARD_CATALOG_CACHE_REVISION}`;
}
