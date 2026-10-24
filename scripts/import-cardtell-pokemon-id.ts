import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

type FilterOption = { value?: string; code?: string | null };
type Taxonomy = { id: number; value: string; code?: string; image_url?: string; metadata?: { release_date?: string } };
type Product = { id: number; image?: string; name?: string; description?: string; shortDescription?: string };
type SearchResponse = {
  type?: 'taxonomies' | 'products';
  results?: Array<Taxonomy | Product>;
  hasMore?: boolean;
  filterOptions?: { rarities?: FilterOption[]; cardTypes?: FilterOption[]; regulations?: FilterOption[] };
};
type ProductRecord = { product: Product; taxonomy: Taxonomy };

const endpoint = 'https://cardtell.id/api/search';
const concurrency = Math.max(1, Math.min(5, Number(process.env.CARDTELL_CONCURRENCY ?? 2) || 2));
const delayMs = Math.max(500, Number(process.env.CARDTELL_DELAY_MS ?? 900) || 900);
const pageSize = 12;
const apply = process.argv.includes('--apply');
const local = process.argv.includes('--local') || process.env.CARDTELL_TARGET === 'local';
const d1Name = process.env.CARDTELL_D1_NAME ?? 'vivreplay';
const d1Config = process.env.CARDTELL_D1_CONFIG ?? (local ? 'wrangler.migrations.json' : 'dist/server/wrangler.json');
const cacheDir = process.env.CARDTELL_CACHE_DIR ?? join(tmpdir(), 'vivreplay-cardtell-pokemon-id');
const refresh = process.env.CARDTELL_REFRESH_CACHE === '1';
const catalogOnly = process.env.CARDTELL_CATALOG_ONLY === '1';
const startedAt = new Date().toISOString();
const failures: string[] = [];
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function stableId(key: string) {
  const bytes = createHash('sha256').update(`vivreplay:cardtell-pokemon-id:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function cookieHeader(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const values = getSetCookie ? getSetCookie.call(headers) : [headers.get('set-cookie') ?? ''];
  return values.map(value => value.split(';', 1)[0]).filter(Boolean).join('; ');
}

async function createSession() {
  const response = await fetch('https://cardtell.id/', { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Cardtell session request returned ${response.status}.`);
  const cookie = cookieHeader(response.headers);
  if (!cookie) throw new Error('Cardtell did not provide a catalog session cookie.');
  return cookie;
}

// HTTPie users can pass their already-cleared catalog session without saving
// it in a file. The cookie is only kept in memory for this process.
let sessionCookie = process.env.CARDTELL_COOKIE?.trim() || await createSession();
let cooldownUntil = 0;
const cachePath = (key: unknown) => join(cacheDir, `${createHash('sha256').update(JSON.stringify(key)).digest('hex')}.json`);
mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
let requests = 0;
async function search(payload: Record<string, unknown>): Promise<SearchResponse> {
  const path = cachePath(payload);
  if (!refresh && existsSync(path)) {
    try { return JSON.parse(readFileSync(path, 'utf8')) as SearchResponse; } catch { /* Re-fetch invalid cache. */ }
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    await wait(Math.max(delayMs, cooldownUntil - Date.now()));
    try {
      requests++;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          origin: 'https://cardtell.id',
          referer: 'https://cardtell.id/',
          cookie: sessionCookie,
          'user-agent': 'VivrePlay catalog importer (public catalog sync)',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 401 || response.status === 403) {
        sessionCookie = await createSession();
        throw new Error(`session expired (${response.status})`);
      }
      if (response.status === 429 || response.status >= 500) {
        const retryHeader = response.headers.get('retry-after');
        const retrySeconds = retryHeader && Number.isFinite(Number(retryHeader)) ? Number(retryHeader) : 0;
        const retryAt = retryHeader && !retrySeconds ? Date.parse(retryHeader) : NaN;
        const retryAfterMs = response.status === 429
          ? Math.max(5_000, retrySeconds * 1_000, Number.isFinite(retryAt) ? retryAt - Date.now() : 0, Math.min(120_000, 5_000 * 2 ** attempt))
          : Math.min(30_000, 1_000 * 2 ** attempt);
        if (response.status === 429) cooldownUntil = Math.max(cooldownUntil, Date.now() + retryAfterMs);
        throw Object.assign(new Error(`Cardtell returned ${response.status}`), { retryAfterMs });
      }
      if (!response.ok) throw new Error(`Cardtell returned ${response.status} for ${JSON.stringify(payload)}`);
      const json = await response.json() as SearchResponse;
      writeFileSync(path, JSON.stringify(json), { mode: 0o600 });
      return json;
    } catch (error) {
      lastError = error;
      const retryAfterMs = (error as { retryAfterMs?: number } | null)?.retryAfterMs;
      if (attempt < 5) await wait(retryAfterMs ?? Math.min(30_000, 1_000 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Cardtell request failed.');
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!);
    }
  }));
  return results;
}

async function pages(payload: Record<string, unknown>) {
  const collected: Array<Taxonomy | Product> = [];
  let offset = 0;
  let options: SearchResponse['filterOptions'];
  while (true) {
    const response = await search({ ...payload, offset, limit: pageSize });
    options ??= response.filterOptions;
    const items = response.results ?? [];
    collected.push(...items);
    if (!response.hasMore || items.length < pageSize) break;
    offset += pageSize;
    if (offset > 500_000) throw new Error('Cardtell pagination exceeded the safety limit.');
  }
  return { items: collected, options };
}

const taxonomyResponse = await pages({ query: '', offset: 0, limit: pageSize, sort: 'number-desc', is_initial: true, taxonomy_id: 2 });
if (!taxonomyResponse.items.length || taxonomyResponse.items.some(item => !('value' in item))) {
  throw new Error('Cardtell did not return the Indonesian Pokémon set list. No data was written.');
}
const taxonomies = taxonomyResponse.items as Taxonomy[];
console.log(`Cardtell returned ${taxonomies.length} Indonesian Pokémon sets. Fetching cards with concurrency ${concurrency}.`);

let setsFetched = 0;
const perSet = await pool(taxonomies, concurrency, async taxonomy => {
  try {
    const response = await pages({ query: '', offset: 0, limit: pageSize, sort: 'number-desc', is_initial: false, taxonomy_id: taxonomy.id });
    if (response.items.some(item => !('name' in item))) throw new Error('unexpected non-product response');
    setsFetched++;
    if (setsFetched % 10 === 0 || setsFetched === taxonomies.length) console.log(`Fetched cards for ${setsFetched}/${taxonomies.length} sets.`);
    return { taxonomy, products: response.items as Product[], options: response.options };
  } catch (error) {
    failures.push(`${taxonomy.code ?? taxonomy.id}: ${error instanceof Error ? error.message : 'request failed'}`);
    setsFetched++;
    if (setsFetched % 10 === 0 || setsFetched === taxonomies.length) console.log(`Fetched cards for ${setsFetched}/${taxonomies.length} sets.`);
    return { taxonomy, products: [], options: undefined };
  }
});

const allProducts = new Map<number, ProductRecord>();
for (const result of perSet) for (const product of result.products) allProducts.set(product.id, { product, taxonomy: result.taxonomy });
const allTypeOptions = [...new Set(perSet.flatMap(result => result.options?.cardTypes ?? []).map(option => option.value?.trim()).filter((value): value is string => Boolean(value)))];
const allRarityOptions = [...new Set(perSet.flatMap(result => result.options?.rarities ?? []).map(option => option.value?.trim()).filter((value): value is string => Boolean(value)))];
if (!allProducts.size) throw new Error('No Indonesian Pokémon cards were returned. No data was written.');
for (const result of perSet) if (!catalogOnly && result.products.length && (!result.options?.cardTypes?.length || !result.options.rarities?.length)) {
  failures.push(`${result.taxonomy.code ?? result.taxonomy.id}: missing card type or rarity filters`);
}
const categoryMap = new Map<number, string>();
const rarityMap = new Map<number, string>();
const filterTasks = catalogOnly ? [] : perSet.flatMap(({ taxonomy, options: setOptions }) => [
  ...(setOptions?.cardTypes ?? []).map(option => option.value?.trim()).filter((value): value is string => Boolean(value))
    .map(value => ({ taxonomy, value, field: 'card_type' as const, destination: categoryMap })),
  ...(setOptions?.rarities ?? []).map(option => option.value?.trim()).filter((value): value is string => Boolean(value))
    .map(value => ({ taxonomy, value, field: 'rarity' as const, destination: rarityMap })),
]);
let categoryHits = 0;
let rarityHits = 0;
let filterTasksDone = 0;
if (!catalogOnly) console.log(`Checking ${filterTasks.length} set-specific card type and rarity filters.`);
await pool(filterTasks, concurrency, async task => {
  try {
    const response = await pages({ query: '', offset: 0, limit: pageSize, sort: 'number-desc', is_initial: false, taxonomy_id: task.taxonomy.id, [task.field]: task.value });
    if (response.items.some(item => !('name' in item))) throw new Error('filter returned a non-product response');
    for (const product of response.items as Product[]) {
      if (!allProducts.has(product.id)) continue;
      task.destination.set(product.id, task.field === 'rarity' && task.value === '-' ? '' : task.value);
      if (task.field === 'card_type') categoryHits++;
      else rarityHits++;
    }
  } catch (error) {
    failures.push(`${task.taxonomy.code ?? task.taxonomy.id} ${task.field}=${task.value}: ${error instanceof Error ? error.message : 'request failed'}`);
  }
  filterTasksDone++;
  if (filterTasksDone % 50 === 0 || filterTasksDone === filterTasks.length) console.log(`Checked ${filterTasksDone}/${filterTasks.length} filters.`);
  return undefined;
});
if (!catalogOnly && allTypeOptions.length && categoryHits === 0) failures.push('Cardtell card_type filters returned no products; category parameter may have changed.');
if (!catalogOnly && allRarityOptions.length && rarityHits === 0) failures.push('Cardtell rarity filters returned no products; rarity parameter may have changed.');
if (!catalogOnly && categoryMap.size < allProducts.size * 0.85) failures.push(`Card types matched only ${categoryMap.size}/${allProducts.size} cards.`);
if (!catalogOnly && rarityMap.size < allProducts.size * 0.85) failures.push(`Rarities matched only ${rarityMap.size}/${allProducts.size} cards.`);

function parseCollectorNumber(product: Product) {
  const text = `${product.shortDescription ?? ''} ${product.description ?? ''}`;
  return text.match(/\b(\d{1,4}\/\d{1,4})\b/)?.[1] ?? text.match(/\b(\d{1,4})\b/)?.[1] ?? '';
}
function productImage(product: Product) {
  if (typeof product.image !== 'string' || !/^\/images\/products\/\d{1,12}\.png(?:\?[^#]*)?$/.test(product.image)) return null;
  return new URL(product.image, 'https://cardtell.id').toString();
}
function quote(value: unknown) { return `'${String(value).replaceAll("'", "''")}'`; }
function literal(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return quote(typeof value === 'object' ? JSON.stringify(value) : value);
}

const gameId = stableId('game:pokemon');
const setRows = taxonomies.map(taxonomy => ({
  id: stableId(`set:${taxonomy.id}`), game_id: gameId, external_set_id: `cardtell:${taxonomy.id}`,
  name: taxonomy.value, set_kind: 'booster', release_date: taxonomy.metadata?.release_date ?? null,
  product_image_url: taxonomy.image_url && /^\/images\/taxonomy\/\d{1,12}\.png(?:\?[^#]*)?$/.test(taxonomy.image_url)
    ? `/api/card-art?url=${encodeURIComponent(new URL(taxonomy.image_url, 'https://cardtell.id').toString())}` : null,
  created_at: startedAt,
}));
const identities: Record<string, unknown>[] = [];
const localizations: Record<string, unknown>[] = [];
const printings: Record<string, unknown>[] = [];
const rules: Record<string, unknown>[] = [];
const assetSources: Record<string, unknown>[] = [];
const seenCodes = new Set<string>();
let missingImages = 0;
for (const [id, { product, taxonomy }] of allProducts) {
  const setCode = String(taxonomy.code ?? '').trim();
  if (!setCode || !/^[A-Z0-9_-]{1,32}$/i.test(setCode)) {
    failures.push(`product ${id}: invalid or missing set code`);
    continue;
  }
  const identityId = stableId(`identity:${id}`);
  const printingId = stableId(`printing:${id}`);
  const identityCode = `PK-CT-${id}`;
  if (seenCodes.has(identityCode)) throw new Error(`Duplicate Cardtell identity code ${identityCode}.`);
  seenCodes.add(identityCode);
  const type = categoryMap.get(id) ?? 'Pokémon';
  const rarity = rarityMap.get(id) ?? '';
  const number = parseCollectorNumber(product);
  const image = productImage(product);
  if (!image) missingImages++;
  const payload = {
    source: 'cardtell', cardtellId: id, name: product.name ?? '', catalogDescription: product.description ?? '',
    shortDescription: product.shortDescription ?? '', collectorNumber: number, localId: number,
    category: type, rarity,
    set: { id: String(taxonomy.id), name: taxonomy.value, cardCount: {} },
  };
  identities.push({ id: identityId, game_id: gameId, code: identityCode, name: product.name ?? `Card ${id}`, color: 'Colorless', card_type: type, cost: 0, power: 0, effect_text: '', created_at: startedAt, updated_at: startedAt });
  localizations.push({ identity_id: identityId, language: 'ID', name: product.name ?? `Kartu ${id}`, effect_text: '', traits_text: type, updated_at: startedAt });
  printings.push({ id: printingId, identity_id: identityId, language: 'ID', set_id: stableId(`set:${taxonomy.id}`), set_code: setCode, set_name: taxonomy.value, rarity, variant: 'Standard', source_kind: 'cardtell', created_at: startedAt, sub_types: JSON.stringify([]), counter_amount: 0, attribute: type, card_image_url: image, source_payload: JSON.stringify(payload), printing_code: `CT-${id}`, release_date: taxonomy.metadata?.release_date ?? null });
  rules.push({ identity_id: identityId, colors: JSON.stringify([]), card_type: type, cost: 0, power: 0, counter_amount: 0, attributes: JSON.stringify([type]), traits: JSON.stringify([]), rules_revision: 'cardtell-id-v1', updated_at: startedAt });
  if (image) assetSources.push({ id: stableId(`asset:${id}`), printing_id: printingId, source_type: 'cardtell', source_url: image, rights_status: 'source_attribution_pending_review', observed_at: startedAt, approved_for_display: false, approved_for_storage: false, created_at: startedAt, storage_variants: '{}' });
}

const summary = {
  source: 'cardtell.id', language: 'ID', sets: taxonomies.length, products: allProducts.size,
  cardTypes: allTypeOptions.length, cardTypesMatched: categoryMap.size, rarities: allRarityOptions.length, raritiesMatched: rarityMap.size,
  productsWithImages: allProducts.size - missingImages, productsMissingImages: missingImages,
  requests, cache: cacheDir, failures: failures.length, failureExamples: failures.slice(0, 20),
};
console.log(JSON.stringify(summary, null, 2));
if (failures.length) {
  console.error('Import stopped because the Cardtell response was incomplete or a filter did not match. No data was written.');
  process.exit(2);
}
if (missingImages && !catalogOnly) throw new Error('Some Cardtell products have no supported image path. No data was written.');
if (!apply) {
  console.log('Preview only. Run with --apply to write the normalized Indonesian Pokémon catalog to D1.');
  process.exit(0);
}

let resolvedGameId = gameId;
{
  if (local && process.env.CARDTELL_LOCAL_DIRECT === '1') {
    resolvedGameId = execFileSync('python3', ['scripts/apply-cardtell-import-sqlite.py', '--game-id'], { encoding: 'utf8' }).trim();
  } else {
    const existing = execFileSync('node_modules/.bin/wrangler', [
      'd1', 'execute', d1Name, ...(local ? ['--local', '--persist-to', '.wrangler/state'] : ['--remote']),
      '--config', d1Config, '--json', '--command', "SELECT id FROM tcg_games WHERE slug='pokemon' LIMIT 1",
    ], { encoding: 'utf8', env: { ...process.env, WRANGLER_LOG_PATH: join(tmpdir(), 'vivreplay-cardtell-import.log') } });
    const parsed = JSON.parse(existing) as Array<{ results?: Array<{ id?: string }> }>;
    resolvedGameId = parsed[0]?.results?.[0]?.id ?? gameId;
  }
}
for (const identity of identities) identity.game_id = resolvedGameId;
for (const set of setRows) set.game_id = resolvedGameId;
const batches: string[] = [];
function insert(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]!);
  const prefix = `INSERT OR IGNORE INTO \`${table}\` (${columns.map(column => `\`${column}\``).join(',')}) VALUES\n`;
  let values: string[] = [];
  let bytes = 0;
  const flush = () => { if (values.length) batches.push(`${prefix}${values.join(',\n')};`); values = []; bytes = 0; };
  for (const row of rows) {
    const value = `(${columns.map(column => literal(row[column])).join(',')})`;
    const size = Buffer.byteLength(value);
    if (size > 90_000) throw new Error(`${table} contains a row too large for D1.`);
    if (bytes + size + prefix.length > 70_000) flush();
    values.push(value);
    bytes += size + 2;
  }
  flush();
}
batches.push(`INSERT INTO \`tcg_games\` (\`id\`,\`slug\`,\`name\`) VALUES (${literal(resolvedGameId)},'pokemon','Pokémon Trading Card Game') ON CONFLICT(\`slug\`) DO UPDATE SET \`name\`=excluded.\`name\`;`);
insert('tcg_sets', setRows);
insert('tcg_card_identities', identities);
insert('tcg_card_localizations', localizations);
insert('tcg_card_printings', printings);
insert('tcg_card_rules', rules);
insert('tcg_card_asset_sources', assetSources);
const sqlPath = join(tmpdir(), `vivreplay-cardtell-pokemon-id-${Date.now()}.sql`);
writeFileSync(sqlPath, batches.join('\n'), { mode: 0o600 });
try {
  if (local && process.env.CARDTELL_LOCAL_DIRECT === '1') {
    execFileSync('python3', ['scripts/apply-cardtell-import-sqlite.py', sqlPath], { stdio: 'inherit' });
  } else {
    execFileSync('node_modules/.bin/wrangler', [
      'd1', 'execute', d1Name, ...(local ? ['--local', '--persist-to', '.wrangler/state'] : ['--remote']),
      '--config', d1Config, '--file', sqlPath, ...(local ? ['--yes'] : []),
    ], { stdio: 'inherit', env: { ...process.env, WRANGLER_LOG_PATH: join(tmpdir(), 'vivreplay-cardtell-import.log') } });
  }
} finally { rmSync(sqlPath, { force: true }); }
console.log(`Imported ${taxonomies.length} sets and ${printings.length} Indonesian printings into ${local ? 'local' : 'production'} D1${catalogOnly ? ' (source fields only; card type and rarity left blank until source filters are available)' : ''}. Images are served through VivrePlay routes and cached in R2 on first request.`);
