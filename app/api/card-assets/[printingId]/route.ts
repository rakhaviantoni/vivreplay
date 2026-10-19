import { env } from 'cloudflare:workers';
import { database } from '@/lib/server/database';

const allowedKinds = new Set(['small']);

async function getObjectKey(printingId: string, kind: string) {
  const row = await database().prepare('SELECT object_key FROM tcg_card_assets WHERE printing_id=? AND kind=? LIMIT 1')
    .bind(printingId, kind).first<{ object_key: string }>();
  return row?.object_key ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ printingId: string }> }) {
  const { printingId } = await params;
  const kind = new URL(request.url).searchParams.get('kind') ?? 'small';
  if (!/^[0-9a-f-]{36}$/i.test(printingId) || !allowedKinds.has(kind)) return new Response('Not found', { status: 404 });
  const objectKey = await getObjectKey(printingId, kind);
  if (!objectKey) return new Response('Not found', { status: 404 });

  const stored = await env.CARD_IMAGES?.get(objectKey);
  if (stored) {
    return new Response(stored.body, { headers: {
      'Content-Type': stored.httpMetadata?.contentType ?? 'image/webp',
      'Cache-Control': stored.httpMetadata?.cacheControl ?? 'public, max-age=31536000, immutable',
      'ETag': stored.httpEtag,
      'X-Content-Type-Options': 'nosniff',
    } });
  }

  return new Response('Image unavailable', { status: env.CARD_IMAGES ? 404 : 503, headers: {'Cache-Control':'no-store'} });
}
