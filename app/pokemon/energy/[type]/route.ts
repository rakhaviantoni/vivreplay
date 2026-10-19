import { env } from 'cloudflare:workers';

const energyTypes = new Set(['Colorless','Grass','Fire','Water','Lightning','Psychic','Fighting','Darkness','Metal','Dragon','Fairy']);

export async function GET(_request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type: rawType } = await params;
  const type = [...energyTypes].find(value => value.toLowerCase() === rawType.toLowerCase());
  if (!type) return new Response('Not found', { status: 404 });
  const key = `pokemon/energy-symbols/${type.toLowerCase()}.webp`;
  try {
    const cached = await env.CARD_IMAGES?.get(key);
    if (cached) return new Response(cached.body, { headers: { 'Content-Type': cached.httpMetadata?.contentType ?? 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
    const upstream = await fetch(`https://www.pokepedia.id/elements/${type}.webp`, { headers: { Accept: 'image/avif,image/webp,image/*', 'User-Agent': 'VivrePlay catalog image cache' }, signal: AbortSignal.timeout(9000) });
    const contentType = upstream.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    if (!upstream.ok || !contentType.startsWith('image/')) return new Response('Image unavailable', { status: 404 });
    const image = await upstream.arrayBuffer();
    if (!image.byteLength || image.byteLength > 1_000_000) return new Response('Image unavailable', { status: 404 });
    await env.CARD_IMAGES?.put(key, image, { httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' } });
    return new Response(image, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return new Response('Image unavailable', { status: 404 });
  }
}
