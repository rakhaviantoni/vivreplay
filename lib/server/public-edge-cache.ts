const EDGE_TTL_SECONDS = 60 * 60 * 24;
const edgeCache = (caches as CacheStorage & { default: Cache }).default;

export async function readPublicEdgeCache(request: Request): Promise<Response | null> {
  try {
    return (await edgeCache.match(request)) ?? null;
  } catch {
    return null;
  }
}

export async function storePublicEdgeCache(request: Request, response: Response): Promise<Response> {
  if (!response.ok) return response;
  try {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', `public, max-age=${EDGE_TTL_SECONDS}, immutable`);
    headers.set('Cloudflare-CDN-Cache-Control', `public, max-age=${EDGE_TTL_SECONDS}`);
    const cachedResponse = new Response(response.clone().body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    await edgeCache.put(request, cachedResponse);
  } catch {
    // The response remains usable when the edge cache is unavailable.
  }
  return response;
}
