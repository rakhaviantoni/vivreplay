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
    if (!game) return Response.json({ rarities: [], illustrators: [], types: [], categories: [], stages: [], attackEnergies: [], regulations: [], retreats: [], weaknesses: [], resistances: [] }, { headers: responseHeaders });
    const { results } = await db.prepare(`
      SELECT DISTINCT p.rarity
      FROM tcg_card_printings p
      JOIN tcg_card_identities i ON i.id=p.identity_id
      WHERE i.game_id=? AND p.language=? AND p.rarity IS NOT NULL AND trim(p.rarity)!=''
        AND LOWER(trim(p.rarity)) NOT IN ('unknown','none','null')
      ORDER BY p.rarity COLLATE NOCASE
    `).bind(game.id, language).all<{ rarity: string }>();
    const illustrators = await db.prepare(`
      SELECT DISTINCT trim(json_extract(p.source_payload, '$.illustrator')) AS illustrator
      FROM tcg_card_printings p
      JOIN tcg_card_identities i ON i.id=p.identity_id
      WHERE i.game_id=? AND p.language=? AND json_valid(p.source_payload)
        AND json_type(p.source_payload, '$.illustrator')='text'
        AND trim(json_extract(p.source_payload, '$.illustrator'))!=''
      ORDER BY illustrator COLLATE NOCASE
    `).bind(game.id, language).all<{ illustrator: string }>();
    const types = await db.prepare(`
      SELECT DISTINCT trim(t.value) AS type
      FROM tcg_card_printings p
      JOIN tcg_card_identities i ON i.id=p.identity_id
      JOIN json_each(p.source_payload, '$.types') t
      WHERE i.game_id=? AND p.language=? AND json_valid(p.source_payload)
        AND json_type(p.source_payload, '$.types')='array'
        AND trim(t.value)!=''
      ORDER BY type COLLATE NOCASE
    `).bind(game.id, language).all<{ type: string }>();
    const categories = await db.prepare(`
      SELECT DISTINCT trim(json_extract(p.source_payload, '$.category')) AS category
      FROM tcg_card_printings p
      JOIN tcg_card_identities i ON i.id=p.identity_id
      WHERE i.game_id=? AND p.language=? AND json_valid(p.source_payload)
        AND json_type(p.source_payload, '$.category')='text'
        AND trim(json_extract(p.source_payload, '$.category'))!=''
      ORDER BY category COLLATE NOCASE
    `).bind(game.id, language).all<{ category: string }>();
    const stages = await db.prepare(`
      SELECT DISTINCT trim(json_extract(p.source_payload, '$.stage')) AS stage
      FROM tcg_card_printings p
      JOIN tcg_card_identities i ON i.id=p.identity_id
      WHERE i.game_id=? AND p.language=? AND json_valid(p.source_payload)
        AND json_type(p.source_payload, '$.stage')='text'
        AND trim(json_extract(p.source_payload, '$.stage'))!=''
      ORDER BY stage COLLATE NOCASE
    `).bind(game.id, language).all<{ stage: string }>();
    const attackEnergies = await db.prepare(`
      SELECT DISTINCT trim(energy.value) AS energy
      FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id
      JOIN json_each(p.source_payload, '$.attacks') attack JOIN json_each(attack.value, '$.cost') energy
      WHERE i.game_id=? AND p.language=? AND json_valid(p.source_payload)
      ORDER BY energy COLLATE NOCASE
    `).bind(game.id, language).all<{ energy: string }>();
    const regulations = await db.prepare(`
      SELECT DISTINCT trim(json_extract(p.source_payload, '$.regulationMark')) AS regulation
      FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id
      WHERE i.game_id=? AND p.language=? AND json_valid(p.source_payload)
        AND json_type(p.source_payload, '$.regulationMark')='text'
      ORDER BY regulation COLLATE NOCASE
    `).bind(game.id, language).all<{ regulation: string }>();
    const retreats = await db.prepare(`
      SELECT DISTINCT CAST(json_extract(p.source_payload, '$.retreat') AS INTEGER) AS retreat
      FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id
      WHERE i.game_id=? AND p.language=? AND json_valid(p.source_payload)
        AND json_type(p.source_payload, '$.retreat') IN ('integer','real')
      ORDER BY retreat
    `).bind(game.id, language).all<{ retreat: number }>();
    const weaknesses = await db.prepare(`
      SELECT DISTINCT trim(json_extract(weakness.value, '$.type')) AS type
      FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id
      JOIN json_each(p.source_payload, '$.weaknesses') weakness
      WHERE i.game_id=? AND p.language=? AND json_valid(p.source_payload)
      ORDER BY type COLLATE NOCASE
    `).bind(game.id, language).all<{ type: string }>();
    const resistances = await db.prepare(`
      SELECT DISTINCT trim(json_extract(resistance.value, '$.type')) AS type
      FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id
      JOIN json_each(p.source_payload, '$.resistances') resistance
      WHERE i.game_id=? AND p.language=? AND json_valid(p.source_payload)
      ORDER BY type COLLATE NOCASE
    `).bind(game.id, language).all<{ type: string }>();
    const body = {
      rarities: results.map(row => row.rarity),
      illustrators: illustrators.results.map(row => row.illustrator),
      types: types.results.map(row => row.type),
      categories: categories.results.map(row => row.category),
      stages: stages.results.map(row => row.stage),
      attackEnergies: attackEnergies.results.map(row => row.energy),
      regulations: regulations.results.map(row => row.regulation),
      retreats: retreats.results.map(row => String(row.retreat)),
      weaknesses: weaknesses.results.map(row => row.type),
      resistances: resistances.results.map(row => row.type),
    };
    try { await env.CARD_IMAGES?.put(key, JSON.stringify(body), { httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'public, max-age=86400' } }); }
    catch { /* Keep the facet list available when snapshots cannot be written. */ }
    return storePublicEdgeCache(request, Response.json(body, { headers: responseHeaders }));
  } catch {
    return Response.json({ error: 'Card filters are temporarily unavailable.' }, { status: 503 });
  }
}
