import { env } from 'cloudflare:workers';
const imageHosts = new Set(['assets.tcgdex.net']);

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('url');
  if (!requested) return new Response('Not found', { status: 404 });

  let source: URL;
  try { source = new URL(requested); }
  catch { return new Response('Not found', { status: 404 }); }
  const pathSegments = source.pathname.split('/').filter(Boolean);
  if (source.protocol !== 'https:' || !imageHosts.has(source.hostname) || !/^\/[a-z0-9._/-]+\.(png|webp|jpg|jpeg)$/i.test(source.pathname) || pathSegments.some(segment => segment === '.' || segment === '..')) {
    return new Response('Not found', { status: 404 });
  }

  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source.toString()));
  const cacheKey=`catalog-images/pokemon/${Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('')}`;
  try{
    const cached=await env.CARD_IMAGES?.get(cacheKey);
    if(cached)return new Response(cached.body,{headers:{'Content-Type':cached.httpMetadata?.contentType??'image/webp','Cache-Control':'public, max-age=31536000, immutable','Cloudflare-CDN-Cache-Control':'public, max-age=31536000, immutable','ETag':cached.httpEtag,'X-Content-Type-Options':'nosniff'}});
  }catch{}

  let upstream: Response;
  try { upstream = await fetch(source, { headers: { Accept: 'image/avif,image/webp,image/png,image/*' } }); }
  catch { return new Response('Image unavailable', { status: 502 }); }
  const contentType = upstream.headers.get('content-type')?.split(';')[0].toLowerCase() ?? '';
  if (!upstream.ok || !contentType.startsWith('image/')) return new Response('Image unavailable', { status: upstream.ok ? 502 : upstream.status });

  const headers = new Headers({
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
  const length = upstream.headers.get('content-length');
  if (length) headers.set('Content-Length', length);
  if(env.CARD_IMAGES){
    const body=await upstream.clone().arrayBuffer();
    try{await env.CARD_IMAGES.put(cacheKey,body,{httpMetadata:{contentType,cacheControl:'public, max-age=31536000, immutable'}})}catch{}
    return new Response(body,{status:200,headers});
  }
  return new Response(upstream.body, { status: 200, headers });
}
