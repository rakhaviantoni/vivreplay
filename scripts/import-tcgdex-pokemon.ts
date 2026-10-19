import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

type TcgLanguage = 'en' | 'id' | 'ja';
type ApiCard = {
  id: string; localId?: string; name?: string; image?: string; category?: string; rarity?: string;
  types?: string[]; hp?: number | string; stage?: string; evolvesFrom?: string; suffix?: string;
  description?: string; abilities?: Array<{ name?: string; effect?: string; type?: string }>;
  attacks?: Array<{ name?: string; cost?: string[]; damage?: number | string; effect?: string }>;
  weaknesses?: unknown[]; resistances?: unknown[]; retreat?: number; set?: { id?: string; name?: string; cardCount?: { total?: number } };
  [key: string]: unknown;
};
type ApiSet = { id: string; name?: string; releaseDate?: string; logo?: string; cardCount?: { total?: number }; cards?: Array<{ id: string }>; serie?: { name?: string } };

const api = 'https://api.tcgdex.net/v2';
const langs: TcgLanguage[] = ['id', 'en', 'ja'];
const concurrency = Math.max(1, Math.min(5, Number(process.env.TCGDEX_CONCURRENCY ?? 3) || 3));
const delayMs = Math.max(150, Number(process.env.TCGDEX_DELAY_MS ?? 300) || 300);
const maxSets = Number(process.env.TCGDEX_MAX_SETS ?? 0) || 0;
const apply = process.argv.includes('--apply');
const local = process.argv.includes('--local') || process.env.TCGDEX_TARGET === 'local';
const d1Name = process.env.TCGDEX_D1_NAME ?? 'vivreplay';
const d1Config = process.env.TCGDEX_D1_CONFIG ?? (local ? 'wrangler.migrations.json' : 'dist/server/wrangler.json');
const cacheDir = process.env.TCGDEX_CACHE_DIR ?? join(tmpdir(), 'vivreplay-tcgdex-cache');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function getJson<T>(url: string): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 7; attempt++) {
    await sleep(delayMs);
    try {
      const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'VivrePlayCatalog/1.0 (catalog import)' } });
      if (response.status === 404) throw Object.assign(new Error('Not found'), { notFound: true });
      if (!response.ok) throw new Error(`TCGdex returned ${response.status}`);
      return await response.json() as T;
    } catch (error) {
      if ((error as { notFound?: boolean }).notFound) throw error;
      last = error;
      if (attempt < 6) await sleep(900 * (attempt + 1));
    }
  }
  throw last instanceof Error ? last : new Error('TCGdex request failed.');
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      result[index] = await fn(items[index]!);
    }
  }));
  return result;
}

function stableId(key: string) {
  const bytes = createHash('sha256').update(`vivreplay:tcgdex:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function languageCode(language: TcgLanguage) { return language === 'ja' ? 'JP' : language.toUpperCase(); }
function safeCode(value: string) { return `PK-${value.toUpperCase().replace(/[^A-Z0-9_-]/g, '-')}`; }
function effectText(card: ApiCard) {
  const parts = [...(card.abilities ?? []).map(item => [item.type, item.name, item.effect].filter(Boolean).join(': ')), ...(card.attacks ?? []).map(item => [item.cost?.length ? `[${item.cost.join(', ')}]` : '', item.name, item.damage ? `(${item.damage})` : '', item.effect].filter(Boolean).join(' ')), card.effect].filter(Boolean);
  return parts.join('\n');
}
function imageUrl(image?: string) {
  if (!image) return null;
  try {
    const url = new URL(image);
    if (url.hostname !== 'assets.tcgdex.net' || url.protocol !== 'https:') return null;
    return `${url.toString().replace(/\/$/, '')}/high.webp`;
  } catch { return null; }
}
const startedAt = new Date().toISOString();
const fetched: Array<{ language: TcgLanguage; set: ApiSet; card: ApiCard }> = [];
const setNames = new Map<string, { id: string; name: string; releaseDate: string | null; logo: string | null }>();
const failedCards: string[] = [];
mkdirSync(cacheDir, { recursive: true });
function setCachePath(language: TcgLanguage, setId: string) {
  const safe = setId.replace(/[^A-Za-z0-9_-]/g, '_');
  return join(cacheDir, `${language}-${safe}.json`);
}

for (const language of langs) {
  const sets = await getJson<ApiSet[]>(`${api}/${language}/sets`);
  const ordered = [...sets].reverse().sort((a, b) => {
    const aAnniversary = /30th|30.{0,8}anniversary|anniversary.{0,8}30/i.test(`${a.id} ${a.name ?? ''}`);
    const bAnniversary = /30th|30.{0,8}anniversary|anniversary.{0,8}30/i.test(`${b.id} ${b.name ?? ''}`);
    if (aAnniversary !== bAnniversary) return aAnniversary ? -1 : 1;
    if (aAnniversary && bAnniversary) {
      const aMain = /^30th$/i.test(a.id) || /30th celebration/i.test(a.name ?? '');
      const bMain = /^30th$/i.test(b.id) || /30th celebration/i.test(b.name ?? '');
      if (aMain !== bMain) return aMain ? -1 : 1;
    }
    const aDate = a.releaseDate ?? '';
    const bDate = b.releaseDate ?? '';
    if (aDate && bDate && aDate !== bDate) return bDate.localeCompare(aDate);
    return 0;
  });
  const selected = maxSets ? ordered.slice(0, maxSets) : ordered;
  console.log(`${language}: ${selected.length} sets queued (${ordered[0]?.name ?? 'latest set'} first).`);
  let languageCount = 0;
  for (const setStub of selected) {
    const file = setCachePath(language, setStub.id);
    let set: ApiSet | undefined;
    let fullCards: Array<{ language: TcgLanguage; set: ApiSet; card: ApiCard }> | undefined;
    if (existsSync(file) && process.env.TCGDEX_REFRESH_CACHE !== '1') {
      try {
        const cached = JSON.parse(readFileSync(file, 'utf8')) as typeof fullCards;
        const cachedSet = cached?.[0]?.set;
        if (Array.isArray(cached) && cachedSet && cached.length === (cachedSet.cards ?? []).length) {
          fullCards = cached;
          set = cachedSet;
        }
      }
      catch { fullCards = undefined; }
    }
    if (!set) {
      try { set = await getJson<ApiSet>(`${api}/${language}/sets/${encodeURIComponent(setStub.id)}`); }
      catch (error) { failedCards.push(`${language}/${setStub.id} (set: ${error instanceof Error ? error.message : 'request failed'})`); continue; }
    }
    if (!fullCards) {
      const cards = set.cards ?? [];
      const fetchedCards = await pool(cards, concurrency, async card => {
        try { return { language, set, card: await getJson<ApiCard>(`${api}/${language}/cards/${encodeURIComponent(card.id)}`) }; }
        catch (error) {
          const message = error instanceof Error ? error.message : 'request failed';
          failedCards.push(`${language}/${card.id} (${message})`);
          console.warn(`Could not fetch ${language}/${card.id}: ${message}`);
          return null;
        }
      });
      fullCards = fetchedCards.filter((item): item is { language: TcgLanguage; set: ApiSet; card: ApiCard } => Boolean(item));
      if (fullCards.length === cards.length) writeFileSync(file, JSON.stringify(fullCards));
    }
    for (const result of fullCards) {
      fetched.push(result);
      languageCount++;
    }
    const key = set.id;
    const previous = setNames.get(key);
    if (!previous || language === 'en') setNames.set(key, { id: key, name: set.name ?? key, releaseDate: typeof set.releaseDate === 'string' ? set.releaseDate : null, logo: set.logo ?? null });
    console.log(`${language}: ${set.id}, ${languageCount.toLocaleString()} records so far.`);
  }
  console.log(`${language}: fetched ${languageCount.toLocaleString()} card records.`);
}

const uniqueCards = new Map<string, typeof fetched[number]>();
for (const item of fetched) uniqueCards.set(`${item.language}:${item.card.id}`, item);
const languageSummary = Object.fromEntries(langs.map(language => {
  const cards = [...uniqueCards.values()].filter(item => item.language === language);
  const sets = new Set(cards.map(item => item.set.id));
  return [languageCode(language), {
    setsWithCards: sets.size,
    cards: cards.length,
    rarities: [...new Set(cards.map(item => item.card.rarity).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)),
    illustrators: new Set(cards.map(item => item.card.illustrator).filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))).size,
    cardsWithIllustrator: cards.filter(item => typeof item.card.illustrator === 'string' && Boolean(item.card.illustrator.trim())).length,
    cardsWithImages: cards.filter(item => Boolean(imageUrl(item.card.image))).length,
  }];
}));
const summary = {
  source: 'tcgdex', languages: langs.map(languageCode), sets: setNames.size, cards: uniqueCards.size,
  byLanguage: languageSummary,
  cardsWithImages: [...uniqueCards.values()].filter(item => Boolean(imageUrl(item.card.image))).length,
  cardsWithoutImages: [...uniqueCards.values()].filter(item => !imageUrl(item.card.image)).length,
  sourceFailures: failedCards.length,
  sourceFailureExamples: failedCards.slice(0, 20),
  latestSet: [...setNames.values()].sort((a, b) => String(b.releaseDate).localeCompare(String(a.releaseDate)))[0]?.name ?? null,
};
console.log(JSON.stringify(summary, null, 2));
if (failedCards.length) {
  console.error(`Import stopped: ${failedCards.length} source records or sets could not be fetched. Fix or confirm these before applying.`);
  process.exit(2);
}
if (!apply) {
  console.log('Preview only. Run with --apply to write the normalized catalog to Cloudflare D1.');
  process.exit(0);
}

let gameId = stableId('game:pokemon');
if (apply && !local) {
  const existing = execFileSync('node_modules/.bin/wrangler', [
    'd1', 'execute', d1Name, '--remote', '--config', d1Config, '--json',
    '--command', "SELECT id FROM tcg_games WHERE slug='pokemon' LIMIT 1",
  ], { encoding: 'utf8', env: { ...process.env, WRANGLER_LOG_PATH: join(tmpdir(), 'vivreplay-tcgdex-import.log') } });
  const parsed = JSON.parse(existing) as Array<{ results?: Array<{ id?: string }> }>;
  gameId = parsed[0]?.results?.[0]?.id ?? gameId;
}
const setRows = [...setNames.values()].map(set => ({ id: stableId(`set:${set.id}`), game_id: gameId, external_set_id: set.id, name: set.name, set_kind: 'booster', release_date: set.releaseDate, product_image_url: set.logo ? `${set.logo.replace(/\/$/, '')}/low.webp` : null, created_at: startedAt }));
const setIds = new Map(setRows.map(row => [row.external_set_id, row.id]));

const identityByKey = new Map<string, Record<string, unknown>>();
const localizedRows: Record<string, unknown>[] = [];
const printingRows: Record<string, unknown>[] = [];
const ruleRows: Record<string, unknown>[] = [];
const assetSourceRows: Record<string, unknown>[] = [];
for (const item of uniqueCards.values()) {
  const card = item.card;
  const lang = languageCode(item.language);
  const identityCode = safeCode(card.id);
  const identityId = stableId(`identity:${card.id}`);
  const setId = card.set?.id ?? item.set.id;
  const type = card.category ?? 'Pokémon';
  const types = Array.isArray(card.types) ? card.types : [];
  const effect = effectText(card);
  const traits = [card.stage, card.suffix, card.evolvesFrom ? `Evolves from ${card.evolvesFrom}` : null].filter(Boolean);
  const identity = { id: identityId, game_id: gameId, code: identityCode, name: card.name ?? card.id, color: types.join('/ ') || 'Colorless', card_type: type, cost: 0, power: Number.parseInt(String(card.hp ?? 0), 10) || 0, effect_text: effect, created_at: startedAt, updated_at: startedAt };
  identityByKey.set(identityCode, identity);
  localizedRows.push({ identity_id: identityId, language: lang, name: card.name ?? card.id, effect_text: effect, traits_text: traits.join(' · '), updated_at: startedAt });
  const image = imageUrl(card.image);
  const printingId = stableId(`printing:${lang}:${card.id}`);
  printingRows.push({ id: printingId, identity_id: identityId, language: lang, set_id: setIds.get(setId) ?? stableId(`set:${setId}`), set_code: setId, set_name: card.set?.name ?? item.set.name ?? setId, rarity: card.rarity ?? 'Unknown', variant: 'Standard', source_kind: 'tcgdex', created_at: startedAt, sub_types: JSON.stringify(traits), counter_amount: 0, attribute: type, card_image_url: image, source_payload: JSON.stringify(card), printing_code: card.localId ?? card.id, release_date: item.set.releaseDate ?? null });
  ruleRows.push({ identity_id: identityId, colors: JSON.stringify(types), card_type: type, cost: 0, power: Number.parseInt(String(card.hp ?? 0), 10) || 0, counter_amount: 0, attributes: JSON.stringify([type, ...types]), traits: JSON.stringify(traits), rules_revision: 'tcgdex-v1', updated_at: startedAt });
  if (image) assetSourceRows.push({ id: stableId(`asset:${lang}:${card.id}`), printing_id: printingId, source_type: 'tcgdex', source_url: image, rights_status: 'source_attribution_pending_review', observed_at: startedAt, approved_for_display: false, approved_for_storage: false, created_at: startedAt, storage_variants: '{}' });
}
const quote = (value: unknown) => `'${String(value).replaceAll("'", "''")}'`;
const literal = (value: unknown) => value === null || value === undefined ? 'NULL'
  : typeof value === 'boolean' ? (value ? '1' : '0')
    : typeof value === 'number' && Number.isFinite(value) ? String(value)
      : typeof value === 'object' ? quote(JSON.stringify(value)) : quote(value);
const batches: string[] = [];
function insert(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]!);
  const prefix = `INSERT OR REPLACE INTO \`${table}\` (${columns.map(column => `\`${column}\``).join(',')}) VALUES\n`;
  let values: string[] = [];
  let bytes = 0;
  const flush = () => { if (values.length) batches.push(`${prefix}${values.join(',\n')};`); values = []; bytes = 0; };
  for (const row of rows) {
    const value = `(${columns.map(column => literal(row[column])).join(',')})`;
    const size = Buffer.byteLength(value);
    if (size > 90_000) throw new Error(`${table} has a row too large for a safe D1 statement.`);
    if (bytes + size + prefix.length > 70_000) flush();
    values.push(value); bytes += size + 2;
  }
  flush();
}
const identities = [...identityByKey.values()];
batches.push(`INSERT INTO \`tcg_games\` (\`id\`,\`slug\`,\`name\`) VALUES (${literal(gameId)},'pokemon','Pokémon Trading Card Game') ON CONFLICT(\`slug\`) DO UPDATE SET \`name\`=excluded.\`name\`;`);
insert('tcg_sets', setRows);
insert('tcg_card_identities', identities);
insert('tcg_card_localizations', localizedRows);
insert('tcg_card_printings', printingRows);
insert('tcg_card_rules', ruleRows);
insert('tcg_card_asset_sources', assetSourceRows);
const sqlPath = join(tmpdir(), `vivreplay-tcgdex-pokemon-${Date.now()}.sql`);
writeFileSync(sqlPath, batches.join('\n'), { mode: 0o600 });
try {
  execFileSync('node_modules/.bin/wrangler', ['d1', 'execute', d1Name, ...(local ? ['--local', '--persist-to', '.wrangler/state'] : ['--remote']), '--config', d1Config, '--file', sqlPath, ...(local ? ['--yes'] : [])], {
    stdio: 'inherit', env: { ...process.env, WRANGLER_LOG_PATH: join(tmpdir(), 'vivreplay-tcgdex-import.log') },
  });
} finally { rmSync(sqlPath, { force: true }); }
console.log(`Imported ${summary.sets} sets and ${summary.cards} localized printings into ${local ? 'local' : 'production'} D1. Images are served through VivrePlay's R2-backed cache proxy.`);
