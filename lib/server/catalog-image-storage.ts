import { env } from 'cloudflare:workers';

/** Prefer the current catalog art; keep user uploads and local cache writes isolated. */
export async function getCatalogImageObject(key: string) {
  const catalog = await env.CATALOG_IMAGES?.get(key).catch(() => null);
  if (catalog) return catalog;
  return env.CARD_IMAGES?.get(key).catch(() => null) ?? null;
}
