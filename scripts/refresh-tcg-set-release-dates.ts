import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

type SetRow = { id: string; game_id: string; external_set_id: string; name: string; game: { slug: string } | { slug: string }[] };
type ReleaseEntry = { code: string; date: string; source: string };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.');
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
const apply = process.argv.includes('--apply');
const target = process.env.TCG_SET_D1_TARGET === 'local' ? 'local' : 'remote';
const d1Config = process.env.TCG_SET_D1_CONFIG ?? 'dist/server/wrangler.json';

const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function tcgdexJson<T>(url: string) {
  let failure: unknown;
  for (let attempt = 0; attempt < 7; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error(`TCGdex returned ${response.status} for ${url}`);
      return await response.json() as T;
    } catch (error) {
      failure = error;
      if (attempt < 6) await sleep(500 * (attempt + 1));
    }
  }
  throw failure instanceof Error ? failure : new Error(`Could not fetch ${url}`);
}

async function requestText(url: string) {
  let failure: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: 'text/html,application/json', 'user-agent': 'VivrePlay set release date catalog refresh' } });
      if (!response.ok) throw new Error(`${response.status} from ${url}`);
      return await response.text();
    } catch (error) {
      failure = error;
      if (attempt < 4) await sleep(400 * (attempt + 1));
    }
  }
  throw failure instanceof Error ? failure : new Error(`Could not fetch ${url}`);
}

function decodeHtml(value: string) {
  return value.replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/&ndash;|&#8211;/gi, '–').replace(/&mdash;|&#8212;/gi, '—');
}

function plainText(value: string) {
  return decodeHtml(value.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function productCode(value: string) {
  const match = value.match(/\b(OP|ST|EB|PRB)\s*-?\s*(\d{1,2})(?:\s*-?\s*(EB)\s*-?\s*(\d{2}))?\b/i);
  return match ? normalizeCode(`${match[1]}${match[2]}${match[3] ? `${match[3]}${match[4]}` : ''}`) : undefined;
}

function officialProductLinks(html: string) {
  const links: Array<{ url: string; code: string }> = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[2]!);
    const url = new URL(href, 'https://en.onepiece-cardgame.com/products/');
    if (!/\/products\/(?:[^/]+\/)*[^/]+\.(?:html?|php)\/?$/i.test(url.pathname)) continue;
    const code = productCode(`${plainText(match[3]!)} ${url.pathname}`);
    if (code) links.push({ url: url.href, code });
  }
  return links;
}

function releaseDate(html: string) {
  const text = plainText(html);
  const match = text.match(/(?:Release Date|AVAILABLE)\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i);
  if (!match) return undefined;
  const date = new Date(`${match[1]} UTC`);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString().slice(0, 10);
}

async function scrapeOnePieceReleaseDates(catalogCodes: Set<string>) {
  if (catalogCodes.has('OP14') || catalogCodes.has('EB04')) catalogCodes.add('OP14EB04');
  const base = 'https://en.onepiece-cardgame.com/products/';
  const firstPage = await requestText(base);
  const pageNumbers = [...firstPage.matchAll(/[?&]page=(\d+)/gi)].map(match => Number(match[1])).filter(Number.isFinite);
  const lastPage = Math.max(1, ...pageNumbers);
  const pages = [firstPage, ...await Promise.all(Array.from({ length: lastPage - 1 }, (_, index) => requestText(`${base}?page=${index + 2}`)))];
  const candidates = new Map<string, string>();
  for (const html of pages) for (const link of officialProductLinks(html)) {
    if (catalogCodes.has(link.code)) candidates.set(`${link.code}|${link.url}`, link.url);
  }

  const linkedCodes = new Set([...candidates.keys()].map(key => key.slice(0, key.indexOf('|'))));
  for (const code of catalogCodes) {
    if (linkedCodes.has(code)) continue;
    const match = code.match(/^(OP|ST|EB|PRB)(\d+)(EB\d+)?$/);
    if (!match) continue;
    const [, family, number, suffix] = match;
    const padded = number!.padStart(2, '0');
    const paths = family === 'ST'
      ? [Number(number) >= 15 && Number(number) <= 20 ? 'decks/st15-20.php' : `decks/st${padded}.php`, `st${padded}.html`]
      : family === 'OP' && suffix
        ? [`boosters/op${padded}-${suffix!.toLowerCase()}.php`, `boosters/op${padded}${suffix!.toLowerCase()}.php`, `boosters/op${padded}/`]
        : family === 'OP'
          ? [`boosters/op${padded}.php`, `boosters/op${padded}/`]
          : [`boosters/${family!.toLowerCase()}${padded}.php`, `boosters/${family!.toLowerCase()}${padded}/`];
    for (const path of paths) candidates.set(`${code}|${new URL(path, base).href}`, new URL(path, base).href);
  }

  const rows: ReleaseEntry[] = [];
  const seen = new Set<string>();
  for (const [key, url] of candidates) {
    const code = key.slice(0, key.indexOf('|'));
    if (seen.has(code)) continue;
    try {
      const date = releaseDate(await requestText(url));
      if (date) { rows.push({ code, date, source: url }); seen.add(code); }
    } catch (error) {
      console.warn(`Could not read Bandai release date at ${url}: ${error instanceof Error ? error.message : 'request failed'}`);
    }
  }
  const combinedEnglishSet = rows.find(row => row.code === 'OP14EB04');
  if (combinedEnglishSet && catalogCodes.has('OP14')) rows.push({ ...combinedEnglishSet, code: 'OP14' });
  if (catalogCodes.has('EB04')) rows.push({ code: 'EB04', date: '2026-01-31', source: 'https://www.bandai.co.jp/catalog/item.php?jan_cd=4582769937613000' });
  return rows;
}

async function scrapePokemonReleaseDates() {
  const setSources = new Map<string, { id: string; languages: string[]; date?: string }>();
  for (const language of ['en', 'id', 'ja']) {
    const sets = await tcgdexJson<Array<{ id?: string; releaseDate?: string }>>(`https://api.tcgdex.net/v2/${language}/sets`);
    if (!sets) throw new Error(`TCGdex ${language} set index was unavailable.`);
    for (const set of sets) {
      if (!set.id) continue;
      const key = normalizeCode(set.id);
      const previous = setSources.get(key);
      setSources.set(key, {
        id: set.id,
        languages: [...new Set([...(previous?.languages ?? []), language])],
        date: language === 'en' && set.releaseDate ? set.releaseDate : previous?.date ?? set.releaseDate,
      });
    }
  }
  const candidates = [...setSources.entries()];
  const rows: ReleaseEntry[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (cursor < candidates.length) {
      const [code, set] = candidates[cursor++]!;
      if (set.date && /^\d{4}-\d{2}-\d{2}$/.test(set.date)) {
        rows.push({ code, date: set.date, source: `https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(set.id)}` });
        continue;
      }
      for (const language of ['en', ...set.languages.filter(value => value !== 'en')]) {
        try {
          const detail = await tcgdexJson<{ releaseDate?: string }>(`https://api.tcgdex.net/v2/${language}/sets/${encodeURIComponent(set.id)}`);
          if (!detail) continue;
          if (detail.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(detail.releaseDate)) {
            rows.push({ code, date: detail.releaseDate, source: `https://api.tcgdex.net/v2/${language}/sets/${encodeURIComponent(set.id)}` });
            break;
          }
        } catch (error) {
          if (language === set.languages.at(-1)) console.warn(`Could not read TCGdex release date for ${set.id}: ${error instanceof Error ? error.message : 'request failed'}`);
        }
      }
    }
  }));
  return rows;
}

const { data: sets, error: setsError } = await supabase.from('tcg_sets')
  .select('id,game_id,external_set_id,name,game:tcg_games!inner(slug)');
if (setsError) throw new Error(`Could not read catalog sets: ${setsError.message}`);
const supabaseSets = (sets ?? []) as SetRow[];
const d1Output = execFileSync('node_modules/.bin/wrangler', [
  'd1', 'execute', 'vivreplay', target === 'local' ? '--local' : '--remote', '--config', d1Config, '--json',
  '--command', 'SELECT s.id,s.game_id,s.external_set_id,s.name,g.slug AS game_slug FROM tcg_sets s JOIN tcg_games g ON g.id=s.game_id WHERE g.slug IN (\'pokemon\',\'one-piece\')',
], { encoding: 'utf8' });
const d1Payload = JSON.parse(d1Output) as Array<{ results?: Array<{ id: string; game_id: string; external_set_id: string; name: string; game_slug: string }> }>;
const d1Sets = (d1Payload[0]?.results ?? []).map(set => ({ ...set, game: { slug: set.game_slug } }));
const allSets = [...new Map([...supabaseSets, ...d1Sets].map(set => [`${Array.isArray(set.game) ? set.game[0]?.slug : set.game?.slug}:${set.id}`, set])).values()];
const onePiece = allSets.filter(set => (Array.isArray(set.game) ? set.game[0]?.slug : set.game?.slug) === 'one-piece');
const pokemon = allSets.filter(set => (Array.isArray(set.game) ? set.game[0]?.slug : set.game?.slug) === 'pokemon');
const [opDates, pokemonDates] = await Promise.all([
  scrapeOnePieceReleaseDates(new Set(onePiece.map(set => normalizeCode(set.external_set_id)))),
  scrapePokemonReleaseDates(),
]);
const updates = allSets.flatMap(set => {
  const key = normalizeCode(set.external_set_id);
  const source = (Array.isArray(set.game) ? set.game[0]?.slug : set.game?.slug) === 'pokemon' ? 'pokemon' : 'one-piece';
  const entry = (source === 'pokemon' ? pokemonDates : opDates).find(row => row.code === key);
  return entry ? [{ ...set, release_date: entry.date, source_url: entry.source }] : [];
});
const missing = allSets.filter(set => !updates.some(row => row.id === set.id));
const report = {
  mode: apply ? 'apply' : 'dry-run',
  onePiece: { sets: onePiece.length, datesFound: opDates.length },
  pokemon: { sets: pokemon.length, datesFound: pokemonDates.length },
  updates: updates.length,
  missingCount: missing.length,
  missing: missing.slice(0, 30).map(set => ({ game: Array.isArray(set.game) ? set.game[0]?.slug : set.game?.slug, code: set.external_set_id, name: set.name })),
  samples: updates.slice(0, 12).map(({ external_set_id, name, release_date, source_url }) => ({ code: external_set_id, name, release_date, source_url })),
  st18: updates.filter(row => normalizeCode(row.external_set_id) === 'ST18').map(({ external_set_id, release_date, source_url }) => ({ code: external_set_id, release_date, source_url })),
};
console.log(JSON.stringify(report, null, 2));
if (!apply) {
  console.log('Preview only. Pass --apply to update Supabase and the catalog D1 database.');
  process.exit(0);
}

const supabaseIds = new Set(supabaseSets.map(set => set.id));
for (const row of updates.filter(row => supabaseIds.has(row.id))) {
  const { error } = await supabase.from('tcg_sets').update({ release_date: row.release_date }).eq('id', row.id);
  if (error) throw new Error(`Could not update ${row.external_set_id}: ${error.message}`);
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const assignments = updates.map(row => `WHEN ${quote(row.id)} THEN ${quote(row.release_date)}`).join(' ');
const ids = updates.map(row => quote(row.id)).join(',');
const sqlPath = join(tmpdir(), `tcg-set-release-dates-${Date.now()}.sql`);
writeFileSync(sqlPath, `UPDATE tcg_sets SET release_date=CASE id ${assignments} ELSE release_date END WHERE id IN (${ids});`, { mode: 0o600 });
try {
  execFileSync('node_modules/.bin/wrangler', ['d1', 'execute', 'vivreplay', target === 'local' ? '--local' : '--remote', '--config', d1Config, '--file', sqlPath], { stdio: 'inherit' });
} finally {
  rmSync(sqlPath, { force: true });
}
const readbackText = execFileSync('node_modules/.bin/wrangler', [
  'd1', 'execute', 'vivreplay', target === 'local' ? '--local' : '--remote', '--config', d1Config, '--json',
  '--command', "SELECT s.external_set_id,s.release_date FROM tcg_sets s JOIN tcg_games g ON g.id=s.game_id WHERE g.slug='one-piece' AND upper(replace(replace(s.external_set_id,'-',''),'_',''))='ST18'",
], { encoding: 'utf8' });
const readback = JSON.parse(readbackText) as Array<{ results?: Array<{ external_set_id: string; release_date: string | null }> }>;
const st18Readback = readback[0]?.results ?? [];
if (!st18Readback.length || st18Readback.some(row => row.release_date !== '2024-10-25')) throw new Error(`ST-18 D1 readback failed: ${JSON.stringify(st18Readback)}`);
console.log(JSON.stringify({ updatedSetRows: updates.length, target, st18Readback }, null, 2));
