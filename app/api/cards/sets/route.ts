import { database } from '@/lib/server/database';
import { readPublicEdgeCache, storePublicEdgeCache } from '@/lib/server/public-edge-cache';
import { SETS_CATALOG } from '@/packages/card-data/catalog';
import { isPlayableSet } from '@/packages/domain/release-availability';
import { CARD_CATALOG_CACHE_REVISION } from '@/lib/card-catalog-cache';
import { pokemonLocalCardNumber } from '@/lib/pokemon-set-aliases';
import { pokemonArtRoute } from '@/lib/pokemon-art-route';
import { pokemonPrintingRarity } from '@/lib/pokemon-rarity';
import { env } from 'cloudflare:workers';

type Row = { id?:string|null;set_code: string | null; set_name: string | null; identity_id: string | null; variant: string | null; release_date?: string | null;description?:string|null;official_url?:string|null;product_image_url?:string|null;series?:string|null;identity_code?:string|null;identity_name?:string|null;identity_color?:string|null;identity_type?:string|null;identity_cost?:number|null;identity_power?:number|null;identity_effect?:string|null;printing_code?:string|null;language?:string|null;rarity?:string|null;source_payload?:string|null };
type FeaturedCard = { id:string;code:string;name:string;color:string;type:string;cost:number;power:number;rarity:string;effect:string;imageUrl:string;setCode:string;language:string;printingCode:string;localCardNumber:string;variant:string;gameSlug:'pokemon' };
type SetSummary = { code: string; name: string; releaseYear: number; releaseDate?: string; mainSetTotal: number; parallelsTotal: number;featuredCards?:FeaturedCard[];description?:string;officialUrl?:string;productImageUrl?:string;series?:string };

function rarityScore(row:Row){
  const rarity=pokemonPrintingRarity(row.rarity,row.language,row.set_code,row.printing_code).toUpperCase().replace(/[^A-Z]/g,'');
  const score:Record<string,number>={SAR:100,SIR:100,SEC:96,UR:93,HR:91,SSR:88,SR:82,IR:78,AR:78,PR:70,RRR:68,ACE:64,RR:56,R:42,PROMO:40,U:25,C:10};
  const variant=/parallel|alternate|alt.?art|special|_p\d+/i.test(row.variant??'')?4:0;
  return (score[rarity]??0)+variant;
}

function summarize(rows: Row[], gameSlug: string, includeCards=false): SetSummary[] {
  const sets = new Map<string, { code: string; name: string; releaseDate?: string;description?:string;officialUrl?:string;productImageUrl?:string;series?:string; main: Set<string>; parallel: Set<string>;cards:Map<string,{card:FeaturedCard;score:number}> }>();
  for (const row of rows) {
    const rawCode = String(row.set_code ?? '').trim();
    const code = rawCode.toUpperCase().replace(/[-_\s]/g, '')==='OP15'?'OP15-EB04':rawCode;
    const identity = String(row.identity_id ?? '');
    if (!code || !identity || (gameSlug === 'one-piece' && !isPlayableSet(code))) continue;
    const key = code.toUpperCase().replace(/[-_\s]/g, '');
    let entry = sets.get(key);
    if (!entry) {
      entry = { code, name: rawCode.toUpperCase().replace(/[-_\s]/g, '')==='OP15'?"Adventure on Kami's Island":String(row.set_name ?? code), releaseDate: row.release_date ?? undefined,description:row.description??undefined,officialUrl:row.official_url??undefined,productImageUrl:row.product_image_url??undefined,series:row.series??undefined, main: new Set(), parallel: new Set(),cards:new Map() };
      sets.set(key, entry);
    }
    if(rawCode.toUpperCase().replace(/[-_\s]/g, '')==='OP15')entry.name="Adventure on Kami's Island";
    if (!entry.releaseDate && row.release_date) entry.releaseDate = row.release_date;
    const isParallel = /parallel|manga|alt/i.test(String(row.variant ?? ''));
    (isParallel ? entry.parallel : entry.main).add(identity);
    if(includeCards&&gameSlug==='pokemon'&&row.id&&row.identity_code&&row.identity_name&&row.language){
      const localCardNumber=pokemonLocalCardNumber(row.source_payload,String(row.printing_code??row.identity_code));
      const imageUrl=pokemonArtRoute(row.language,code,localCardNumber,row.id);
      const card:FeaturedCard={id:row.id,code:row.identity_code,name:row.identity_name,color:row.identity_color??'Colorless',type:row.identity_type??'Character',cost:Number(row.identity_cost??0),power:Number(row.identity_power??0),rarity:row.rarity??'',effect:row.identity_effect??'',imageUrl,setCode:code,language:row.language,printingCode:String(row.printing_code??row.identity_code),localCardNumber,variant:row.variant??'Standard',gameSlug:'pokemon'};
      const score=rarityScore(row);
      const previous=entry.cards.get(row.identity_code);
      if(!previous||score>previous.score)entry.cards.set(row.identity_code,{card,score});
    }
  }
  const known = new Map(SETS_CATALOG.map(set => [set.code.toUpperCase().replace(/[-_\s]/g, ''), set]));
  return [...sets.values()].map(set => {
    const old = known.get(set.code.toUpperCase().replace(/[-_\s]/g, ''));
    return { code: set.code, name: old?.name ?? set.name, releaseYear: old?.releaseYear ?? (Number(set.releaseDate?.slice(0, 4)) || 0), ...(set.releaseDate ? { releaseDate: set.releaseDate } : {}), mainSetTotal: set.main.size, parallelsTotal: set.parallel.size,...(includeCards&&gameSlug==='pokemon'?{featuredCards:[...set.cards.values()].sort((a,b)=>b.score-a.score||a.card.name.localeCompare(b.card.name)).slice(0,4).map(item=>item.card)}:{}),...(set.description?{description:set.description}:{}),...(set.officialUrl?{officialUrl:set.officialUrl}:{}),...(set.productImageUrl?{productImageUrl:set.productImageUrl}:{}),...(set.series?{series:set.series}:{}) };
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
  const includeCards=gameSlug==='pokemon'&&['1','2'].includes(params.get('includeCards')??'');
  const language = gameSlug === 'pokemon' && requestedLanguage === 'ALL' ? 'ALL' : requestedLanguage === 'JP' || requestedLanguage === 'JA' ? 'JP' : requestedLanguage === 'ID' ? 'ID' : 'EN';
  const snapshotKey = `catalog-snapshots/sets-${gameSlug}-${language.toLowerCase()}-${CARD_CATALOG_CACHE_REVISION}${includeCards?'-previews-v2':''}.json`;
  try {
    const snapshot = await env.CARD_IMAGES?.get(snapshotKey);
    if (snapshot) return storePublicEdgeCache(request, Response.json(await snapshot.json<{ sets: SetSummary[] }>(), { headers: publicHeaders }));
  } catch { /* Rebuild from the catalog database. */ }
  try {
    const db = database();
    const game = await db.prepare('SELECT id FROM tcg_games WHERE slug=? LIMIT 1').bind(gameSlug).first<{ id: string }>();
    if (!game) return Response.json({ sets: [] }, { headers: publicHeaders });
    const rows = (await db.prepare(`
      SELECT p.id,p.set_code,p.set_name,p.identity_id,p.variant,COALESCE(s.release_date,p.release_date) AS release_date
          ,s.description,s.official_url,s.product_image_url,p.printing_code,p.language,p.rarity,p.source_payload,
          i.code AS identity_code,COALESCE(l.name,i.name) AS identity_name,i.color AS identity_color,i.card_type AS identity_type,i.cost AS identity_cost,i.power AS identity_power,COALESCE(l.effect_text,i.effect_text) AS identity_effect,
          CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.set.serie.name') ELSE NULL END AS series
        FROM tcg_card_printings p
        JOIN tcg_card_identities i ON i.id=p.identity_id
        LEFT JOIN tcg_card_localizations l ON l.identity_id=i.id AND l.language=p.language
        LEFT JOIN tcg_sets s ON s.id=p.set_id
        WHERE p.identity_id IS NOT NULL AND i.game_id=?${language === 'ALL' ? '' : ' AND p.language=?'}
      `).bind(...(language === 'ALL' ? [game.id] : [game.id, language])).all<Row>()).results;
    const sets = summarize(rows, gameSlug,includeCards);
    try { await env.CARD_IMAGES?.put(snapshotKey, JSON.stringify({ sets }), { httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'public, max-age=86400' } }); }
    catch { /* Keep serving the catalog if snapshot storage is unavailable. */ }
    return storePublicEdgeCache(request, Response.json({ sets }, { headers: publicHeaders }));
  } catch {
    return Response.json({ error: 'Set progress is temporarily unavailable.' }, { status: 503 });
  }
}
