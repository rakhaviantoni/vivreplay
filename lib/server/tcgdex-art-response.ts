import { env } from 'cloudflare:workers';

const cacheHeaders = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
};

export async function tcgdexArtResponse(value: string) {
  let source: URL;
  try { source = new URL(value); }
  catch { return new Response('Not found', { status: 404 }); }
  if (source.protocol !== 'https:' || source.hostname !== 'assets.tcgdex.net' || !/^\/[a-z0-9._/-]+\.(?:png|webp|jpe?g)$/i.test(source.pathname) || source.pathname.split('/').some(part => part === '.' || part === '..')) {
    return new Response('Not found', { status: 404 });
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source.toString()));
  const cacheKey = `catalog-images/pokemon/${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  try {
    const cached = await env.CARD_IMAGES?.get(cacheKey);
    if (cached) return new Response(cached.body, { headers: { ...cacheHeaders, 'Content-Type': cached.httpMetadata?.contentType ?? 'image/webp', ETag: cached.httpEtag } });
  } catch { /* Use the source if the cache is unavailable. */ }

  let upstream: Response;
  try { upstream = await fetch(source, { headers: { Accept: 'image/avif,image/webp,image/png,image/*' } }); }
  catch { return new Response('Image unavailable', { status: 502 }); }
  const contentType = upstream.headers.get('content-type')?.split(';')[0].toLowerCase() ?? '';
  if (!upstream.ok || !contentType.startsWith('image/')) return new Response('Image unavailable', { status: upstream.ok ? 502 : upstream.status });

  const headers = new Headers({ ...cacheHeaders, 'Content-Type': contentType });
  const length = upstream.headers.get('content-length');
  if (length) headers.set('Content-Length', length);
  if (!env.CARD_IMAGES) return new Response(upstream.body, { status: 200, headers });

  const body = await upstream.arrayBuffer();
  try { await env.CARD_IMAGES.put(cacheKey, body, { httpMetadata: { contentType, cacheControl: cacheHeaders['Cache-Control'] } }); }
  catch { /* Keep serving the image if R2 is unavailable. */ }
  return new Response(body, { status: 200, headers });
}
