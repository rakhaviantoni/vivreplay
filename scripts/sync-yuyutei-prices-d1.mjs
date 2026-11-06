import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const endpoint = 'https://api.parse.bot/scraper/1d31f593-ebaf-4791-a047-2c9751946cee/get_all_cards';
const apiKey = process.env.PARSE_API_KEY;
if (!apiKey) throw new Error('PARSE_API_KEY is required.');

const now = new Date();
const dryRun = process.argv.includes('--dry-run');
const option = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const snapshotOutput = option('--snapshot');
const resumeSnapshot = process.argv.includes('--resume-snapshot');
const snapshotInput = option('--from-snapshot') ?? (resumeSnapshot ? snapshotOutput : undefined);
const snapshot = snapshotInput ? JSON.parse(await readFile(snapshotInput, 'utf8')) : null;
const observedAt = snapshot?.observedAt ?? now.toISOString();
const selectedDatabase = process.env.YUYUTEI_DATABASE ?? 'vivreplay';
const databases = [
  { name: 'vivreplay', config: 'dist/server/wrangler.json' },
  { name: 'vivreplay-staging', config: 'dist/server/wrangler.staging.json' },
].filter((target) => target.name === selectedDatabase || selectedDatabase === 'both');
if (!databases.length) throw new Error('Set YUYUTEI_DATABASE to vivreplay, vivreplay-staging, or both.');

const wrangler = path.join(root, 'node_modules/.bin/wrangler');
const wranglerEnv = {
  ...process.env,
  WRANGLER_WRITE_LOGS: 'false',
  WRANGLER_LOG_PATH: '/tmp/vivreplay-wrangler-logs',
  WRANGLER_SEND_METRICS: 'false',
};
const sqlString = (value) => `'${String(value ?? '').replaceAll("'", "''")}'`;
const stableId = (value) => {
  const bytes = createHash('sha256').update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const normalize = (value) => String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function execute(target, command, json = true) {
  const args = ['d1', 'execute', target.name, '--remote', '--config', target.config];
  if (json) args.push('--json');
  args.push('--command', command);
  return execFileSync(wrangler, args, {
    cwd: root,
    env: wranglerEnv,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function rowsFrom(output) {
  return JSON.parse(output).flatMap((batch) => batch.results ?? []);
}

function fetchCatalog(target) {
  const sql = `SELECT p.id,p.printing_code,p.variant,p.set_code,p.set_name,COALESCE(p.release_date,s.release_date) AS release_date,i.code AS identity_code FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id JOIN tcg_games g ON g.id=i.game_id LEFT JOIN tcg_sets s ON s.id=p.set_id WHERE g.slug='one-piece' AND p.language='JP' ORDER BY p.set_code,i.code,p.printing_code,p.id`;
  return rowsFrom(execute(target, sql));
}

function toVersion(setCode) {
  const normalized = normalize(setCode);
  if (normalized === 'P') return 'p';
  if (/^OP15EB04$/.test(normalized)) return 'op15';
  if (/^OP14EB04$/.test(normalized)) return 'op14';
  const match = normalized.match(/^(OP|EB|ST|PRB)0*(\d+)$/);
  return match ? `${match[1].toLowerCase()}${String(Number(match[2])).padStart(2, '0')}` : null;
}

async function fetchVersion(version) {
  let response;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      response = await fetch(`${endpoint}?${new URLSearchParams({ version, page: '1' })}`, {
        headers: { 'X-API-Key': apiKey },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      if (attempt === 3) throw error;
      await pause(Math.min(30_000, 2_000 * (attempt + 1)));
      continue;
    }
    if (response.ok) break;
    if (response.status === 429 || response.status >= 500) {
      if (attempt === 3) throw new Error(`Yuyutei scraper failed for ${version} (${response.status}).`);
      const retryAfter = Number(response.headers.get('retry-after') ?? 0) * 1_000;
      await pause(Math.max(retryAfter, Math.min(30_000, 2_000 * (attempt + 1))));
      continue;
    }
    throw new Error(`Yuyutei scraper failed for ${version} (${response.status}).`);
  }
  if (!response?.ok) throw new Error(`No response for Yuyutei version ${version}.`);
  const body = await response.json();
  const data = body.data ?? body;
  const cards = Array.isArray(data.cards) ? data.cards : [];
  const total = Number(data.total_results ?? cards.length);
  if (total > cards.length) {
    const pages = Math.ceil(total / cards.length);
    for (let page = 2; page <= pages; page += 1) {
      await pause(1_500);
      const pageResponse = await fetch(`${endpoint}?${new URLSearchParams({ version, page: String(page) })}`, {
        headers: { 'X-API-Key': apiKey },
        signal: AbortSignal.timeout(20_000),
      });
      if (!pageResponse.ok) throw new Error(`Yuyutei page ${page} failed for ${version} (${pageResponse.status}).`);
      const pageBody = await pageResponse.json();
      cards.push(...(pageBody.data?.cards ?? pageBody.cards ?? []));
    }
  }
  if (cards.length !== total) throw new Error(`Yuyutei returned ${cards.length} of ${total} records for ${version}.`);
  return cards.map((card) => ({ ...card, version: card.version ?? version }));
}

function isStandard(printing) {
  return /^(standard|base)$/i.test(printing.variant ?? 'standard') &&
    (!printing.printing_code || normalize(printing.printing_code) === normalize(printing.identity_code));
}

function isParallel(card) {
  return /パラレル|parallel|alternate|alt\s*art|sp\b|manga/i.test(String(card.card_name ?? ''));
}

function parallelOrder(printing) {
  return Number(printing.printing_code?.match(/_p(\d+)$/i)?.[1] ?? 999);
}

function mapPrices(catalog, sourceCards) {
  const byIdentitySet = new Map();
  const byIdentity = new Map();
  for (const printing of catalog) {
    const key = `${normalize(printing.identity_code)}|${normalize(printing.set_code)}`;
    byIdentitySet.set(key, [...(byIdentitySet.get(key) ?? []), printing]);
    const identityKey = normalize(printing.identity_code);
    byIdentity.set(identityKey, [...(byIdentity.get(identityKey) ?? []), printing]);
  }
  const grouped = new Map();
  for (const card of sourceCards) {
    const code = normalize(card.card_code).replace(/P\d+$/, '');
    const version = normalize(card.version);
    const amount = Number(card.price);
    const url = String(card.card_url ?? '');
    if (!code || !version || !Number.isFinite(amount) || amount < 0 || !url.startsWith('https://yuyu-tei.jp/')) continue;
    const key = `${version}|${code}`;
    grouped.set(key, [...(grouped.get(key) ?? []), card]);
  }
  const observations = [];
  const unmatched = [];
  let uniqueSetFallbacks = 0;
  for (const [key, cards] of grouped) {
    const [version, code] = key.split('|');
    let printings = byIdentitySet.get(`${code}|${version}`) ?? [];
    if (!printings.length) {
      const identityPrintings = byIdentity.get(code) ?? [];
      const identitySets = new Set(identityPrintings.map((printing) => normalize(printing.set_code)));
      if (identitySets.size === 1) {
        printings = identityPrintings;
        uniqueSetFallbacks += 1;
      }
    }
    const standard = printings.find(isStandard);
    const alternates = printings.filter((printing) => !isStandard(printing)).sort((a, b) => parallelOrder(a) - parallelOrder(b));
    const sourceStandard = cards.find((card) => !isParallel(card));
    const sourceAlternates = cards.filter(isParallel);
    if (sourceStandard && standard) observations.push({ printing: standard, card: sourceStandard });
    else if (sourceStandard) unmatched.push(`${sourceStandard.version}:${sourceStandard.card_code}:${sourceStandard.card_name}`);
    sourceAlternates.forEach((card, index) => {
      const printing = alternates[index];
      if (printing) observations.push({ printing, card });
      else unmatched.push(`${card.version}:${card.card_code}:${card.card_name}`);
    });
  }
  const unique = new Map();
  for (const entry of observations) unique.set(entry.printing.id, entry);
  return { observations: [...unique.values()], unmatched, uniqueSetFallbacks };
}

function insertBatches(target, statements) {
  for (let start = 0; start < statements.length; start += 30) {
    execute(target, statements.slice(start, start + 30).join(';\n'), false);
  }
}

function writePrices(target, entries) {
  const sourceRows = new Map();
  const prices = entries.map(({ printing, card }) => {
    const sourceUrl = String(card.card_url);
    const recordId = stableId(`yuyutei:${sourceUrl}:${observedAt}`);
    sourceRows.set(sourceUrl, { id: recordId, sourceUrl, payload: JSON.stringify(card) });
    return {
      printingId: printing.id,
      recordId,
      amount: Number(card.price),
    };
  });
  const sourceSql = [...sourceRows.values()].map((row) =>
    `INSERT INTO tcg_source_records (id,source,source_key,payload,observed_at,created_at) VALUES (${sqlString(row.id)},'yuyutei',${sqlString(row.sourceUrl)},${sqlString(row.payload)},${sqlString(observedAt)},${sqlString(observedAt)}) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,observed_at=excluded.observed_at`
  );
  const priceSql = prices.map((row) =>
    `INSERT INTO tcg_price_observations (id,printing_id,source,source_kind,amount,currency,observed_at,source_record_id) VALUES (${sqlString(stableId(`price:${row.printingId}:${observedAt}`))},${sqlString(row.printingId)},'yuyutei','market_price',${row.amount},'JPY',${sqlString(observedAt)},${sqlString(row.recordId)}) ON CONFLICT(printing_id,source,source_kind,observed_at) DO UPDATE SET amount=excluded.amount,currency=excluded.currency,source_record_id=excluded.source_record_id`
  );
  insertBatches(target, sourceSql);
  insertBatches(target, priceSql);
  return { sourceRecords: sourceRows.size, priceObservations: prices.length };
}

const sourceCatalog = fetchCatalog(databases[0]);
const releaseCodes = new Map();
for (const printing of sourceCatalog) {
  if (printing.release_date && printing.release_date > now.toISOString().slice(0, 10)) continue;
  const version = toVersion(printing.set_code);
  if (version) releaseCodes.set(version, printing.set_code);
}
const versions = [...releaseCodes.keys()].sort((a, b) => a.localeCompare(b));
console.log(`Refreshing ${versions.length} Japanese One Piece release price lists${dryRun ? ' (preview only)' : ''}.`);
const sourceCards = snapshot?.cards ?? [];
if (snapshot && !resumeSnapshot) {
  console.log(`Using ${sourceCards.length} saved Yuyutei listings from ${observedAt}.`);
} else {
  const completedVersions = new Set(snapshot?.completedVersions ?? []);
  for (const [index, version] of versions.entries()) {
    if (completedVersions.has(version)) continue;
    const rows = await fetchVersion(version);
    sourceCards.push(...rows);
    completedVersions.add(version);
    console.log(`${version}: ${rows.length} listings (${index + 1}/${versions.length})`);
    if (snapshotOutput) await writeFile(snapshotOutput, JSON.stringify({ observedAt, cards: sourceCards, completedVersions: [...completedVersions] }));
    await pause(1_500);
  }
}
for (const target of databases) {
  const catalog = target === databases[0] ? sourceCatalog : fetchCatalog(target);
  const { observations, unmatched, uniqueSetFallbacks } = mapPrices(catalog, sourceCards);
  const written = dryRun ? { sourceRecords: 0, priceObservations: 0 } : writePrices(target, observations);
  console.log(JSON.stringify({ database: target.name, observedAt, releases: versions.length, sourceListings: sourceCards.length, matchedPrintings: observations.length, uniqueSetFallbacks, ...written, unmatchedCount: unmatched.length, unmatched: unmatched.slice(0, 30) }, null, 2));
}
