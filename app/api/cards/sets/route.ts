import { database } from '@/lib/server/database';
import { readPublicEdgeCache, storePublicEdgeCache } from '@/lib/server/public-edge-cache';
import { SETS_CATALOG } from '@/packages/card-data/catalog';
import { isPlayableSet } from '@/packages/domain/release-availability';
import { CARD_CATALOG_CACHE_REVISION } from '@/lib/card-catalog-cache';
import { env } from 'cloudflare:workers';

type Row = { set_code: string | null; set_name: string | null; identity_id: string | null; variant: string | null; release_date?: string | null;description?:string|null;official_url?:string|null;product_image_url?:string|null;series?:string|null };
type SetSummary = { code: string; name: string; releaseYear: number; releaseDate?: string; mainSetTotal: number; parallelsTotal: number;description?:string;officialUrl?:string;productImageUrl?:string;series?:string };

function summarize(rows: Row[], gameSlug: string): SetSummary[] {
  const sets = new Map<string, { code: string; name: string; releaseDate?: string;description?:string;officialUrl?:string;productImageUrl?:string;series?:string; main: Set<string>; parallel: Set<string> }>();
  for (const row of rows) {
    const rawCode = String(row.set_code ?? '').trim();
    const code = rawCode.toUpperCase().replace(/[-_\s]/g, '')==='OP15'?'OP15-EB04':rawCode;
    const identity = String(row.identity_id ?? '');
    if (!code || !identity || (gameSlug === 'one-piece' && !isPlayableSet(code))) continue;
    const key = code.toUpperCase().replace(/[-_\s]/g, '');
    let entry = sets.get(key);
    if (!entry) {
      entry = { code, name: rawCode.toUpperCase().replace(/[-_\s]/g, '')==='OP15'?"Adventure on Kami's Island":String(row.set_name ?? code), releaseDate: row.release_date ?? undefined,description:row.description??undefined,officialUrl:row.official_url??undefined,productImageUrl:row.product_image_url??undefined,series:row.series??undefined, main: new Set(), parallel: new Set() };
      sets.set(key, entry);
    }
    if(rawCode.toUpperCase().replace(/[-_\s]/g, '')==='OP15')entry.name="Adventure on Kami's Island";
    if (!entry.releaseDate && row.release_date) entry.releaseDate = row.release_date;
    const isParallel = /parallel|manga|alt/i.test(String(row.variant ?? ''));
    (isParallel ? entry.parallel : entry.main).add(identity);
  }
  const known = new Map(SETS_CATALOG.map(set => [set.code.toUpperCase().replace(/[-_\s]/g, ''), set]));
  return [...sets.values()].map(set => {
    const old = known.get(set.code.toUpperCase().replace(/[-_\s]/g, ''));
    return { code: set.code, name: old?.name ?? set.name, releaseYear: old?.releaseYear ?? (Number(set.releaseDate?.slice(0, 4)) || 0), ...(set.releaseDate ? { releaseDate: set.releaseDate } : {}), mainSetTotal: set.main.size, parallelsTotal: set.parallel.size,...(set.description?{description:set.description}:{}),...(set.officialUrl?{officialUrl:set.officialUrl}:{}),...(set.productImageUrl?{productImageUrl:set.productImageUrl}:{}),...(set.series?{series:set.series}:{}) };
  }).sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || b.code.localeCompare(a.code, undefined, { numeric: true }));
}

const publicHeaders = {
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
  const snapshotKey = `catalog-snapshots/sets-${gameSlug}-${language.toLowerCase()}-${CARD_CATALOG_CACHE_REVISION}.json`;
  try {
    const snapshot = await env.CARD_IMAGES?.get(snapshotKey);
    if (snapshot) return storePublicEdgeCache(request, Response.json(await snapshot.json<{ sets: SetSummary[] }>(), { headers: publicHeaders }));
  } catch { /* Rebuild from the catalog database. */ }
  try {
    const db = database();
    const game = await db.prepare('SELECT id FROM tcg_games WHERE slug=? LIMIT 1').bind(gameSlug).first<{ id: string }>();
    if (!game) return Response.json({ sets: [] }, { headers: publicHeaders });
    const rows = (await db.prepare(`
        SELECT p.set_code,p.set_name,p.identity_id,p.variant,COALESCE(s.release_date,p.release_date) AS release_date
          ,s.description,s.official_url,s.product_image_url,
          CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.set.serie.name') ELSE NULL END AS series
        FROM tcg_card_printings p
        JOIN tcg_card_identities i ON i.id=p.identity_id
        LEFT JOIN tcg_sets s ON s.id=p.set_id
        WHERE p.identity_id IS NOT NULL AND p.language=? AND i.game_id=?
      `).bind(language, game.id).all<Row>()).results;
    const sets = summarize(rows, gameSlug);
    try { await env.CARD_IMAGES?.put(snapshotKey, JSON.stringify({ sets }), { httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'public, max-age=86400' } }); }
    catch { /* Keep serving the catalog if snapshot storage is unavailable. */ }
    return storePublicEdgeCache(request, Response.json({ sets }, { headers: publicHeaders }));
  } catch {
    return Response.json({ error: 'Set progress is temporarily unavailable.' }, { status: 503 });
  }
}
