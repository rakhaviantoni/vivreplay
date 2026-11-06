// Change this value after adding or correcting catalog data. The public card
// API uses it in the URL so Cloudflare and browsers stop using the old entry.
// Bump this after catalog imports or corrections. Card and set snapshots are
// immutable at the edge, so changing the revision is what exposes new D1 rows.
export const CARD_CATALOG_CACHE_REVISION = '20261105083634854';

export function versionedCardImageUrl(path: string): string;
export function versionedCardImageUrl(path: string | null | undefined): string | null | undefined;
export function versionedCardImageUrl(path: null): null;
export function versionedCardImageUrl(path: undefined): undefined;
export function versionedCardImageUrl(path: string | null | undefined): string | null | undefined {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return path ?? null;
  const url = new URL(path, 'https://vivreplay.com');
  url.searchParams.set('catalogRevision', CARD_CATALOG_CACHE_REVISION);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function versionedCardCatalogUrl(path: string) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}catalogRevision=${CARD_CATALOG_CACHE_REVISION}`;
}
