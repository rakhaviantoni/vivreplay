import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before importing.');

async function resilientFetch(input: RequestInfo | URL, init?: RequestInit) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: resilientFetch },
});
const BUCKET = 'tcg-card-images';
const CONCURRENCY = 8;
const WRITE_BATCH_SIZE = 250;
const importLimit = Number(process.env.JP_IMPORT_LIMIT || 0);
const selectedCodes = new Set((process.env.JP_CODES || '').split(',').map(code => code.trim().toUpperCase()).filter(Boolean));

type EnglishPrinting = {
  identity_id: string;
  set_id: string | null;
  set_code: string;
  set_name: string;
  rarity: string;
  variant: string;
  source_kind: string;
  life: number | null;
  sub_types: string | null;
  counter_amount: number;
  attribute: string | null;
  source_inventory_price: number | null;
  source_market_price: number | null;
  source_observed_at: string | null;
  source_payload: Record<string, unknown>;
  tcg_card_identities: { code: string };
};

function chunks<T>(items: T[], size = WRITE_BATCH_SIZE) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

async function upsertInBatches(table: string, rows: Record<string, unknown>[], onConflict: string) {
  for (const batch of chunks(rows)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table} import failed: ${error.message}`);
  }
}

async function fetchEnglishPrintings() {
  const rows: EnglishPrinting[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('tcg_card_printings')
      .select('identity_id,set_id,set_code,set_name,rarity,variant,source_kind,life,sub_types,counter_amount,attribute,source_inventory_price,source_market_price,source_observed_at,source_payload,tcg_card_identities!inner(code)')
      .eq('language', 'EN').range(from, from + 999);
    if (error) throw error;
    rows.push(...data as unknown as EnglishPrinting[]);
    if (data.length < 1000) return rows;
  }
}

async function fetchOplayImage(sourceUrl: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, {
        headers: { accept: 'image/webp,image/*;q=0.8' },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 404 || response.ok || (response.status >= 400 && response.status < 500)) return response;
      lastError = new Error(`returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw lastError;
}

function folderFor(code: string) {
  return code.split('-')[0].toUpperCase();
}

async function importImage(printing: EnglishPrinting) {
  const code = printing.tcg_card_identities?.code?.toUpperCase();
  if (!code) return { printing, sourceUrl: '', variants: {}, error: 'missing_card_code' as const };
  const setFolder = folderFor(code);
  const sourceUrl = `https://cards.oplaytcg.com/${setFolder}/jp/small/${code}.webp`;
  try {
    const response = await fetchOplayImage(sourceUrl);
    if (response.status === 404) return { printing, sourceUrl, variants: {}, error: 'not_available' as const };
    if (!response.ok) throw new Error(`returned ${response.status}`);
    const source = Buffer.from(await response.arrayBuffer());
    const folder = `one-piece/${setFolder.toLowerCase()}/jp`;
    const variants = Object.fromEntries(await Promise.all([
      ['thumb', 180, 72], ['small', 420, 78], ['large', 960, 84],
    ].map(async ([name, width, quality]) => {
      const path = `${folder}/${name}/${code.toLowerCase()}.webp`;
      const body = await sharp(source).rotate().resize({ width: Number(width), withoutEnlargement: true }).webp({ quality: Number(quality), effort: 4 }).toBuffer();
      const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
      if (error) throw error;
      return [name, path];
    })));
    return { printing, sourceUrl, variants, error: null };
  } catch (error) {
    return { printing, sourceUrl, variants: {}, error: error instanceof Error ? error.message : 'download_failed' };
  }
}

async function boundedMap<T, R>(items: T[], task: (item: T) => Promise<R>) {
  const results: R[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) results[cursor] = await task(items[cursor++]);
  }));
  return results;
}

async function main() {
  const { data: run, error: runError } = await supabase.from('tcg_import_runs').insert({ source: 'oplaytcg-jp', status: 'running' }).select('id').single();
  if (runError) throw runError;
  try {
    const english = await fetchEnglishPrintings();
    const scoped = selectedCodes.size > 0 ? english.filter(printing => selectedCodes.has(printing.tcg_card_identities?.code?.toUpperCase())) : english;
    const selected = importLimit > 0 ? scoped.slice(0, importLimit) : scoped;
    console.log(`Checking ${selected.length} Japanese OPlay image links.`);
    const results = await boundedMap(selected, importImage);
    const available = results.filter(result => !result.error);
    const jpRows = available.map(({ printing, sourceUrl, variants }) => ({
      identity_id: printing.identity_id, language: 'JP', set_id: printing.set_id, set_code: printing.set_code, set_name: printing.set_name, printing_code: printing.tcg_card_identities.code,
      rarity: printing.rarity, variant: printing.variant, source_kind: printing.source_kind, life: printing.life, sub_types: printing.sub_types,
      counter_amount: printing.counter_amount, attribute: printing.attribute, card_image_id: printing.tcg_card_identities.code,
      card_image_url: sourceUrl, source_inventory_price: printing.source_inventory_price, source_market_price: printing.source_market_price,
      source_observed_at: printing.source_observed_at, source_payload: { ...printing.source_payload, image_locale: 'JP', image_source: 'oplaytcg' },
    }));
    await upsertInBatches('tcg_card_printings', jpRows, 'identity_id,language,set_code,variant');
    const { data: jpPrintings, error: printingError } = await supabase.from('tcg_card_printings').select('id,identity_id,set_code,variant').eq('language', 'JP');
    if (printingError) throw printingError;
    const printingIdByKey = new Map(jpPrintings.map(row => [`${row.identity_id}:${row.set_code}:${row.variant}`, row.id]));
    const sourceRows = available.map(({ printing, sourceUrl, variants }) => ({
      printing_id: printingIdByKey.get(`${printing.identity_id}:${printing.set_code}:${printing.variant}`), source_type: 'oplaytcg', source_url: sourceUrl,
      rights_status: 'user_requested_import_pending_review', storage_path: variants.small as string, storage_variants: variants,
      stored_format: 'webp', approved_for_display: false, approved_for_storage: false,
    }));
    await upsertInBatches('tcg_card_asset_sources', sourceRows, 'source_url');
    const assetRows = available.flatMap(({ printing, variants }) => {
      const printingId = printingIdByKey.get(`${printing.identity_id}:${printing.set_code}:${printing.variant}`);
      if (!printingId) return [];
      return ([['thumb', 180], ['small', 420], ['large', 960]] as const)
        .filter(([kind]) => Boolean(variants[kind]))
        .map(([kind, width]) => ({ printing_id: printingId, kind, object_key: variants[kind] as string, width }));
    });
    await upsertInBatches('tcg_card_assets', assetRows, 'printing_id,kind');
    const summary = { checked: results.length, imported: available.length, unavailable: results.filter(result => result.error === 'not_available').length, failed: results.filter(result => result.error && result.error !== 'not_available').length, failedSamples: results.filter(result => result.error && result.error !== 'not_available').slice(0, 5).map(result => ({ code: result.printing.tcg_card_identities?.code, error: result.error })) };
    const { error: completeError } = await supabase.from('tcg_import_runs').update({ status: 'completed', summary, completed_at: new Date().toISOString() }).eq('id', run.id);
    if (completeError) throw completeError;
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await supabase.from('tcg_import_runs').update({ status: 'failed', summary: { error: error instanceof Error ? error.message : 'unknown failure' }, completed_at: new Date().toISOString() }).eq('id', run.id);
    throw error;
  }
}

await main();
