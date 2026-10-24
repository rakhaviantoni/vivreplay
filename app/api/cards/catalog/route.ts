import { database } from '@/lib/server/database';
import { readPublicEdgeCache, storePublicEdgeCache } from '@/lib/server/public-edge-cache';
import { isPlayableSet, PREVIEW_CARD_CODES } from '@/packages/domain/release-availability';
import { CARD_CATALOG_CACHE_REVISION } from '@/lib/card-catalog-cache';
import { parseCatalogRange } from '@/lib/card-catalog-query';
import { pokemonPrintingRarity } from '@/lib/pokemon-rarity';
import { pokemonArtRoute } from '@/lib/pokemon-art-route';
import {pokemonLocalCardNumber,pokemonSetFilter} from '@/lib/pokemon-set-aliases';
import { env } from 'cloudflare:workers';

function publicCardPath(objectKey: string, setCode = '', language = 'EN', printingCode = '', printingId = '', localCardNumber = printingCode) {
  if (objectKey.startsWith('/')) return objectKey;
  if (objectKey.startsWith('one-piece/')) {
    const match = objectKey.match(/^one-piece\/([^/]+)\/([^/]+)\/(?:small\/|thumb\/|large\/)?(.+)$/);
    return match ? `/${encodeURIComponent(match[1].replaceAll('-', ''))}/${encodeURIComponent(match[2].toLowerCase())}/${match[3].split('/').map(encodeURIComponent).join('/')}` : '';
  }
  if (objectKey.startsWith('http')) {
    try {
      const source = new URL(objectKey);
      const segments = source.pathname.split('/').filter(Boolean);
      const [folder, sourceLanguage, ...parts] = segments;
      const filename = parts.at(-1);
      if (source.hostname === 'assets.tcgdex.net' && source.protocol === 'https:' && source.pathname.startsWith('/')) {
        return pokemonArtRoute(language, setCode, localCardNumber, printingId);
      }
      if (source.hostname === 'cardtell.id' && source.protocol === 'https:' && /^\/images\/products\/[0-9]{1,12}\.png$/i.test(source.pathname)) {
        return pokemonArtRoute(language, setCode, localCardNumber, printingId);
      }
      if (source.hostname === 'cards.oplaytcg.com' && folder && sourceLanguage && filename && folder.toLowerCase() !== 'tcg' && !filename.toLowerCase().startsWith('tcg-')) {
        return `/${encodeURIComponent(folder)}/${encodeURIComponent(sourceLanguage.toLowerCase())}/${encodeURIComponent(filename)}`;
      }
    } catch { /* Use the catalog printing details below. */ }
  }
  const normalizedSet = setCode.replaceAll('-', '');
  return normalizedSet && printingCode
    ? `/${encodeURIComponent(normalizedSet)}/${encodeURIComponent(language.toLowerCase())}/${encodeURIComponent(printingCode)}.webp`
    : '';
}

function parseJson(value: unknown) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

type PokemonSearchAlias={dexId:string;suffix:string};
async function pokemonSearchAliases(query:string):Promise<PokemonSearchAlias[]>{
  const terms=[...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[])];
  if(!terms.length)return [];
  const game=await database().prepare("SELECT id FROM tcg_games WHERE slug='pokemon' LIMIT 1").first<{id:string}>();
  if(!game)return [];
  const expression=terms.map(term=>`"${term.replaceAll('"','""')}"`).join(' AND ');
  const result=await database().prepare("SELECT DISTINCT p.source_payload FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id WHERE p.language='EN' AND i.game_id=? AND i.id IN (SELECT identity_id FROM tcg_card_identity_search WHERE tcg_card_identity_search MATCH ?) LIMIT 300").bind(game.id,expression).all<{source_payload:string}>();
  const aliases=new Map<string,PokemonSearchAlias>();
  for(const row of result.results){
    const payload=parseJson(row.source_payload) as Record<string,unknown>|undefined;
    if(!payload||typeof payload!=='object')continue;
    const rawIds=Array.isArray(payload.dexId)?payload.dexId:[payload.dexId];
    const suffix=String(payload.suffix??'').trim().toUpperCase();
    for(const rawId of rawIds){const dexId=String(rawId??'').trim();if(/^\d{1,4}$/.test(dexId))aliases.set(`${dexId}:${suffix}`,{dexId,suffix});}
  }
  return [...aliases.values()].slice(0,50);
}

function pokemonCollectorRawIdSql(printingAlias: string) {
  const payloadValue = (key: string) => `CASE WHEN json_valid(${printingAlias}.source_payload) THEN json_extract(${printingAlias}.source_payload,'$.${key}') END`;
  return `COALESCE(NULLIF(trim(${payloadValue('localId')}),''),NULLIF(trim(${payloadValue('collectorNumber')}),''),${printingAlias}.printing_code)`;
}

function pokemonCollectorNumberSql(printingAlias: string) {
  const rawId = pokemonCollectorRawIdSql(printingAlias);
  return `UPPER(trim(CASE WHEN instr(CAST(${rawId} AS TEXT),'/')>0 THEN substr(CAST(${rawId} AS TEXT),1,instr(CAST(${rawId} AS TEXT),'/')-1) ELSE CAST(${rawId} AS TEXT) END))`;
}

function pokemonCollectorDenominatorSql(printingAlias: string) {
  const rawId = pokemonCollectorRawIdSql(printingAlias);
  const payloadValue = (key: string) => `CASE WHEN json_valid(${printingAlias}.source_payload) THEN json_extract(${printingAlias}.source_payload,'$.${key}') END`;
  return `UPPER(trim(CASE WHEN instr(CAST(${rawId} AS TEXT),'/')>0 THEN substr(CAST(${rawId} AS TEXT),instr(CAST(${rawId} AS TEXT),'/')+1) ELSE COALESCE(${payloadValue('set.cardCount.official')},${payloadValue('set.cardCount.total')},'') END))`;
}

function pokemonPrintingCompletenessSql(printingAlias: string, identityAlias: string) {
  const payloadValue = (key: string) => `CASE WHEN json_valid(${printingAlias}.source_payload) THEN json_extract(${printingAlias}.source_payload,'$.${key}') END`;
  const hasValue = (expression: string) => `CASE WHEN ${expression} IS NOT NULL AND trim(CAST(${expression} AS TEXT)) NOT IN ('','[]','{}','null') THEN 1 ELSE 0 END`;
  const hasArray = (key: string) => `CASE WHEN json_valid(${printingAlias}.source_payload) THEN CASE WHEN json_type(${printingAlias}.source_payload,'$.${key}')='array' AND json_array_length(${printingAlias}.source_payload,'$.${key}')>0 THEN 1 ELSE 0 END ELSE 0 END`;
  return [
    `${hasValue(`COALESCE(NULLIF(trim(${printingAlias}.rarity),''),NULLIF(trim(CAST(${payloadValue('rarity')} AS TEXT)),''))`)}*16`,
    `${hasValue(payloadValue('regulationMark'))}*8`,
    `${hasValue(payloadValue('hp'))}*8`,
    `${hasArray('types')}*4`,
    `${hasValue(payloadValue('stage'))}*5`,
    `${hasArray('attacks')}*12`,
    `${hasArray('abilities')}*10`,
    `${hasArray('weaknesses')}*6`,
    `${hasArray('resistances')}*6`,
    `${hasValue(payloadValue('retreat'))}*4`,
    `${hasValue(`COALESCE(${payloadValue('evolvesFrom')},${payloadValue('evolveFrom')})`)}*4`,
    `${hasValue(`${identityAlias}.effect_text`)}*3`,
    `${hasValue(`${printingAlias}.card_image_url`)}*2`,
  ].join('+');
}

async function fromD1(gameSlug: string, language: string, identityCode?: string, setCodes: string[] = [], limit?: number, offset = 0, printingIds?: string[],identityCodes?:string[],identityIds?:string[],query?:string,rarities:string[] = [],illustrators:string[] = [],types:string[] = [],categories:string[] = [],stages:string[] = [],sort='latest',missingImages=false,attackEnergies:string[]=[],regulations:string[]=[],minHp?:number,maxHp?:number,retreats:string[]=[],weaknesses:string[]=[],resistances:string[]=[],illustratorQuery?:string,pokemonAliases:PokemonSearchAlias[] = []) {
  const db = database();
  const selectedGame = await db.prepare('SELECT id FROM tcg_games WHERE slug=? LIMIT 1').bind(gameSlug).first<{ id: string }>();
  if (!selectedGame) return [];
  const predicates = ['i.game_id=?'];
  const values: (string | number)[] = [selectedGame.id];
  // Imports can contain a sparse Cardtell row alongside a richer row for the
  // same physical printing. Compare collector numbers from the source payload
  // because Cardtell's internal CT- IDs do not match the printed number.
  if (gameSlug === 'pokemon' && !printingIds?.length) {
    const currentCollectorNumber = pokemonCollectorNumberSql('p');
    const duplicateCollectorNumber = pokemonCollectorNumberSql('duplicate');
    const currentCollectorDenominator = pokemonCollectorDenominatorSql('p');
    const duplicateCollectorDenominator = pokemonCollectorDenominatorSql('duplicate');
    const currentCompleteness = pokemonPrintingCompletenessSql('p', 'i');
    const duplicateCompleteness = pokemonPrintingCompletenessSql('duplicate', 'duplicate_identity');
    predicates.push(`NOT EXISTS (
      SELECT 1
      FROM tcg_card_printings duplicate
      JOIN tcg_card_identities duplicate_identity ON duplicate_identity.id=duplicate.identity_id
      LEFT JOIN tcg_card_localizations duplicate_localization
        ON duplicate_localization.identity_id=duplicate_identity.id
        AND duplicate_localization.language=duplicate.language
      WHERE duplicate.id<>p.id
        AND duplicate_identity.game_id=i.game_id
        AND duplicate.language=p.language
        AND duplicate.set_code=p.set_code
        AND ${duplicateCollectorNumber}<>''
        AND ${duplicateCollectorNumber}=${currentCollectorNumber}
        AND ${duplicateCollectorDenominator}=${currentCollectorDenominator}
        AND LOWER(TRIM(COALESCE(duplicate_localization.name,duplicate_identity.name,'')))
          =LOWER(TRIM(COALESCE(l.name,i.name,'')))
        AND LOWER(TRIM(COALESCE(duplicate.variant,'')))=LOWER(TRIM(COALESCE(p.variant,'')))
        AND (
          (${duplicateCompleteness})>(${currentCompleteness})
          OR ((${duplicateCompleteness})=(${currentCompleteness}) AND (
            CASE duplicate.source_kind WHEN 'tcgdex' THEN 0 WHEN 'cardtell' THEN 1 ELSE 2 END
              < CASE p.source_kind WHEN 'tcgdex' THEN 0 WHEN 'cardtell' THEN 1 ELSE 2 END
            OR (duplicate.source_kind=p.source_kind AND duplicate.id<p.id)
          ))
        )
    )`);
  }
  if (!printingIds?.length && language !== 'ALL') { predicates.push('p.language=?'); values.push(language); }
  if (printingIds?.length) { predicates.push(`p.id IN (${printingIds.map(()=>'?').join(',')})`); values.push(...printingIds); }
  if(identityCodes?.length){predicates.push(`i.code IN (${identityCodes.map(()=>'?').join(',')})`);values.push(...identityCodes)}
  if(identityIds?.length){predicates.push(`i.id IN (${identityIds.map(()=>'?').join(',')})`);values.push(...identityIds)}
  if (identityCode) {
    const identity = await db.prepare('SELECT id FROM tcg_card_identities WHERE game_id=? AND code=? LIMIT 1')
      .bind(selectedGame.id, identityCode).first<{ id: string }>();
    if (!identity) return [];
    predicates.push('p.identity_id=?');
    values.push(identity.id);
  }
  if (setCodes.length) {
    // Set codes have historically been imported as both OP15 and OP-15 (and
    // EB01 / EB-01). Match their canonical form so a route or deep link never
    // loses cards just because one import used punctuation.
    if(gameSlug==='pokemon'){
      const filter=pokemonSetFilter(setCodes);
      predicates.push(filter.sql);
      values.push(...filter.values);
    }else{
    const setPredicates = setCodes.map(setCode => {
      const normalizedSet=setCode.toUpperCase().replace(/[-_\s]/g, '');
      values.push(normalizedSet,normalizedSet,normalizedSet);
      return "(UPPER(REPLACE(REPLACE(REPLACE(p.set_code,'-',''),'_',''),' ',''))=? OR (? LIKE 'OP%' AND UPPER(REPLACE(REPLACE(REPLACE(p.set_code,'-',''),'_',''),' ','')) LIKE ? || 'EB%'))";
    });
    predicates.push(`(${setPredicates.join(' OR ')})`);
    }
  }
  const queryTerms = query ? [...new Set(query.split(/\s+/).map(term=>term.trim()).filter(Boolean))] : [];
  if (queryTerms.length) {
    const searchableFields = ["LOWER(COALESCE(i.name,''))", "LOWER(COALESCE(l.name,''))", "LOWER(COALESCE(i.code,''))", "LOWER(COALESCE(p.printing_code,''))", "LOWER(COALESCE(p.set_code,''))", "LOWER(COALESCE(p.set_name,''))", "LOWER(COALESCE(p.rarity,''))", "LOWER(COALESCE(p.source_payload,''))", "LOWER(COALESCE(i.card_type,''))", "LOWER(COALESCE(i.color,''))", "LOWER(COALESCE(i.effect_text,''))", "CAST(COALESCE(i.cost,0) AS TEXT)", "CAST(COALESCE(i.power,0) AS TEXT)"];
    for (const term of queryTerms) {
      predicates.push(`(${searchableFields.map(field=>`${field} LIKE ?`).join(' OR ')})`);
      values.push(...searchableFields.map(()=>`%${term}%`));
    }
  }
  if(gameSlug==='pokemon'&&pokemonAliases.length){
    const alternatives=pokemonAliases.map(()=>`(EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(p.source_payload) THEN p.source_payload ELSE '{}' END,'$.dexId') dex WHERE CAST(dex.value AS TEXT)=?) AND UPPER(COALESCE(json_extract(p.source_payload,'$.suffix'),''))=?)`);
    predicates.push(`(${alternatives.join(' OR ')})`);
    for(const alias of pokemonAliases)values.push(alias.dexId,alias.suffix);
  }
  if (rarities.length) { predicates.push(`LOWER(p.rarity) IN (${rarities.map(()=>'?').join(',')})`); values.push(...rarities.map(value=>value.toLocaleLowerCase())); }
  if (illustrators.length) { predicates.push(`LOWER(trim(json_extract(p.source_payload, '$.illustrator'))) IN (${illustrators.map(()=>'?').join(',')})`); values.push(...illustrators.map(value=>value.toLocaleLowerCase())); }
  if (illustratorQuery) { predicates.push("LOWER(COALESCE(json_extract(p.source_payload, '$.illustrator'),'')) LIKE ?"); values.push(`%${illustratorQuery.toLocaleLowerCase()}%`); }
  if (types.length) { predicates.push(`EXISTS (SELECT 1 FROM json_each(p.source_payload, '$.types') pokemon_type WHERE LOWER(pokemon_type.value) IN (${types.map(()=>'?').join(',')}))`); values.push(...types.map(value=>value.toLocaleLowerCase())); }
  if (categories.length) { predicates.push(`LOWER(json_extract(p.source_payload, '$.category')) IN (${categories.map(()=>'?').join(',')})`); values.push(...categories.map(value=>value.toLocaleLowerCase())); }
  if (stages.length) { predicates.push(`LOWER(json_extract(p.source_payload, '$.stage')) IN (${stages.map(()=>'?').join(',')})`); values.push(...stages.map(value=>value.toLocaleLowerCase())); }
  if (attackEnergies.length) { predicates.push(`EXISTS (SELECT 1 FROM json_each(p.source_payload, '$.attacks') attack JOIN json_each(attack.value, '$.cost') energy WHERE LOWER(energy.value) IN (${attackEnergies.map(()=>'?').join(',')}))`); values.push(...attackEnergies.map(value=>value.toLocaleLowerCase())); }
  if (regulations.length) { predicates.push(`UPPER(json_extract(p.source_payload, '$.regulationMark')) IN (${regulations.map(()=>'?').join(',')})`); values.push(...regulations.map(value=>value.toUpperCase())); }
  if (minHp !== undefined) { predicates.push('CAST(json_extract(p.source_payload, \'$.hp\') AS INTEGER)>=?'); values.push(minHp); }
  if (maxHp !== undefined) { predicates.push('CAST(json_extract(p.source_payload, \'$.hp\') AS INTEGER)<=?'); values.push(maxHp); }
  if (retreats.length) { predicates.push(`CAST(json_extract(p.source_payload, '$.retreat') AS INTEGER) IN (${retreats.map(()=>'?').join(',')})`); values.push(...retreats.map(Number)); }
  if (weaknesses.length) { predicates.push(`EXISTS (SELECT 1 FROM json_each(p.source_payload, '$.weaknesses') weakness WHERE UPPER(json_extract(weakness.value, '$.type')) IN (${weaknesses.map(()=>'?').join(',')}))`); values.push(...weaknesses.map(value=>value.toUpperCase())); }
  if (resistances.length) { predicates.push(`EXISTS (SELECT 1 FROM json_each(p.source_payload, '$.resistances') resistance WHERE UPPER(json_extract(resistance.value, '$.type')) IN (${resistances.map(()=>'?').join(',')}))`); values.push(...resistances.map(value=>value.toUpperCase())); }
  if (missingImages) predicates.push("NULLIF(p.card_image_url,'') IS NULL AND NULLIF(a.object_key,'') IS NULL");
  const pagination = limit ? 'LIMIT ? OFFSET ?' : '';
  const relevance = queryTerms.length ? queryTerms.map(()=>"CASE WHEN LOWER(COALESCE(l.name,i.name,'')) LIKE ? THEN 0 ELSE 1 END").join('+') : '';
  const orderBy = sort === 'name'
    ? `COALESCE(l.name,i.name) COLLATE NOCASE,p.set_code,p.printing_code,p.id`
    : sort === 'rarity'
      ? `CASE LOWER(p.rarity) WHEN 'hyper rare' THEN 120 WHEN 'special illustration rare' THEN 110 WHEN 'ace spec rare' THEN 105 WHEN 'illustration rare' THEN 100 WHEN 'ultra rare' THEN 90 WHEN 'amazing rare' THEN 80 WHEN 'radiant rare' THEN 78 WHEN 'double rare' THEN 70 WHEN 'rare holo' THEN 60 WHEN 'rare holo ex' THEN 58 WHEN 'rare' THEN 50 WHEN 'uncommon' THEN 30 WHEN 'common' THEN 10 ELSE 0 END DESC,COALESCE(s.release_date,'') DESC,p.set_code,p.printing_code,p.id`
      : sort === 'hp'
        ? `COALESCE(CAST(json_extract(p.source_payload, '$.hp') AS INTEGER),0) DESC,COALESCE(s.release_date,'') DESC,p.set_code,p.printing_code,p.id`
        : sort === 'number'
          ? `COALESCE(s.release_date,'') DESC,p.set_code,CAST(p.printing_code AS INTEGER),p.printing_code,p.id`
          : `COALESCE(s.release_date,'') DESC,p.set_code DESC,p.printing_code,p.id`;
  const rankedOrderBy = relevance ? `${relevance},${orderBy}` : orderBy;
  if (queryTerms.length) values.push(...queryTerms.map(term=>`%${term}%`));
  if (limit) values.push(limit, offset);
  const { results } = await db.prepare(`
    SELECT p.id,
      CASE
        WHEN NULLIF(trim(p.rarity),'') IS NOT NULL AND lower(trim(p.rarity)) NOT IN ('unknown','none','null') THEN p.rarity
        ELSE (
          SELECT NULLIF(trim(other.rarity),'')
          FROM tcg_card_printings other
          WHERE other.identity_id=p.identity_id
            AND other.set_id=p.set_id
            AND other.printing_code=p.printing_code
            AND other.variant=p.variant
            AND NULLIF(trim(other.rarity),'') IS NOT NULL
            AND lower(trim(other.rarity)) NOT IN ('unknown','none','null')
          ORDER BY CASE other.language WHEN 'JP' THEN 0 WHEN 'EN' THEN 1 ELSE 2 END
          LIMIT 1
        )
      END AS rarity,
      p.variant,p.set_code,p.set_name,p.printing_code,p.language,
      p.attribute,p.counter_amount,p.sub_types,p.source_payload,
      COALESCE(NULLIF(a.object_key,''), NULLIF(p.card_image_url,'')) AS image_key,
      i.id AS identity_id,i.code AS identity_code,i.name AS identity_name,
      i.color AS identity_color,i.card_type AS identity_type,i.cost AS identity_cost,
      i.power AS identity_power,i.effect_text AS identity_effect,
      l.name AS localized_name,l.effect_text AS localized_effect
    FROM tcg_card_printings p
    JOIN tcg_card_identities i ON i.id=p.identity_id
    LEFT JOIN tcg_card_localizations l ON l.identity_id=i.id AND l.language=p.language
    LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small'
    LEFT JOIN tcg_sets s ON s.id=p.set_id
    WHERE ${predicates.join(' AND ')}
    ORDER BY ${rankedOrderBy}
    ${pagination}
  `).bind(...values).all<Record<string, unknown>>();
  return results.flatMap(row => {
    const identity = {
      id: row.identity_id, code: row.identity_code,
      name: row.localized_name || row.identity_name,
      color: row.identity_color, card_type: row.identity_type,
      cost: row.identity_cost, power: row.identity_power,
      effect_text: row.localized_effect || row.identity_effect,
    };
    const code = String(identity.code ?? '').toUpperCase();
    const setCode = String(row.set_code ?? '');
    if (gameSlug === 'one-piece' && !isPlayableSet(setCode) && !PREVIEW_CARD_CODES.has(code) && row.variant !== 'Preview') return [];
    const imageKey = String(row.image_key ?? '');
    const printingCode = String(row.printing_code || identity.code || '');
    const sourcePayload=parseJson(row.source_payload);
    const localCardNumber=gameSlug==='pokemon'?pokemonLocalCardNumber(sourcePayload,printingCode):printingCode;
    const imageUrl = !imageKey
      ? gameSlug === 'pokemon'
        ? pokemonArtRoute(String(row.language??language),setCode,localCardNumber,String(row.id??''))
        : null
      : publicCardPath(imageKey, setCode, String(row.language??language), printingCode, String(row.id ?? ''), localCardNumber) || null;
    const rarity = gameSlug === 'pokemon'
      ? pokemonPrintingRarity(String(row.rarity ?? ''), String(row.language ?? language), setCode, printingCode)
      : row.rarity;
    return [{
      id: row.id,identity_id:row.identity_id, rarity, variant: row.variant,
      set_code: row.set_code, set_name: row.set_name,
      printing_code: row.printing_code || identity.code,
      language: row.language, attribute: row.attribute,
      counter_amount: row.counter_amount,
      sub_types: parseJson(row.sub_types),
      source_payload: parseJson(row.source_payload),
      card_image_url: imageUrl,
      tcg_card_assets: imageKey && !imageKey.startsWith('http') ? [{ kind: 'small', object_key: imageKey }] : [],
      tcg_card_identities: identity,
    }];
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  // Image repair queues need the live asset state after a batch attaches R2
  // objects. Serving an older cached gap list makes fixed printings reappear.
  const liveImageAudit = params.get('missingImages') === '1' && params.get('game') === 'pokemon';
  if (!liveImageAudit) {
    const cached = await readPublicEdgeCache(request);
    if (cached) return cached;
  }
  const rawIds=params.get('ids');
  const printingIds=rawIds===null?undefined:[...new Set(rawIds.split(',').map(value=>value.trim()).filter(Boolean))];
  if(printingIds?.length===0||printingIds&&printingIds.length>500)return Response.json({error:'Choose up to 500 printings.'},{status:400});
  const rawCodes=params.get('codes');
  const identityCodes=rawCodes===null?undefined:[...new Set(rawCodes.split(',').map(value=>value.trim().toUpperCase()).filter(value=>/^[A-Z0-9_-]{2,40}$/.test(value)))];
  if(identityCodes?.length===0||identityCodes&&identityCodes.length>100)return Response.json({error:'Choose up to 100 card codes.'},{status:400});
  const rawIdentityIds=params.get('identityIds');
  const identityIds=rawIdentityIds===null?undefined:[...new Set(rawIdentityIds.split(',').map(value=>value.trim()).filter(Boolean))];
  if(identityIds?.length===0||identityIds&&identityIds.length>100)return Response.json({error:'Choose up to 100 card identities.'},{status:400});
  const gameSlug = params.get('game')?.toLowerCase() === 'pokemon' ? 'pokemon' : 'one-piece';
  const requestedLanguage = params.get('language')?.toUpperCase();
  const language = requestedLanguage === 'ALL' ? 'ALL' : requestedLanguage === 'JP' || requestedLanguage === 'JA' ? 'JP' : requestedLanguage === 'ID' ? 'ID' : 'EN';
  const rawCode = params.get('code')?.trim().toUpperCase();
  const identityCode = rawCode && /^[A-Z0-9-]{1,32}$/.test(rawCode) ? rawCode : undefined;
  const setCodes = [...new Set(params.getAll('set').map(value=>value.trim()).filter(value=>/^[A-Za-z0-9_-]{1,24}$/.test(value)).map(value=>gameSlug === 'pokemon' ? value : value.toUpperCase()))];
  if(setCodes.length>25)return Response.json({error:'Choose up to 25 sets.'},{status:400});
  const rawLimit = Number(params.get('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(500, Math.floor(rawLimit)) : undefined;
  const rawOffset = Number(params.get('offset'));
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.min(100_000, Math.floor(rawOffset)) : 0;
  const rawQuery = params.get('q')?.trim().slice(0, 100).toLocaleLowerCase();
  const query = rawQuery && rawQuery.length >= 2 ? rawQuery : undefined;
  const rarities = [...new Set(params.getAll('rarity').map(value=>value.trim().slice(0,40)).filter(value=>/^[\p{L}\p{N} .+'-]+$/u.test(value)))];
  if(rarities.length>30)return Response.json({error:'Choose up to 30 rarities.'},{status:400});
  const illustrators = [...new Set(params.getAll('illustrator').map(value=>value.trim().slice(0,80)).filter(value=>/^[\p{L}\p{N} .,'&()_-]+$/u.test(value)))];
  if(illustrators.length>50)return Response.json({error:'Choose up to 50 illustrators.'},{status:400});
  const types = [...new Set(params.getAll('type').map(value=>value.trim().slice(0,30)).filter(value=>/^[\p{L}\p{N} .'-]+$/u.test(value)))];
  const categories = [...new Set(params.getAll('category').map(value=>value.trim().slice(0,30)).filter(value=>/^[\p{L}\p{N} .'-]+$/u.test(value)))];
  const stages = [...new Set(params.getAll('stage').map(value=>value.trim().slice(0,30)).filter(value=>/^[\p{L}\p{N} .'-]+$/u.test(value)))];
  const attackEnergies = [...new Set(params.getAll('attackEnergy').map(value=>value.trim().slice(0,20)).filter(value=>/^[\p{L} -]+$/u.test(value)))];
  const regulations = [...new Set(params.getAll('regulation').map(value=>value.trim().slice(0,4).toUpperCase()).filter(value=>/^[A-Z]$/.test(value)))];
  const rangeValue=(key:string)=>parseCatalogRange(params.get(key));
  const minHp=rangeValue('minHp'),maxHp=rangeValue('maxHp');
  const retreats = [...new Set(params.getAll('retreat').map(value=>value.trim()).filter(value=>/^[0-6]$/.test(value)))];
  const weaknesses = [...new Set(params.getAll('weakness').map(value=>value.trim().slice(0,20)).filter(value=>/^[\p{L} -]+$/u.test(value)))];
  const resistances = [...new Set(params.getAll('resistance').map(value=>value.trim().slice(0,20)).filter(value=>/^[\p{L} -]+$/u.test(value)))];
  const illustratorQueryRaw=params.get('illustratorQ')?.trim().slice(0,80);
  const illustratorQuery=illustratorQueryRaw&&illustratorQueryRaw.length>=2?illustratorQueryRaw:undefined;
  const requestedSort = params.get('sort') ?? 'latest';
  const sort = ['latest','name','number','rarity','hp'].includes(requestedSort) ? requestedSort : 'latest';
  const missingImages = params.get('missingImages') === '1' && gameSlug === 'pokemon' && ['ID','JP','ALL'].includes(language);
  const resultLimit = missingImages ? Math.min(limit ?? 250, 250) : limit;
  const snapshotKey = `catalog-snapshots/cards-${gameSlug}-${language.toLowerCase()}-${CARD_CATALOG_CACHE_REVISION}.json`;
  const snapshotEligible = !missingImages && !printingIds && !identityCodes && !identityIds && !identityCode && !setCodes.length && !query && !illustratorQuery && !rarities.length && !illustrators.length && !types.length && !categories.length && !stages.length && !attackEnergies.length && !regulations.length && minHp===undefined && maxHp===undefined && !retreats.length && !weaknesses.length && !resistances.length && sort === 'latest' && !limit && offset === 0;
  if (snapshotEligible) {
    try {
      const snapshot = await env.CARD_IMAGES?.get(snapshotKey);
      if (snapshot) {
        const response = Response.json(await snapshot.json<{ cards: Record<string, unknown>[] }>(), {headers:{
          'Cache-Control':'public, max-age=300, stale-while-revalidate=86400',
          'Cloudflare-CDN-Cache-Control':'public, max-age=31536000, immutable',
        }});
        return storePublicEdgeCache(request, response);
      }
    } catch {
      // Fall through to the catalog source if the snapshot is unavailable.
    }
  }
  let cards: Record<string, unknown>[];
  try {
    cards = await fromD1(gameSlug, language, identityCode, setCodes, printingIds||identityCodes||identityIds?undefined:resultLimit, offset, printingIds,identityCodes,identityIds,query,rarities,illustrators,types,categories,stages,sort,missingImages,attackEnergies,regulations,minHp,maxHp,retreats,weaknesses,resistances,illustratorQuery);
    if(gameSlug==='pokemon'&&(language==='JP'||language==='ALL')&&query&&/[a-z]/i.test(query)&&query.length>=3&&!printingIds&&!identityCodes&&!identityIds&&!identityCode){
      const aliases=await pokemonSearchAliases(query);
      if(aliases.length){
        const aliasCards=await fromD1(gameSlug,language,undefined,setCodes,resultLimit,offset,undefined,undefined,undefined,undefined,rarities,illustrators,types,categories,stages,sort,missingImages,attackEnergies,regulations,minHp,maxHp,retreats,weaknesses,resistances,illustratorQuery,aliases);
        const seen=new Set(cards.map(card=>String(card.id)));
        cards=[...cards,...aliasCards.filter(card=>!seen.has(String(card.id)))];
      }
    }
  }
  catch { return Response.json({ error: 'Catalog is temporarily unavailable.' }, { status: 503 }); }
  const response = Response.json({ cards }, {
    headers: {
      'Cache-Control': liveImageAudit ? 'no-store' : 'public, max-age=300, stale-while-revalidate=86400',
      'Cloudflare-CDN-Cache-Control': liveImageAudit ? 'no-store' : 'public, max-age=31536000, immutable',
    },
  });
  if (snapshotEligible) {
    try {
      await env.CARD_IMAGES?.put(snapshotKey, JSON.stringify({ cards }), {
        httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'public, max-age=86400' },
      });
    } catch {
      // The catalog response can still be served when snapshot storage is unavailable.
    }
  }
  return liveImageAudit ? response : storePublicEdgeCache(request, response);
}
