// Change this value after adding or correcting catalog data. The public card
// API uses it in the URL so Cloudflare and browsers stop using the old entry.
export const CARD_CATALOG_CACHE_REVISION = '2026-10-08';

export function versionedCardCatalogUrl(path: string) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}catalogRevision=${CARD_CATALOG_CACHE_REVISION}`;
}
