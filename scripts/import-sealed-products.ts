import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const inputPath = process.argv.find(argument => argument.endsWith('.json'));
const source = process.env.SEALED_CATALOG_SOURCE?.trim();
const apply = process.argv.includes('--apply');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!inputPath) {
  throw new Error('Pass a JSON file containing normalized sealed-product records.');
}
if (!source) {
  throw new Error('Set SEALED_CATALOG_SOURCE to identify the source of this catalog export.');
}
if (!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(source)) {
  throw new Error('SEALED_CATALOG_SOURCE must be a short source identifier.');
}
if (apply && process.env.SEALED_CATALOG_RIGHTS_CONFIRMED !== 'yes') {
  throw new Error('Before importing, set SEALED_CATALOG_RIGHTS_CONFIRMED=yes after confirming that the source permits commercial use and storage.');
}
if (apply && (!supabaseUrl || !supabaseSecret)) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before importing.');
}

const productKinds = new Set([
  'BOOSTER_PACK', 'BOOSTER_BOX', 'CASE', 'STARTER_DECK', 'DOUBLE_PACK', 'COLLECTION', 'OTHER',
]);

function optionalText(value: unknown, field: string, index: number): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`Record ${index + 1} ${field} must be text.`);
  return value.trim() || null;
}

type InputProduct = {
  external_id: string | number;
  game_slug: string;
  name: string;
  product_kind: string;
  set_code?: string | null;
  set_name?: string | null;
  language?: string | null;
  release_date?: string | null;
  source_url?: string | null;
};

const raw = JSON.parse(await readFile(resolve(inputPath), 'utf8')) as unknown;
if (!Array.isArray(raw)) throw new Error('The JSON file must contain an array of product records.');

const updatedAt = new Date().toISOString();
const seen = new Set<string>();
const rows = raw.map((value, index) => {
  if (!value || typeof value !== 'object') throw new Error(`Record ${index + 1} must be an object.`);
  const product = value as InputProduct;
  const externalId = typeof product.external_id === 'string' || typeof product.external_id === 'number'
    ? String(product.external_id).trim()
    : '';
  const gameSlug = typeof product.game_slug === 'string' ? product.game_slug.trim().toLowerCase() : '';
  const name = typeof product.name === 'string' ? product.name.trim() : '';
  const productKind = typeof product.product_kind === 'string' ? product.product_kind.trim().toUpperCase() : '';
  const language = optionalText(product.language, 'language', index)?.toUpperCase() ?? '';
  const key = `${externalId}\0${language}`;

  if (!externalId || !gameSlug || !name) throw new Error(`Record ${index + 1} needs external_id, game_slug, and name.`);
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(gameSlug)) throw new Error(`Record ${index + 1} has an invalid game_slug.`);
  if (!productKinds.has(productKind)) throw new Error(`Record ${index + 1} has an unsupported product_kind.`);
  if (seen.has(key)) throw new Error(`Duplicate product identity at record ${index + 1}: ${externalId} (${language || 'no language'}).`);
  seen.add(key);

  const releaseDate = optionalText(product.release_date, 'release_date', index);
  if (releaseDate && (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)
    || Number.isNaN(Date.parse(`${releaseDate}T00:00:00Z`))
    || new Date(`${releaseDate}T00:00:00Z`).toISOString().slice(0, 10) !== releaseDate)) {
    throw new Error(`Record ${index + 1} release_date must be a real date in YYYY-MM-DD format.`);
  }

  const sourceUrl = optionalText(product.source_url, 'source_url', index);
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) throw new Error(`Record ${index + 1} source_url must be an http(s) URL.`);

  return {
    source,
    external_id: externalId,
    game_slug: gameSlug,
    name,
    product_kind: productKind,
    set_code: optionalText(product.set_code, 'set_code', index),
    set_name: optionalText(product.set_name, 'set_name', index),
    language,
    release_date: releaseDate,
    source_url: sourceUrl,
    updated_at: updatedAt,
  };
});

console.log(`Found ${rows.length} sealed-product records from ${source}.`);
const counts = rows.reduce<Record<string, number>>((result, row) => {
  result[row.product_kind] = (result[row.product_kind] ?? 0) + 1;
  return result;
}, {});
console.log(`Kinds: ${JSON.stringify(counts)}`);
if (!apply) {
  console.log('Dry run only. Add --apply after confirming the source permits commercial use and storage.');
  process.exit(0);
}

const supabase = createClient(supabaseUrl!, supabaseSecret!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
for (let offset = 0; offset < rows.length; offset += 100) {
  const { error } = await supabase.from('tcg_sealed_products').upsert(rows.slice(offset, offset + 100), {
    onConflict: 'source,external_id,language',
  });
  if (error) throw new Error(`Sealed product import failed: ${error.message}`);
}
console.log(`Imported ${rows.length} sealed-product records.`);
