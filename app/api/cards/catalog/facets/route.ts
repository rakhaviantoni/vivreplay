import { database } from '@/lib/server/database';
import { readPublicEdgeCache, storePublicEdgeCache } from '@/lib/server/public-edge-cache';
import { CARD_CATALOG_CACHE_REVISION } from '@/lib/card-catalog-cache';
import { env } from 'cloudflare:workers';

const responseHeaders = {
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
  'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable',
};

export async function GET(request: Request) {
  const cached = await readPublicEdgeCache(request);
  if (cached) return cached;
  const params = new URL(request.url).searchParams;
  const gameSlug = params.get('game')?.toLowerCase() === 'pokemon' ? 'pokemon' : 'one-piece';
  const requestedLanguage = params.get('language')?.toUpperCase();
  const language = requestedLanguage === 'JP' || requestedLanguage === 'JA' ? 'JP' : requestedLanguage === 'ID' ? 'ID' : 'EN';
  const key = `catalog-snapshots/facets-${gameSlug}-${language.toLowerCase()}-${CARD_CATALOG_CACHE_REVISION}.json`;
  try {
    const snapshot = await env.CARD_IMAGES?.get(key);
    if (snapshot) return storePublicEdgeCache(request, Response.json(await snapshot.json(), { headers: responseHeaders }));
  } catch { /* Rebuild the small facet list from D1. */ }
  try {
    const db = database();
    const game = await db.prepare('SELECT id FROM tcg_games WHERE slug=? LIMIT 1').bind(gameSlug).first<{ id: string }>();
    if (!game) return Response.json({ rarities: [] }, { headers: responseHeaders });
    const { results } = await db.prepare(`
      SELECT DISTINCT p.rarity
      FROM tcg_card_printings p
      JOIN tcg_card_identities i ON i.id=p.identity_id
      WHERE i.game_id=? AND p.language=? AND p.rarity IS NOT NULL AND p.rarity!=''
      ORDER BY p.rarity COLLATE NOCASE
    `).bind(game.id, language).all<{ rarity: string }>();
    const illustrators = await db.prepare(`
      SELECT DISTINCT json_extract(p.source_payload, '$.illustrator') AS illustrator
      FROM tcg_card_printings p
      JOIN tcg_card_identities i ON i.id=p.identity_id
      WHERE i.game_id=? AND p.language=? AND json_valid(p.source_payload)
        AND json_type(p.source_payload, '$.illustrator')='text'
        AND trim(json_extract(p.source_payload, '$.illustrator'))!=''
      ORDER BY illustrator COLLATE NOCASE
    `).bind(game.id, language).all<{ illustrator: string }>();
    const body = { rarities: results.map(row => row.rarity), illustrators: illustrators.results.map(row => row.illustrator) };
    try { await env.CARD_IMAGES?.put(key, JSON.stringify(body), { httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'public, max-age=86400' } }); }
    catch { /* Keep the facet list available when snapshots cannot be written. */ }
    return storePublicEdgeCache(request, Response.json(body, { headers: responseHeaders }));
  } catch {
    return Response.json({ error: 'Card filters are temporarily unavailable.' }, { status: 503 });
  }
}
