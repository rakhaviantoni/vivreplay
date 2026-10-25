import { database } from '@/lib/server/database';
import { readPublicEdgeCache, storePublicEdgeCache } from '@/lib/server/public-edge-cache';
import { SETS_CATALOG } from '@/packages/card-data/catalog';
import { isPlayableSet } from '@/packages/domain/release-availability';
import { CARD_CATALOG_CACHE_REVISION } from '@/lib/card-catalog-cache';
import { pokemonLocalCardNumber } from '@/lib/pokemon-set-aliases';
import { pokemonArtRoute } from '@/lib/pokemon-art-route';
import { POKEMON_FEATURED_RARITY_MIN_SCORE, pokemonPrintingRarity, pokemonRarityFallbackScore, pokemonRarityScore } from '@/lib/pokemon-rarity';
import { env } from 'cloudflare:workers';

type Row = { id?:string|null;card_image_url?:string|null;set_code: string | null; set_name: string | null; identity_id: string | null; variant: string | null; release_date?: string | null;description?:string|null;official_url?:string|null;product_image_url?:string|null;series?:string|null;identity_code?:string|null;identity_name?:string|null;identity_color?:string|null;identity_type?:string|null;identity_cost?:number|null;identity_power?:number|null;identity_effect?:string|null;printing_code?:string|null;language?:string|null;rarity?:string|null;matching_language_rarity?:string|null;source_payload?:string|null };
type FeaturedCard = { id:string;code:string;name:string;color:string;type:string;cost:number;power:number;rarity:string;effect:string;imageUrl:string;setCode:string;language:string;printingCode:string;localCardNumber:string;variant:string;gameSlug:'pokemon' };
type SetSummary = { code: string; name: string; releaseYear: number; releaseDate?: string; mainSetTotal: number; parallelsTotal: number;featuredCards?:FeaturedCard[];description?:string;officialUrl?:string;productImageUrl?:string;series?:string };

function rarityCandidates(row:Row){
  const values=[row.rarity,row.matching_language_rarity];
  try{
    const payload=JSON.parse(row.source_payload??'null') as Record<string,unknown>|null;
    if(payload){
      for(const key of ['rarity','rarityName','rarity_code'])if(typeof payload[key]==='string')values.push(payload[key] as string);
      for(const key of ['card','product','printing']){
        const nested=payload[key];
        if(nested&&typeof nested==='object')for(const rarityKey of ['rarity','rarityName','rarity_code']){
          const value=(nested as Record<string,unknown>)[rarityKey];
          if(typeof value==='string')values.push(value);
        }
      }
    }
  }catch{/* Older source payloads may not contain JSON. */}
  return [...new Set(values.filter((value):value is string=>Boolean(value?.trim())))];
}

const rarityCache=new WeakMap<Row,{rarity:string;score:number}>();
function rankedRarity(row:Row){
  const cached=rarityCache.get(row);
  if(cached)return cached;
  let localNumber=row.printing_code;
  try{
    const payload=JSON.parse(row.source_payload??'null') as Record<string,unknown>|null;
    if(typeof payload?.localId==='string'||typeof payload?.collectorNumber==='string')localNumber=String(payload.localId??payload.collectorNumber);
  }catch{/* Use the catalog printing code when source metadata is malformed. */}
  const candidates=rarityCandidates(row).map(value=>{
    const rarity=pokemonPrintingRarity(value,row.language,row.set_code,row.printing_code);
    return {rarity,score:pokemonRarityScore(value,row.language,row.set_code,row.printing_code)};
  }).sort((a,b)=>b.score-a.score);
  const inferred=pokemonPrintingRarity('',row.language,row.set_code,localNumber);
  const inferredScore=pokemonRarityScore(inferred,row.language,row.set_code,localNumber);
  const result=inferredScore>(candidates[0]?.score??0)?{rarity:inferred,score:inferredScore}:candidates[0]??{rarity:'',score:0};
  rarityCache.set(row,result);
  return result;
}

function rarityScore(row:Row){
  const rarity=Math.max(rankedRarity(row).score,pokemonRarityFallbackScore(row.identity_name??'',row.source_payload,row.printing_code));
  const variant=/parallel|alternate|alt.?art|special|_p\d+/i.test(row.variant??'')?5:0;
  const hasImage=Boolean(row.card_image_url);
  return rarity+variant+(hasImage?1:0);
}

function summarize(rows: Row[], gameSlug: string, includeCards=false): SetSummary[] {
  const sets = new Map<string, { code: string; name: string; releaseDate?: string;description?:string;officialUrl?:string;productImageUrl?:string;series?:string; main: Set<string>; parallel: Set<string>;cards:Map<string,{card:FeaturedCard;score:number;highRarity:boolean}> }>();
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
      const card:FeaturedCard={id:row.id,code:row.identity_code,name:row.identity_name,color:row.identity_color??'Colorless',type:row.identity_type??'Character',cost:Number(row.identity_cost??0),power:Number(row.identity_power??0),rarity:rankedRarity(row).rarity,effect:row.identity_effect??'',imageUrl,setCode:code,language:row.language,printingCode:String(row.printing_code??row.identity_code),localCardNumber,variant:row.variant??'Standard',gameSlug:'pokemon'};
      const ranked=rankedRarity(row);
      const score=rarityScore(row);
      const nameKey=row.identity_name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
      const cardKey=nameKey||`${localCardNumber}:${row.identity_code}`;
      const previous=entry.cards.get(cardKey);
      const rarityBackfill=pokemonRarityFallbackScore(row.identity_name??'',row.source_payload,row.printing_code);
      const highRarity=ranked.score>=POKEMON_FEATURED_RARITY_MIN_SCORE||(!ranked.rarity&&rarityBackfill>=68);
      if(!previous||score>previous.score||(score===previous.score&&highRarity&&!previous.highRarity))entry.cards.set(cardKey,{card,score,highRarity});
    }
  }
  const known = new Map(SETS_CATALOG.map(set => [set.code.toUpperCase().replace(/[-_\s]/g, ''), set]));
  return [...sets.values()].map(set => {
    const old = known.get(set.code.toUpperCase().replace(/[-_\s]/g, ''));
    const rankedCards=[...set.cards.values()].sort((a,b)=>b.score-a.score||a.card.name.localeCompare(b.card.name));
    const highRarityCards=rankedCards.filter(item=>item.highRarity);
    const featuredCards=(highRarityCards.length?highRarityCards:rankedCards).slice(0,4).map(item=>item.card);
    return { code: set.code, name: old?.name ?? set.name, releaseYear: old?.releaseYear ?? (Number(set.releaseDate?.slice(0, 4)) || 0), ...(set.releaseDate ? { releaseDate: set.releaseDate } : {}), mainSetTotal: set.main.size, parallelsTotal: set.parallel.size,...(includeCards&&gameSlug==='pokemon'?{featuredCards}:{}),...(set.description?{description:set.description}:{}),...(set.officialUrl?{officialUrl:set.officialUrl}:{}),...(set.productImageUrl?{productImageUrl:set.productImageUrl}:{}),...(set.series?{series:set.series}:{}) };
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
  const includeCards=gameSlug==='pokemon'&&['1','2','3','4','5','6','7','8','9'].includes(params.get('includeCards')??'');
  const language = gameSlug === 'pokemon' && requestedLanguage === 'ALL' ? 'ALL' : requestedLanguage === 'JP' || requestedLanguage === 'JA' ? 'JP' : requestedLanguage === 'ID' ? 'ID' : 'EN';
  const snapshotKey = `catalog-snapshots/sets-${gameSlug}-${language.toLowerCase()}-${CARD_CATALOG_CACHE_REVISION}${includeCards?'-previews-v9':''}.json`;
  try {
    const snapshot = await env.CARD_IMAGES?.get(snapshotKey);
    if (snapshot) return storePublicEdgeCache(request, Response.json(await snapshot.json<{ sets: SetSummary[] }>(), { headers: publicHeaders }));
  } catch { /* Rebuild from the catalog database. */ }
  try {
    const db = database();
    const game = await db.prepare('SELECT id FROM tcg_games WHERE slug=? LIMIT 1').bind(gameSlug).first<{ id: string }>();
    if (!game) return Response.json({ sets: [] }, { headers: publicHeaders });
    const rows = (await db.prepare(`
      SELECT p.id,p.card_image_url,p.set_code,p.set_name,p.identity_id,p.variant,COALESCE(s.release_date,p.release_date) AS release_date
          ,s.description,s.official_url,s.product_image_url,p.printing_code,p.language,p.rarity,p.source_payload,
          (SELECT COALESCE(NULLIF(trim(matching.rarity),''),CASE WHEN json_valid(matching.source_payload) THEN NULLIF(trim(CAST(json_extract(matching.source_payload,'$.rarity') AS TEXT)),'') END)
            FROM tcg_card_printings matching
            WHERE matching.set_code=p.set_code AND matching.printing_code=p.printing_code AND matching.variant=p.variant
              AND matching.language<>p.language
              AND COALESCE(NULLIF(trim(matching.rarity),''),CASE WHEN json_valid(matching.source_payload) THEN NULLIF(trim(CAST(json_extract(matching.source_payload,'$.rarity') AS TEXT)),'') END) IS NOT NULL
              AND lower(trim(COALESCE(NULLIF(matching.rarity,''),CASE WHEN json_valid(matching.source_payload) THEN json_extract(matching.source_payload,'$.rarity') END,''))) NOT IN ('unknown','none','null')
            ORDER BY CASE matching.language WHEN 'JP' THEN 0 WHEN 'EN' THEN 1 WHEN 'ID' THEN 2 ELSE 3 END
            LIMIT 1) AS matching_language_rarity,
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
