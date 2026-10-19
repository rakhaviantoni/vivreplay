import { database } from '@/lib/server/database';
import { readPublicEdgeCache, storePublicEdgeCache } from '@/lib/server/public-edge-cache';
import { isPlayableSet, PREVIEW_CARD_CODES } from '@/packages/domain/release-availability';
import { CARD_CATALOG_CACHE_REVISION } from '@/lib/card-catalog-cache';
import { env } from 'cloudflare:workers';

function publicCardPath(objectKey: string, setCode = '', language = 'EN', printingCode = '') {
  if (objectKey.startsWith('/')) return objectKey;
  if (objectKey.startsWith('one-piece/')) {
    const match = objectKey.match(/^one-piece\/([^/]+)\/([^/]+)\/(?:small\/|thumb\/|large\/)?(.+)$/);
    return match ? `/${encodeURIComponent(match[1].replaceAll('-', ''))}/${encodeURIComponent(match[2].toLowerCase())}/${match[3].split('/').map(encodeURIComponent).join('/')}` : '';
  }
  if (objectKey.startsWith('http')) {
    try {
      const source = new URL(objectKey);
      const [folder, sourceLanguage, ...parts] = source.pathname.split('/').filter(Boolean);
      const filename = parts.at(-1);
      if (source.hostname === 'assets.tcgdex.net' && source.protocol === 'https:' && source.pathname.startsWith('/')) {
        const setCode = parts.at(-3)?.replace(/\.(?:webp|png|jpe?g)$/i, '');
        const cardCode = parts.at(-2)?.replace(/\.(?:webp|png|jpe?g)$/i, '');
        const sourceLanguageCode = folder?.toLowerCase();
        const languageCode = sourceLanguageCode === 'id' ? 'id' : sourceLanguageCode === 'jp' || sourceLanguageCode === 'ja' ? 'jp' : sourceLanguageCode === 'en' ? 'en' : '';
        if (languageCode && setCode && cardCode) {
          return `/pokemon/art/${languageCode}/${encodeURIComponent(setCode)}/${encodeURIComponent(cardCode)}`;
        }
        return '';
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

async function fromD1(gameSlug: string, language: string, identityCode?: string, setCode?: string, limit?: number, offset = 0, printingIds?: string[],identityCodes?:string[],identityIds?:string[],query?:string,rarity?:string,illustrator?:string) {
  const db = database();
  const selectedGame = await db.prepare('SELECT id FROM tcg_games WHERE slug=? LIMIT 1').bind(gameSlug).first<{ id: string }>();
  if (!selectedGame) return [];
  const predicates = ['i.game_id=?'];
  const values: (string | number)[] = [selectedGame.id];
  if (!printingIds?.length) { predicates.push('p.language=?'); values.push(language); }
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
  if (setCode) {
    // Set codes have historically been imported as both OP15 and OP-15 (and
    // EB01 / EB-01). Match their canonical form so a route or deep link never
    // loses cards just because one import used punctuation.
    const normalizedSet=setCode.toUpperCase().replace(/[-_\s]/g, '');
    predicates.push("(UPPER(REPLACE(REPLACE(REPLACE(p.set_code,'-',''),'_',''),' ',''))=? OR (? LIKE 'OP%' AND UPPER(REPLACE(REPLACE(REPLACE(p.set_code,'-',''),'_',''),' ','')) LIKE ? || 'EB%'))");
    values.push(normalizedSet,normalizedSet,normalizedSet);
  }
  if (query) {
    const needle = `%${query.toLocaleLowerCase()}%`;
    predicates.push(`(LOWER(COALESCE(i.name,'')) LIKE ? OR LOWER(COALESCE(l.name,'')) LIKE ? OR LOWER(COALESCE(i.code,'')) LIKE ? OR LOWER(COALESCE(p.printing_code,'')) LIKE ? OR LOWER(COALESCE(p.set_code,'')) LIKE ? OR LOWER(COALESCE(p.set_name,'')) LIKE ? OR LOWER(COALESCE(p.rarity,'')) LIKE ? OR LOWER(COALESCE(p.source_payload,'')) LIKE ?)`);
    values.push(needle,needle,needle,needle,needle,needle,needle,needle);
  }
  if (rarity) { predicates.push('LOWER(p.rarity)=?'); values.push(rarity.toLocaleLowerCase()); }
  if (illustrator) { predicates.push('LOWER(COALESCE(p.source_payload,\'\')) LIKE ?'); values.push(`%${illustrator.toLocaleLowerCase()}%`); }
  const pagination = limit ? 'LIMIT ? OFFSET ?' : '';
  if (limit) values.push(limit, offset);
  const { results } = await db.prepare(`
    SELECT p.id,p.rarity,p.variant,p.set_code,p.set_name,p.printing_code,p.language,
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
    ORDER BY COALESCE(s.release_date,'') DESC,p.set_code DESC,p.printing_code,p.id
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
    const imageUrl = !imageKey ? null : publicCardPath(imageKey, setCode, language, String(row.printing_code || identity.code || '')) || null;
    return [{
      id: row.id,identity_id:row.identity_id, rarity: row.rarity, variant: row.variant,
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
  const cached = await readPublicEdgeCache(request);
  if (cached) return cached;
  const params = new URL(request.url).searchParams;
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
  const language = requestedLanguage === 'JP' || requestedLanguage === 'JA' ? 'JP' : requestedLanguage === 'ID' ? 'ID' : 'EN';
  const rawCode = params.get('code')?.trim().toUpperCase();
  const identityCode = rawCode && /^[A-Z0-9-]{1,32}$/.test(rawCode) ? rawCode : undefined;
  const rawSet = params.get('set')?.trim();
  const setCode = rawSet && /^[A-Za-z0-9_-]{1,24}$/.test(rawSet) ? (gameSlug === 'pokemon' ? rawSet : rawSet.toUpperCase()) : undefined;
  const rawLimit = Number(params.get('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(500, Math.floor(rawLimit)) : undefined;
  const rawOffset = Number(params.get('offset'));
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.min(100_000, Math.floor(rawOffset)) : 0;
  const rawQuery = params.get('q')?.trim().slice(0, 100).toLocaleLowerCase();
  const query = rawQuery && rawQuery.length >= 2 ? rawQuery : undefined;
  const rawRarity = params.get('rarity')?.trim().slice(0, 40);
  const rarity = rawRarity && /^[\p{L}\p{N} .+'-]+$/u.test(rawRarity) ? rawRarity : undefined;
  const rawIllustrator = params.get('illustrator')?.trim().slice(0, 80);
  const illustrator = rawIllustrator && /^[\p{L}\p{N} .,'&()_-]+$/u.test(rawIllustrator) ? rawIllustrator : undefined;
  const snapshotKey = `catalog-snapshots/cards-${gameSlug}-${language.toLowerCase()}-${CARD_CATALOG_CACHE_REVISION}.json`;
  const snapshotEligible = !printingIds && !identityCodes && !identityIds && !identityCode && !setCode && !query && !rarity && !illustrator && !limit && offset === 0;
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
  try { cards = await fromD1(gameSlug, language, identityCode, setCode, printingIds||identityCodes||identityIds?undefined:limit, offset, printingIds,identityCodes,identityIds,query,rarity,illustrator); }
  catch { return Response.json({ error: 'Catalog is temporarily unavailable.' }, { status: 503 }); }
  const response = Response.json({ cards }, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable',
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
  return storePublicEdgeCache(request, response);
}
