import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const option = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const hasFlag = (name) => args.includes(`--${name}`);
const help = args.includes('--help') || args.includes('-h');
const concurrency = Math.max(1, Math.min(3, Number(option('concurrency', '2')) || 2));
const limit = Math.max(0, Number(option('limit', '0')) || 0);
const origin = String(option('origin', process.env.POKEMON_CATALOG_ORIGIN || 'https://vivreplay.com')).replace(/\/$/, '');
const output = resolve(option('output', join(tmpdir(), 'vivreplay-cardtell-pokemon-ocr', 'review.jsonl')));
const bucket = process.env.CARD_IMAGES_BUCKET || 'tcg-card-images';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = hasFlag('dry-run');

if (help) {
  console.log(`Cardtell Pokémon OCR batch

Usage:
  npm run catalog:ocr-cardtell -- [options]

Options:
  --limit=N             Process at most N cards (default: all)
  --concurrency=N       Browser OCR workers, 1 to 3 (default: 2)
  --origin=URL          VivrePlay origin for image fallback
  --output=PATH         JSONL review file (default: a resumable file in the OS temp folder)
  --dry-run             List eligible cards without starting OCR

The script reads Cardtell Indonesian printings and stored card images. It writes OCR
lines and confidence scores to JSONL for review. It never writes OCR guesses to the catalog.
Failed rows are retried on the next run; completed rows are skipped.`);
  process.exit(0);
}
if (!supabaseUrl || !supabaseKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.');

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
const parseJson = (value) => {
  if (typeof value === 'string') { try { return JSON.parse(value); } catch { return {}; } }
  return value && typeof value === 'object' ? value : {};
};
const contentText = (value) => typeof value === 'string' && value.trim().length > 0;
const hasExactText = (payload) => {
  const description = String(payload.description ?? '').trim();
  const looksLikeCatalogLabel = /^[^·•]{1,100}\s*[·•]\s*[A-Za-z0-9][A-Za-z0-9/-]*$/.test(description);
  const textFields = ['effect', 'effectText', 'effect_text', 'trainerEffect', 'trainerEffectText', 'rulesText', 'ruleText', 'cardText', 'card_text', 'text'];
  if (textFields.some((field) => contentText(payload[field])) || (contentText(description) && !looksLikeCatalogLabel)) return true;
  if (Array.isArray(payload.attacks) && payload.attacks.some((item) => item && (contentText(item.name) || contentText(item.effect)))) return true;
  if (Array.isArray(payload.abilities) && payload.abilities.some((item) => item && (contentText(item.name) || contentText(item.effect)))) return true;
  return false;
};
const localNumber = (row, payload) => {
  const direct = String(payload.localId ?? payload.collectorNumber ?? '').trim();
  if (direct) return direct.split('/')[0];
  const description = String(payload.shortDescription ?? '').trim() || String(payload.description ?? '').trim();
  const match = description.match(/(?:^|\s|[·•])([A-Za-z0-9]+(?:\/[A-Za-z0-9]+)?)\s*$/)?.[1];
  return match?.split('/')[0] || String(row.printing_code ?? '').replace(/^CT-/, '');
};
const completed = new Set();
if (existsSync(output)) {
  for (const line of readFileSync(output, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { const row = JSON.parse(line); if (row.status === 'complete' && row.printingId) completed.add(row.printingId); } catch { /* Ignore a partial final line. */ }
  }
}

async function loadCandidates() {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from('tcg_card_printings')
      .select('id,identity_id,language,set_code,set_name,printing_code,rarity,card_image_url,source_payload,tcg_card_assets(kind,object_key,width),tcg_card_identities!inner(name,effect_text)')
      .eq('source_kind', 'cardtell').eq('language', 'ID').order('id').range(from, from + 499);
    if (error) throw new Error(`Could not load Cardtell printings: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  const eligible = rows.filter((row) => {
    if (completed.has(row.id)) return false;
    const payload = parseJson(row.source_payload);
    const identity = Array.isArray(row.tcg_card_identities) ? row.tcg_card_identities[0] : row.tcg_card_identities;
    return !hasExactText(payload) && !contentText(identity?.effect_text);
  }).map((row) => ({ ...row, payload: parseJson(row.source_payload) }));
  return limit ? eligible.slice(0, limit) : eligible;
}

async function imageFor(row) {
  const assets = Array.isArray(row.tcg_card_assets) ? row.tcg_card_assets : [];
  const asset = [...assets].filter((item) => item?.object_key).sort((a, b) => (b.kind === 'large') - (a.kind === 'large') || Number(b.width ?? 0) - Number(a.width ?? 0))[0];
  if (asset) {
    const { data, error } = await supabase.storage.from(bucket).download(asset.object_key);
    if (!error && data) return { bytes: Buffer.from(await data.arrayBuffer()), objectKey: asset.object_key, via: 'stored' };
  }

  const number = localNumber(row, row.payload);
  if (!/^[\p{L}\p{N}._-]{1,32}$/u.test(number) || !/^[\p{L}\p{N}._-]{1,32}$/u.test(String(row.set_code))) {
    throw new Error('No stored image and the catalog image path is not usable.');
  }
  const url = new URL(`/pokemon/art/id/${encodeURIComponent(row.set_code)}/${encodeURIComponent(number)}.webp`, origin);
  url.searchParams.set('printingId', row.id);
  const response = await fetch(url, { headers: { accept: 'image/avif,image/webp,image/*' }, signal: AbortSignal.timeout(45_000) });
  const type = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
  if (!response.ok || !type.startsWith('image/')) throw new Error(`VivrePlay image route returned ${response.status}.`);
  return { bytes: Buffer.from(await response.arrayBuffer()), objectKey: null, via: 'vivreplay-image-route' };
}

async function cropsFor(bytes) {
  const image = sharp(bytes, { failOn: 'error' }).rotate();
  const meta = await image.metadata();
  if (!meta.width || !meta.height || meta.width < 120 || meta.height < 180) throw new Error('Card image is too small or invalid.');
  const regions = [
    { name: 'full', top: 0, height: meta.height },
    { name: 'header', top: 0, height: Math.round(meta.height * 0.34) },
    { name: 'rules', top: Math.round(meta.height * 0.27), height: Math.round(meta.height * 0.5) },
    { name: 'footer', top: Math.round(meta.height * 0.68), height: meta.height - Math.round(meta.height * 0.68) },
  ];
  return Promise.all(regions.map(async (region) => {
    const top = Math.max(0, Math.min(meta.height - 1, region.top));
    const height = Math.max(1, Math.min(meta.height - top, region.height));
    const outputWidth = Math.min(1800, Math.max(meta.width, 1000));
    const cropped = await sharp(bytes).rotate().extract({ left: 0, top, width: meta.width, height })
      .resize({ width: outputWidth, withoutEnlargement: false }).jpeg({ quality: 92 }).toBuffer();
    return { name: region.name, bytes: cropped, normalizedTop: top / meta.height, normalizedHeight: height / meta.height };
  }));
}

function startVite() {
  return createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'mpa',
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
    optimizeDeps: { include: ['@paddleocr/paddleocr-js'] },
  });
}

function base64(buffer) { return buffer.toString('base64'); }
function summarizeLines(views) {
  const seen = new Set();
  const text = [];
  for (const view of views) for (const line of view.lines) {
    const value = line.text.trim();
    const key = value.toLocaleLowerCase();
    if (value && !seen.has(key)) { seen.add(key); text.push(value); }
  }
  return text.join('\n');
}

const candidates = await loadCandidates();
console.log(`Found ${candidates.length} Cardtell printings without structured card text; ${completed.size} completed rows will be skipped.`);
if (dryRun || !candidates.length) process.exit(0);
mkdirSync(dirname(output), { recursive: true });
const vite = await startVite();
let browser;
try {
  await vite.listen();
  const address = vite.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('Could not start the local OCR page.');
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const context = await browser.newContext();
  const workers = await Promise.all(Array.from({ length: concurrency }, async () => {
    const page = await context.newPage();
    page.on('pageerror', (error) => console.error(`OCR page error: ${error.message}`));
    await page.goto(`http://127.0.0.1:${address.port}/scripts/cardtell-ocr-runner.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.cardtellOcrWorker), { timeout: 60_000 });
    await page.evaluate(() => window.cardtellOcrWorker?.ready);
    return page;
  }));

  let cursor = 0;
  let finished = 0;
  let succeededThisRun = 0;
  let failedThisRun = 0;
  const startedAt = new Date().toISOString();
  async function worker(page) {
    while (cursor < candidates.length) {
      const index = cursor++;
      const row = candidates[index];
      const identity = Array.isArray(row.tcg_card_identities) ? row.tcg_card_identities[0] : row.tcg_card_identities;
      const payload = row.payload;
      const card = {
        printingId: row.id,
        identityId: row.identity_id,
        name: identity?.name ?? payload.name ?? payload.catalogDescription ?? 'Unnamed card',
        setCode: row.set_code,
        setName: row.set_name,
        cardNumber: localNumber(row, payload),
        rarity: row.rarity,
      };
      try {
        const source = await imageFor(row);
        const crops = await cropsFor(source.bytes);
        let response;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            response = await page.evaluate(async (images) => {
              if (!window.cardtellOcrWorker) throw new Error('OCR worker is not ready.');
              return window.cardtellOcrWorker.recognize(images);
            }, crops.map((crop) => base64(crop.bytes)));
            break;
          } catch (error) {
            if (attempt) throw error;
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }
        const views = response.map((result, viewIndex) => ({
          region: crops[viewIndex].name,
          top: crops[viewIndex].normalizedTop,
          height: crops[viewIndex].normalizedHeight,
          metrics: result.metrics,
          lines: result.lines.map((line) => ({
            text: line.text,
            confidence: Number(line.score.toFixed(4)),
            box: line.poly.map(([x, y]) => ({ x: Number((x / result.width).toFixed(5)), y: Number((crops[viewIndex].normalizedTop + y / result.height * crops[viewIndex].normalizedHeight).toFixed(5)) })),
          })),
        }));
        const record = {
          status: 'complete',
          printingId: row.id,
          card,
          image: { via: source.via, objectKey: source.objectKey, sha256: createHash('sha256').update(source.bytes).digest('hex') },
          engine: 'PaddleOCR PP-OCRv5',
          processedAt: new Date().toISOString(),
          ocrText: summarizeLines(views),
          views,
        };
        appendFileSync(output, `${JSON.stringify(record)}\n`);
        completed.add(row.id);
        succeededThisRun++;
      } catch (error) {
        const record = { status: 'failed', printingId: row.id, card, processedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) };
        appendFileSync(output, `${JSON.stringify(record)}\n`);
        failedThisRun++;
      }
      finished++;
      if (finished === candidates.length || finished % 25 === 0) console.log(`${finished}/${candidates.length} scanned`);
    }
  }
  await Promise.all(workers.map((page) => worker(page)));
  const summary = { startedAt, completedAt: new Date().toISOString(), attempted: finished, succeededThisRun, failedThisRun, completedAcrossRuns: completed.size, output };
  writeFileSync(output.replace(/\.jsonl$/i, '.summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser?.close();
  await vite.close();
}
