import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { fetchAllOPTCGCards, type NormalizedOPTCGCard } from '../packages/imports/optcg';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before importing.');

async function resilientFetch(input: RequestInfo | URL, init?: RequestInit) {
  let failure: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await fetch(input, init); }
    catch (error) {
      failure = error;
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw failure;
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: resilientFetch },
});
const BUCKET = 'tcg-card-images';
const IMAGE_CONCURRENCY = 6;
const WRITE_BATCH_SIZE = 250;

function chunks<T>(items: T[], size = WRITE_BATCH_SIZE) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

async function upsertInBatches(table: string, rows: Record<string, unknown>[], onConflict: string) {
  for (const batch of chunks(rows)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table} import failed: ${error.message}`);
  }
}

async function fetchIdentityIds(gameId: string) {
  const rows: { id: string; code: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('tcg_card_identities').select('id,code').eq('game_id', gameId).range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function fetchPrintingIds(gameId: string, language: string) {
  const rows: { id: string; identity_id: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('tcg_card_printings').select('id,identity_id,tcg_card_identities!inner(game_id)').eq('tcg_card_identities.game_id', gameId).eq('language', language).range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function ensureBucket() {
  if (process.env.SUPABASE_STORAGE_BUCKET_READY === 'true') return;
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: '8MB', allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] });
    if (error) throw error;
  }
}

async function uploadImage(card: NormalizedOPTCGCard) {
  if (!card.imageUrl) return { code: card.code, path: null, variants: {}, error: null };
  try {
    const response = await fetch(card.imageUrl, { headers: { accept: 'image/avif,image/webp,image/*,*/*;q=0.8' } });
    if (!response.ok) throw new Error(`image returned ${response.status}`);
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > 8 * 1024 * 1024) throw new Error('image exceeds 8 MB limit');
    const folder = `one-piece/${card.setCode.toLowerCase().replace(/[^a-z0-9-]/g, '-')}/en`;
    const source = Buffer.from(await response.arrayBuffer());
    const variants = Object.fromEntries(await Promise.all([
      ['thumb', 180, 72],
      ['small', 420, 78],
      ['large', 960, 84],
    ].map(async ([name, width, quality]) => {
      const path = `${folder}/${name}/${card.code.toLowerCase()}.webp`;
      const body = await sharp(source).rotate().resize({ width: Number(width), withoutEnlargement: true }).webp({ quality: Number(quality), effort: 4 }).toBuffer();
      const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' });
      if (error) throw error;
      return [name, path];
    })));
    return { code: card.code, path: variants.small as string, variants, error: null };
  } catch (error) {
    return { code: card.code, path: null, variants: {}, error: error instanceof Error ? error.message : 'image import failed' };
  }
}

async function boundedMap<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  }));
  return results;
}

async function main() {
  console.log('Preparing catalog import.');
  await ensureBucket();
  console.log('Resolving One Piece game.');
  const { data: game, error: gameError } = await supabase.from('tcg_games').upsert({ slug: 'one-piece', name: 'One Piece Card Game' }, { onConflict: 'slug' }).select('id').single();
  if (gameError) throw gameError;

  const { data: run, error: runError } = await supabase.from('tcg_import_runs').insert({ source: 'optcgapi', status: 'running' }).select('id').single();
  if (runError) throw runError;
  try {
    console.log('Fetching OPTCG bulk feeds.');
    const batch = await fetchAllOPTCGCards();
    console.log(`Upserting ${batch.sets.length} sets.`);
    const setRows = batch.sets.map(set => ({ game_id: game.id, external_set_id: set.externalSetId, name: set.name, set_kind: set.kind }));
    await upsertInBatches('tcg_sets', setRows, 'game_id,external_set_id');
    const { data: importedSets, error: setError } = await supabase.from('tcg_sets').select('id,external_set_id').eq('game_id', game.id);
    if (setError) throw setError;
    const setIdByExternalId = new Map(importedSets.map(set => [set.external_set_id, set.id]));
    console.log(`Upserting ${batch.cards.length} identities.`);
    const identities = batch.cards.map(card => ({ game_id: game.id, code: card.code, name: card.name, color: card.color, card_type: card.type, cost: card.cost, power: card.power, effect_text: card.effect, updated_at: new Date().toISOString() }));
    await upsertInBatches('tcg_card_identities', identities, 'game_id,code');
    const sourceRecordRows = batch.cards.map(card => ({ import_run_id: run.id, source: 'optcgapi', source_key: card.code, payload: card.sourcePayload, observed_at: card.sourceObservedAt }));
    await upsertInBatches('tcg_source_records', sourceRecordRows, 'source,source_key,observed_at');
    console.log('Resolving canonical identities.');
    const canonical = await fetchIdentityIds(game.id);
    const idByCode = new Map(canonical.map(row => [row.code, row.id]));
    const ruleRows = batch.cards.map(card => ({ identity_id: idByCode.get(card.code), colors: [card.color], card_type: card.type, cost: card.cost, power: card.power, life: card.life, counter_amount: card.counterAmount, attributes: card.attribute ? [card.attribute] : [], traits: card.subTypes ? card.subTypes.split(/\s{2,}|\s*\/\s*/).filter(Boolean) : [], updated_at: new Date().toISOString() }));
    const localizationRows = batch.cards.map(card => ({ identity_id: idByCode.get(card.code), language: 'EN', name: card.name, effect_text: card.effect, traits_text: card.subTypes, updated_at: new Date().toISOString() }));
    await upsertInBatches('tcg_card_rules', ruleRows, 'identity_id');
    await upsertInBatches('tcg_card_localizations', localizationRows, 'identity_id,language');
    const printingRows = batch.cards.map(card => ({ identity_id: idByCode.get(card.code), language: 'EN', set_id: setIdByExternalId.get(card.setCode), set_code: card.setCode, set_name: card.setName, printing_code: card.code, rarity: card.rarity, variant: 'Standard', source_kind: card.sourceKind, life: card.life, sub_types: card.subTypes, counter_amount: card.counterAmount, attribute: card.attribute, card_image_id: card.imageId, card_image_url: card.imageUrl, source_inventory_price: card.inventoryPrice, source_market_price: card.marketPrice, source_observed_at: card.sourceObservedAt, source_payload: card.sourcePayload }));
    console.log(`Upserting ${printingRows.length} printings.`);
    await upsertInBatches('tcg_card_printings', printingRows, 'identity_id,language,set_code,variant');
    const importedPrintings = await fetchPrintingIds(game.id, 'EN');
    const printingIdByIdentityId = new Map(importedPrintings.map(printing => [printing.identity_id, printing.id]));
    console.log('Downloading and uploading image files.');
    const imageResults = await boundedMap(batch.cards, IMAGE_CONCURRENCY, uploadImage);
    const resultByCode = new Map(imageResults.map(result => [result.code, result]));
    const sourceRows = batch.cards.filter(card => card.imageUrl).map(card => { const identityId = idByCode.get(card.code); return { printing_id: identityId ? printingIdByIdentityId.get(identityId) : null, source_type: 'optcgapi', source_url: card.imageUrl, rights_status: 'user_requested_import_pending_review', observed_at: card.sourceObservedAt, storage_path: resultByCode.get(card.code)?.path ?? null, storage_variants: resultByCode.get(card.code)?.variants ?? {}, stored_format: 'webp', approved_for_display: false, approved_for_storage: false }; });
    console.log(`Recording ${sourceRows.length} asset sources.`);
    await upsertInBatches('tcg_card_asset_sources', sourceRows, 'source_url');
    const assetRows = batch.cards.flatMap(card => {
      const printingId = idByCode.get(card.code) ? printingIdByIdentityId.get(idByCode.get(card.code)!) : undefined;
      const variants = resultByCode.get(card.code)?.variants as Record<string, string> | undefined;
      return printingId && variants ? ([['thumb', 180], ['small', 420], ['large', 960]].filter(([kind]) => variants[kind]).map(([kind, width]) => ({ printing_id: printingId, kind, object_key: variants[kind], width }))) : [];
    });
    await upsertInBatches('tcg_card_assets', assetRows, 'printing_id,kind');
    const priceRows = batch.cards.flatMap(card => {
      const printingId = idByCode.get(card.code) ? printingIdByIdentityId.get(idByCode.get(card.code)!) : undefined;
      const observedAt = card.sourceObservedAt ? `${card.sourceObservedAt}T00:00:00Z` : new Date().toISOString();
      if (!printingId) return [];
      return [card.inventoryPrice === null ? null : { printing_id: printingId, source: 'optcgapi', source_kind: 'inventory_price', amount: card.inventoryPrice, currency: 'USD', observed_at: observedAt }, card.marketPrice === null ? null : { printing_id: printingId, source: 'optcgapi', source_kind: 'market_price', amount: card.marketPrice, currency: 'USD', observed_at: observedAt }].filter(Boolean);
    });
    await upsertInBatches('tcg_price_observations', priceRows as Record<string, unknown>[], 'printing_id,source,source_kind,observed_at');
    const failedImages = imageResults.filter(result => result.error);
    const summary = { counts: batch.counts, cards: batch.cards.length, imagesStored: imageResults.length - failedImages.length, failedImages };
    const { error: completeError } = await supabase.from('tcg_import_runs').update({ status: 'completed', summary, completed_at: new Date().toISOString() }).eq('id', run.id);
    if (completeError) throw completeError;
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await supabase.from('tcg_import_runs').update({ status: 'failed', summary: { error: error instanceof Error ? error.message : 'unknown failure' }, completed_at: new Date().toISOString() }).eq('id', run.id);
    throw error;
  }
}

await main();
