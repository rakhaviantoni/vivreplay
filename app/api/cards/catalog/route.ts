import { database } from '@/lib/server/database';
import { readPublicEdgeCache, storePublicEdgeCache } from '@/lib/server/public-edge-cache';
import { supabaseAdmin } from '@/lib/server/supabase-storage';
import { isPlayableSet, PREVIEW_CARD_CODES } from '@/packages/domain/release-availability';
import { gameId } from '@/packages/card-data/catalog';
import { CARD_CATALOG_CACHE_REVISION } from '@/lib/card-catalog-cache';
import { env } from 'cloudflare:workers';

function publicCardPath(objectKey: string) {
  return `/${objectKey.replace(/^one-piece\/([^/]+)\//, (_, setCode: string) => `${setCode.replaceAll('-', '')}/`)}`;
}

function parseJson(value: unknown) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

async function fromD1(language: string, identityCode?: string, setCode?: string) {
  const db = database();
  const predicates = ['p.language=?'];
  const values: (string | number)[] = [language];
  if (identityCode) {
    const identity = await db.prepare('SELECT id FROM tcg_card_identities WHERE game_id=? AND code=? LIMIT 1')
      .bind(gameId, identityCode).first<{ id: string }>();
    if (!identity) return [];
    predicates.push('p.identity_id=?');
    values.push(identity.id);
  }
  if (setCode) {
    predicates.push('p.set_code=?');
    values.push(setCode);
  }
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
    WHERE ${predicates.join(' AND ')}
    ${identityCode || setCode ? '' : 'ORDER BY p.set_code,p.id'}
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
    if (!isPlayableSet(setCode) && !PREVIEW_CARD_CODES.has(code) && row.variant !== 'Preview') return [];
    const imageKey = String(row.image_key ?? '');
    const imageUrl = !imageKey ? null : imageKey.startsWith('http') ? imageKey : publicCardPath(imageKey);
    return [{
      id: row.id, rarity: row.rarity, variant: row.variant,
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

async function fromSupabase(language: string, identityCode?: string, setCode?: string) {
  const supabase = supabaseAdmin();
  if (!supabase) throw new Error('Supabase catalog fallback is unavailable.');
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase.from('tcg_card_printings')
      .select('id,rarity,variant,set_code,set_name,printing_code,language,attribute,counter_amount,sub_types,source_payload,card_image_url,tcg_card_assets(kind,object_key),tcg_card_identities!inner(id,code,name,color,card_type,cost,power,effect_text)')
      .eq('language', language);
    if (identityCode) query = query.eq('tcg_card_identities.code', identityCode);
    if (setCode) query = query.eq('set_code', setCode);
    const { data, error } = await query.range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if ((data ?? []).length < 1000) break;
  }
  return rows.filter(row => {
    const identity = row.tcg_card_identities as { code?: string } | null;
    const code = String(identity?.code ?? '').toUpperCase();
    return isPlayableSet(String(row.set_code ?? '')) || PREVIEW_CARD_CODES.has(code) || row.variant === 'Preview';
  });
}

export async function GET(request: Request) {
  const cached = await readPublicEdgeCache(request);
  if (cached) return cached;
  const params = new URL(request.url).searchParams;
  const language = params.get('language')?.toUpperCase() === 'JP' ? 'JP' : 'EN';
  const rawCode = params.get('code')?.trim().toUpperCase();
  const identityCode = rawCode && /^[A-Z0-9-]{1,32}$/.test(rawCode) ? rawCode : undefined;
  const rawSet = params.get('set')?.trim().toUpperCase();
  const setCode = rawSet && /^[A-Z0-9_-]{1,24}$/.test(rawSet) ? rawSet : undefined;
  const snapshotKey = `catalog-snapshots/cards-${language.toLowerCase()}-${CARD_CATALOG_CACHE_REVISION}.json`;
  if (!identityCode && !setCode) {
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
  try { cards = await fromD1(language, identityCode, setCode); }
  catch { cards = []; }
  if (!cards.length) {
    try { cards = await fromSupabase(language, identityCode, setCode); }
    catch { return Response.json({ error: 'Catalog is temporarily unavailable.' }, { status: 503 }); }
  }
  const response = Response.json({ cards }, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
  if (!identityCode && !setCode) {
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
