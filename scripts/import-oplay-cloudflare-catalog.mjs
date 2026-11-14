import { createHash, randomUUID } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const apply = process.argv.includes('--apply');
const skipR2Upload = process.argv.includes('--skip-r2-upload');
const wrangler = path.join(root, 'node_modules/.bin/wrangler');
const execFileAsync = promisify(execFile);
const configPath = process.env.CLOUDFLARE_CONFIG ?? 'dist/server/wrangler.json';
const requestedSetCodes = new Set((process.env.OPLAY_IMPORT_SETS ?? '').split(',').map((value) => normalizeSetCode(value)).filter(Boolean));
const logPath = path.join(tmpdir(), 'vivreplay-oplay-import-wrangler.log');
const env = { ...process.env, WRANGLER_WRITE_LOGS: 'false', WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: logPath };
const browserHeaders = {
  accept: '*/*',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
  cookie: 'NEXT_LOCALE=en',
  pragma: 'no-cache',
  referer: 'https://oplaytcg.com/en/library',
  'sec-ch-ua': '"Not:A-Brand";v="8", "Chromium";v="156"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
};
const setConfigs = [
  { query: 'OP18', code: 'OP-18', name: 'The Dominance of God', releaseDate: '2026-11-20', kind: 'booster' },
  { query: 'EB05', code: 'EB-05', name: 'Extra Booster: One Piece Heroines Edition Vol.2', releaseDate: '2026-10-30', kind: 'booster' },
  { query: 'ST37,ST38', code: 'ST-37', name: 'Starter Deck 37', releaseDate: '2026-12-18', kind: 'starter' },
  { query: 'ST37,ST38', code: 'ST-38', name: 'Starter Deck 38', releaseDate: '2026-12-18', kind: 'starter' },
];
const id = (value) => {
  const bytes = createHash('sha256').update(`vivreplay-oplay:${value}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const literal = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replaceAll("'", "''")}'`;
};
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

function run(args, input) {
  return execFileSync(wrangler, args, { cwd: root, env, encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 });
}

async function runAsync(args) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await execFileAsync(wrangler, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 4 || !/fetch failed|network|timeout|429|502|503|504/i.test(String(error))) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(10_000, 1_000 * (2 ** attempt))));
    }
  }
  throw lastError;
}

function runRemoteWithRetry(args) {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try { return run(args); }
    catch (error) {
      lastError = error;
      if (attempt === 5 || !/fetch failed|network|timeout|429|502|503|504/i.test(String(error))) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(10_000, 1_000 * (2 ** attempt)));
      console.warn(`Cloudflare D1 connection failed; retrying (${attempt + 1}/5).`);
    }
  }
  throw lastError;
}

function d1Rows(output) {
  return JSON.parse(output).flatMap((batch) => batch.results ?? []);
}

function query(sql, config = configPath, dbName = 'vivreplay') {
  return d1Rows(run(['d1', 'execute', dbName, '--remote', '--config', config, '--json', '--command', sql]));
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: browserHeaders, signal: AbortSignal.timeout(25_000) });
      if (!response.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get('retry-after') ?? 0);
          await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1_000, 3_000 * (2 ** attempt))));
          continue;
        }
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1_000 * (2 ** attempt)));
    }
  }
  throw lastError;
}

async function bounded(items, limit, task) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await task(items[index], index);
    }
  }));
  return output;
}

async function getSetPages(setQuery, language) {
  const first = await fetchJson(`https://oplaytcg.com/api/cards?lang=${language}&page=1&pageSize=60&sets=${encodeURIComponent(setQuery)}`);
  const pages = [first];
  const count = Math.ceil(Number(first.total ?? first.items?.length ?? 0) / 60);
  for (let page = 2; page <= count; page += 1) {
    pages.push(await fetchJson(`https://oplaytcg.com/api/cards?lang=${language}&page=${page}&pageSize=60&sets=${encodeURIComponent(setQuery)}`));
  }
  const records = pages.flatMap((page) => page.items ?? []);
  if (records.length !== Number(first.total ?? records.length)) {
    throw new Error(`OPlay returned ${records.length} of ${first.total} ${setQuery}/${language} records.`);
  }
  return records;
}

function normalizeSetCode(code) {
  const upper = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = upper.match(/^(OP|EB|ST|PRB)(\d{2})$/);
  return match ? `${match[1]}-${match[2]}` : upper;
}

function englishText(detail) {
  return detail.texts?.find((text) => text.language_code === 'en') ?? {
    name: detail.name ?? '', effect: detail.effect ?? '',
  };
}

function typeName(type) {
  return ({ LEADER: 'Leader', CHARACTER: 'Character', EVENT: 'Event', STAGE: 'Stage', DON: 'DON!!' })[String(type).toUpperCase()] ?? String(type || 'Character');
}

function variantName(printing, preview, siblingRows) {
  if (preview) return 'Preview';
  const features = [...(printing.variants ?? []), ...(printing.stamps ?? [])].map((value) => String(value).trim()).filter(Boolean);
  const sourceVariant = String(printing.source_variant ?? '').toLowerCase();
  if (features.some((value) => /manga/i.test(value)) || sourceVariant === 'manga') return 'Manga';
  if (features.some((value) => /alternate art|alt(?:ernate)?\s*art/i.test(value))) return 'Alt art';
  if (features.some((value) => /super.?pre.?release/i.test(value)) || sourceVariant === 'super-pr') return 'Super pre-release';
  if (features.some((value) => /winner/i.test(value)) || sourceVariant === 'winner') return 'Winner';
  if (/celebration/.test(sourceVariant)) return 'Celebration pack';
  if (sourceVariant === 'base' || sourceVariant === '') return 'Standard';
  if (printing.distribution_type === 'promo') return 'Promo';
  if (/^p\d+$/i.test(sourceVariant)) return 'Alt art';
  const label = sourceVariant.replace(/[-_]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
  return label || 'Standard';
}

function printingSetCode(printing) {
  const folder = String(printing.image ?? '').match(/^https:\/\/cards\.oplaytcg\.com\/([^/]+)\//i)?.[1] ?? '';
  if (/^(OP|EB|ST|PRB)\d{2}$/i.test(folder)) return normalizeSetCode(folder);
  return normalizeSetCode(printing.set_code);
}

function uniqueVariant(base, siblingRows) {
  if (!siblingRows.some((row) => row.variant === base)) return base;
  let number = 2;
  while (siblingRows.some((row) => row.variant === `${base} ${number}`)) number += 1;
  return `${base} ${number}`;
}

async function main() {
  const selectedSetConfigs = requestedSetCodes.size
    ? setConfigs.filter((set) => requestedSetCodes.has(set.code))
    : setConfigs;
  if (!selectedSetConfigs.length) throw new Error(`No configured sets match OPLAY_IMPORT_SETS=${[...requestedSetCodes].join(',')}.`);
  const importSt012Repair = requestedSetCodes.size === 0;
  const setByQueryCode = new Map(selectedSetConfigs.map((set) => [set.query, set]));
  const selectedCodes = new Set(selectedSetConfigs.map((set) => set.code));
  const languageLists = await Promise.all(['en', 'jp'].map(async (language) => {
    const results = await Promise.all([...new Set(selectedSetConfigs.map((item) => item.query))].map((setQuery) => getSetPages(setQuery, language)));
    return { language, records: results.flat().map((record) => ({ ...record, requestedLanguage: language })) };
  }));
  const listRecords = languageLists.flatMap(({ language, records }) => records.filter((record) => record.srcLang === language && selectedCodes.has(normalizeSetCode(record.setCode))));
  const byIdentity = new Map();
  for (const record of listRecords) {
    const current = byIdentity.get(record.code);
    if (!current || record.requestedLanguage === 'en') byIdentity.set(record.code, record);
  }
  const codes = [...byIdentity.keys()];
  const detailCodes = codes.filter((code) => listRecords.some((record) => record.setCode && selectedCodes.has(normalizeSetCode(record.setCode)) && record.code === code && (record.imageStatus === 'official' || record.srcLang === 'jp')));
  const detailEntries = await bounded(detailCodes, 1, async (code) => {
    const entry = [code, await fetchJson(`https://oplaytcg.com/api/cards/${encodeURIComponent(code)}?lang=en`)];
    await new Promise((resolve) => setTimeout(resolve, 350));
    return entry;
  });
  const details = new Map(detailEntries);
  let st012Detail = { printings: [] };
  if (importSt012Repair) {
    try { st012Detail = JSON.parse(await readFile('/private/tmp/oplay-st01-012-live.json', 'utf8')); }
    catch { st012Detail = await fetchJson('https://oplaytcg.com/api/cards/ST01-012?lang=en'); }
  }

  const gameRows = query("SELECT id,slug FROM tcg_games WHERE slug='one-piece'");
  if (!gameRows[0]) throw new Error('One Piece game record is missing from production D1.');
  const gameId = gameRows[0].id;
  const normalizedSets = [...new Map(selectedSetConfigs.map((item) => [item.code, item])).values()];
  const neededSetCodes = [...new Set([...normalizedSets.map((item) => item.code), ...(importSt012Repair ? ['ST-01', 'OP-03', 'OP-05'] : [])])];
  const setRows = query(`SELECT id,external_set_id,name,release_date FROM tcg_sets WHERE game_id=${quote(gameId)} AND external_set_id IN (${neededSetCodes.map(quote).join(',')})`);
  const setIdByCode = new Map(setRows.map((row) => [row.external_set_id, row.id]));
  for (const set of normalizedSets) if (!setIdByCode.has(set.code)) setIdByCode.set(set.code, id(`set:${set.code}`));
  const identityRows = query(`SELECT id,code FROM tcg_card_identities WHERE game_id=${quote(gameId)} AND code IN (${codes.map(quote).join(',')})`);
  const identityIdByCode = new Map(identityRows.map((row) => [row.code, row.id]));
  for (const code of codes) if (!identityIdByCode.has(code)) identityIdByCode.set(code, id(`identity:${code}`));
  const identityIds = [...identityIdByCode.values()];
  const existingPrintings = query(`SELECT p.id,p.identity_id,p.language,p.set_code,p.variant,p.printing_code,p.card_image_url,p.source_payload FROM tcg_card_printings p WHERE p.identity_id IN (${identityIds.map(quote).join(',')})`);
  const currentSt012 = importSt012Repair ? query("SELECT p.id,p.identity_id,p.language,p.set_code,p.variant,p.printing_code,p.card_image_url,p.source_payload FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id WHERE i.code='ST01-012'") : [];
  const imageUrls = [...new Set([...listRecords.map((row) => row.image), ...(st012Detail.printings ?? []).map((printing) => printing.image)].filter(Boolean))];
  const existingSources = query(`SELECT id,source_url FROM tcg_card_asset_sources WHERE source_url IN (${imageUrls.map(quote).join(',') || "''"})`);
  const existingAssets = query(`SELECT id,printing_id,kind FROM tcg_card_assets WHERE printing_id IN (${[...new Set([...existingPrintings.map((row) => row.id), ...currentSt012.map((row) => row.id)])].map(quote).join(',') || "''"})`);
  const sourceIdByUrl = new Map(existingSources.map((row) => [row.source_url, row.id]));
  const assetIdByKey = new Map(existingAssets.map((row) => [`${row.printing_id}|${row.kind}`, row.id]));
  const printingRows = new Map(existingPrintings.map((row) => [`${row.identity_id}|${row.language}|${row.set_code}|${row.printing_code}`, row]));
  for (const row of currentSt012) printingRows.set(`${row.identity_id}|${row.language}|ST01-012-REPAIR|${row.printing_code}`, row);

  const now = new Date().toISOString();
  const setWrites = normalizedSets.map((set) => {
    const previous = setRows.find((row) => row.external_set_id === set.code);
    return { id: setIdByCode.get(set.code), game_id: gameId, external_set_id: set.code, name: previous?.name || set.name, set_kind: set.kind, created_at: now, release_date: set.releaseDate };
  });
  const identityWrites = [];
  const ruleWrites = [];
  const localizationWrites = [];
  const printingWrites = [];
  const sourceWrites = [];
  const assetWrites = [];
  const imageJobs = [];

  for (const code of codes) {
    const representative = byIdentity.get(code);
    const detail = details.get(code) ?? {
      name: representative.name, type: representative.type, cost: representative.cost, power: representative.power,
      life: representative.life, counter: representative.counter, colors: representative.colors, traits: [], effect: '',
      texts: [{ language_code: 'en', name: representative.name, effect: '' }],
    };
    const identityId = identityIdByCode.get(code);
    const en = englishText(detail);
    const colors = detail.colors ?? representative.colors ?? [];
    const traits = (detail.traits ?? []).map((trait) => typeof trait === 'string' ? trait : trait.name ?? trait.code).filter(Boolean);
    const cardType = typeName(detail.type ?? representative.type);
    const effect = en.effect ?? detail.effect ?? '';
    identityWrites.push({ id: identityId, game_id: gameId, code, name: en.name || representative.name, color: colors.join('/'), card_type: cardType, cost: Number(detail.cost ?? representative.cost ?? 0), power: Number(detail.power ?? representative.power ?? 0), effect_text: effect, created_at: now, updated_at: now });
    ruleWrites.push({ identity_id: identityId, colors: JSON.stringify(colors), card_type: cardType, cost: Number(detail.cost ?? representative.cost ?? 0), power: Number(detail.power ?? representative.power ?? 0), life: detail.life ?? representative.life ?? null, counter_amount: Number(detail.counter ?? representative.counter ?? 0), attributes: JSON.stringify(detail.attribute ? [detail.attribute] : []), traits: JSON.stringify(traits), updated_at: now });
    for (const text of detail.texts ?? []) {
      const language = text.language_code === 'en' ? 'EN' : text.language_code === 'jp' ? 'JP' : null;
      if (!language || !text.name) continue;
      localizationWrites.push({ identity_id: identityId, language, name: text.name, effect_text: text.effect ?? '', traits_text: traits.join(' / '), updated_at: now });
    }
  }

  const samePrintVariants = new Map();
  const importRows = [...listRecords];
  for (const printing of st012Detail.printings ?? []) {
    if (!['en', 'jp'].includes(printing.language_code)) continue;
    const language = printing.language_code.toUpperCase();
    const sourceId = printing.source_id;
    if (!sourceId || !printing.image) continue;
    importRows.push({
      code: 'ST01-012', name: englishText(st012Detail).name, setCode: printing.set_code,
      sourceId, srcLang: printing.language_code, imageStatus: printing.image_status,
      spoiler: false, releaseDate: st012Detail.releaseDate, rarity: printing.rarity_code,
      requestedLanguage: language.toLowerCase(), image: printing.image, st012Repair: true,
    });
  }

  for (const record of importRows) {
    const representative = byIdentity.get(record.code) ?? record;
    const detail = record.st012Repair ? st012Detail : details.get(record.code) ?? {
      name: representative.name, type: representative.type, cost: representative.cost, power: representative.power,
      life: representative.life, counter: representative.counter, colors: representative.colors, traits: [], effect: '',
      texts: [{ language_code: record.srcLang, name: record.name ?? representative.name, effect: '' }], printings: [],
    };
    const sourceId = record.sourceId;
    const language = String(record.srcLang).toUpperCase();
    if (!['EN', 'JP'].includes(language)) continue;
    const actual = (detail.printings ?? []).find((printing) => printing.source_id === sourceId && printing.language_code.toUpperCase() === language);
    if (!actual && !record.st012Repair && record.imageStatus === 'official') throw new Error(`OPlay detail is missing ${record.code} ${sourceId} ${language}.`);
    const printingDetail = actual ?? { source_variant: sourceId === record.code ? 'base' : 'p1', image: record.image, variants: [], stamps: [] };
    const preview = Boolean(record.spoiler || record.imageStatus === 'placeholder');
    const setCode = record.st012Repair ? printingSetCode(actual) : normalizeSetCode(record.setCode);
    const setMeta = record.st012Repair ? null : setByQueryCode.get(record.setCode);
    const setId = setIdByCode.get(setCode) ?? (setMeta ? setIdByCode.get(setMeta.code) : null);
    if (!setId) throw new Error(`No D1 set ID for ${record.setCode} (${setCode}).`);
    const siblingKey = `${record.code}|${language}|${setCode}`;
    const siblings = samePrintVariants.get(siblingKey) ?? [];
    const rawVariant = variantName(printingDetail, preview, siblings);
    const variant = uniqueVariant(rawVariant, siblings);
    siblings.push({ variant });
    samePrintVariants.set(siblingKey, siblings);
    const identityId = identityIdByCode.get(record.code) ?? currentSt012[0]?.identity_id;
    if (!identityId) throw new Error(`No identity ID for ${record.code}.`);
    const printingCode = sourceId;
    const existingKey = `${identityId}|${language}|${setCode}|${printingCode}`;
    let previous = printingRows.get(existingKey);
    if (!previous && record.st012Repair) previous = currentSt012.find((row) => row.language === language && row.printing_code === sourceId);
    if (!previous && record.st012Repair) {
      const previousCode = sourceId === 'tcg-418873' ? 'ST01-012_p7' : sourceId === 'tcg-519815' ? 'ST01-012_p8' : sourceId === 'tcg-580050' ? 'ST01-012_p9' : sourceId;
      previous = currentSt012.find((row) => row.language === language && row.printing_code === previousCode);
    }
    const printingId = previous?.id ?? id(`printing:${record.code}:${language}:${setCode}:${printingCode}`);
    const imageUrl = actual?.image ?? record.image ?? null;
    const setName = record.st012Repair ? setRows.find((row) => row.external_set_id === setCode)?.name ?? setCode : setMeta?.name ?? setCode;
    const sourcePayload = {
      source: 'oplaytcg', source_id: sourceId, source_variant: printingDetail.source_variant ?? 'base',
      distribution_type: printingDetail.distribution_type ?? null, distribution_raw: printingDetail.distribution_raw ?? null,
      variants: printingDetail.variants ?? [], stamps: printingDetail.stamps ?? [], print_block: printingDetail.print_block ?? null,
      is_reprint: Boolean(printingDetail.is_reprint), spoiler: preview, image_status: imageUrl ? 'official' : 'placeholder',
      observed_at: now,
    };
    const row = {
      id: printingId, identity_id: identityId, language, set_id: setId, set_code: setCode, set_name: setName,
      rarity: record.rarity || actual?.rarity_code || detail.rarity || 'C', variant,
      source_kind: preview ? 'oplaytcg-preview' : 'oplaytcg-api', created_at: previous?.created_at ?? now,
      life: detail.life ?? null, sub_types: (detail.traits ?? []).map((trait) => typeof trait === 'string' ? trait : trait.name ?? trait.code).filter(Boolean).join(' / '),
      counter_amount: Number(detail.counter ?? 0), attribute: detail.attribute ?? null,
      asset_source_id: null, card_image_id: imageUrl ? sourceId : null, card_image_url: imageUrl,
      source_payload: JSON.stringify(sourcePayload), printing_code: printingCode,
      release_date: record.releaseDate ?? detail.releaseDate ?? null, is_reprint: Boolean(printingDetail.is_reprint),
    };
    printingWrites.push(row);
    if (imageUrl) {
      const key = `one-piece/${setCode.replaceAll('-', '')}/${language.toLowerCase()}/${printingCode}.webp`;
      const sourceRecordId = sourceIdByUrl.get(imageUrl) ?? id(`source:${imageUrl}`);
      row.asset_source_id = sourceRecordId;
      sourceWrites.push({ id: sourceRecordId, printing_id: printingId, source_type: 'oplaytcg', source_url: imageUrl, rights_status: 'official_release', observed_at: now, storage_path: key, approved_for_display: 1, approved_for_storage: 1, created_at: now, storage_variants: JSON.stringify({ small: key }), stored_format: 'webp' });
      assetWrites.push({ id: assetIdByKey.get(`${printingId}|small`) ?? id(`asset:${printingId}:small`), printing_id: printingId, source_id: sourceRecordId, kind: 'small', object_key: key, mime_type: 'image/webp', width: 420, created_at: now });
      imageJobs.push({ url: imageUrl, key });
    }
    printingRows.set(existingKey, row);
  }

  const summary = {
    apiAccess: 'browser headers accepted',
    setPrintings: Object.fromEntries(normalizedSets.map((set) => [set.code, printingWrites.filter((row) => row.set_code === set.code).length])),
    printingsByLanguage: { EN: printingWrites.filter((row) => row.language === 'EN').length, JP: printingWrites.filter((row) => row.language === 'JP').length },
    previews: printingWrites.filter((row) => row.source_kind === 'oplaytcg-preview').length,
    officialImages: imageJobs.length,
    identities: identityWrites.length,
    setRows: setWrites.map((row) => ({ code: row.external_set_id, name: row.name, releaseDate: row.release_date })),
    st012Printings: printingWrites.filter((row) => row.identity_id === currentSt012[0]?.identity_id).map(({ language, set_code, printing_code, variant, card_image_url }) => ({ language, set_code, printing_code, variant, image: card_image_url })),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log('Dry run only. Pass --apply to upload OPlay images and write production D1.');
    return;
  }

  if (!skipR2Upload) {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'vivreplay-oplay-r2-'));
    const failures = [];
    let uploaded = 0;
    try {
      await bounded(imageJobs, 5, async (job) => {
        try {
          let response;
          let lastError;
          for (let attempt = 0; attempt < 5; attempt += 1) {
            try {
              response = await fetch(job.url, { headers: browserHeaders, signal: AbortSignal.timeout(25_000) });
              if (response.ok) break;
              throw new Error(`Image HTTP ${response.status}`);
            } catch (error) {
              lastError = error;
              if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 800 * (2 ** attempt)));
            }
          }
          if (!response?.ok) throw lastError ?? new Error('Image request failed');
          const contentType = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
          if (!contentType.startsWith('image/')) throw new Error(`Unexpected content type ${contentType}`);
          const bytes = Buffer.from(await response.arrayBuffer());
          if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw new Error(`Unexpected image size ${bytes.length}`);
          const file = path.join(temporaryDirectory, `${createHash('sha1').update(job.key).digest('hex')}.webp`);
          await writeFile(file, bytes, { mode: 0o600 });
          await runAsync(['r2', 'object', 'put', `tcg-card-images/${job.key}`, '--file', file, '--remote', '--force', '--content-type', 'image/webp', '--cache-control', 'public, max-age=31536000, immutable', '--config', configPath]);
          uploaded += 1;
          if (uploaded % 25 === 0 || uploaded === imageJobs.length) console.log(`Uploaded ${uploaded}/${imageJobs.length} OPlay images to the shared catalog bucket.`);
        } catch (error) {
          failures.push({ key: job.key, error: error instanceof Error ? error.message : String(error) });
        }
      });
      if (failures.length) throw new Error(`R2 image upload failures (${failures.length}/${imageJobs.length}): ${JSON.stringify(failures.slice(0, 10))}`);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  } else {
    console.log(`Skipping R2 upload; ${imageJobs.length} catalog image records are already available in the shared bucket.`);
  }

  const tableRows = [
    ['tcg_sets', setWrites], ['tcg_card_identities', identityWrites], ['tcg_card_rules', ruleWrites],
    ['tcg_card_localizations', localizationWrites], ['tcg_card_printings', printingWrites],
    ['tcg_card_asset_sources', sourceWrites], ['tcg_card_assets', assetWrites],
  ];
  const statements = [];
  const upsertSpec = {
    tcg_sets: 'id', tcg_card_identities: 'id', tcg_card_rules: 'identity_id',
    tcg_card_localizations: 'identity_id,language', tcg_card_printings: 'id',
    tcg_card_asset_sources: 'source_url', tcg_card_assets: 'printing_id,kind',
  };
  for (const [table, rows] of tableRows) {
    const unique = [...new Map(rows.map((row) => [
      table === 'tcg_card_asset_sources' ? row.source_url : table === 'tcg_card_assets' ? `${row.printing_id}|${row.kind}` : table === 'tcg_card_localizations' ? `${row.identity_id}|${row.language}` : table === 'tcg_card_rules' ? row.identity_id : row.id,
      row,
    ])).values()];
    for (const row of unique) {
      const columns = Object.keys(row);
      const conflict = upsertSpec[table].split(',');
      const updates = columns.filter((column) => !conflict.includes(column)).map((column) => `\`${column}\`=excluded.\`${column}\``).join(',');
      statements.push(`INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(',')}) VALUES (${columns.map((column) => literal(row[column])).join(',')}) ON CONFLICT(${conflict.map((column) => `\`${column}\``).join(',')}) DO UPDATE SET ${updates};`);
    }
  }
  for (let index = 0; index < statements.length; index += 25) {
    const sqlFile = path.join(tmpdir(), `vivreplay-oplay-${index}.sql`);
    await writeFile(sqlFile, `${statements.slice(index, index + 25).join('\n')}\n`, { mode: 0o600 });
    try { runRemoteWithRetry(['d1', 'execute', 'vivreplay', '--remote', '--config', configPath, '--file', sqlFile, '--yes']); }
    finally { await rm(sqlFile, { force: true }); }
  }
  const stalePreviewAssets = `DELETE FROM tcg_card_assets WHERE printing_id IN (SELECT p.id FROM tcg_card_printings p JOIN tcg_sets s ON s.id=p.set_id WHERE s.external_set_id='OP-18' AND p.source_kind='oplaytcg-preview' AND p.card_image_url IS NULL);`;
  runRemoteWithRetry(['d1', 'execute', 'vivreplay', '--remote', '--config', configPath, '--command', stalePreviewAssets, '--yes']);
  console.log('Production D1 and shared catalog R2 updated. Staging reads the same catalog bucket; rebuild/deploy to publish the new cache revision.');
}

await main();
