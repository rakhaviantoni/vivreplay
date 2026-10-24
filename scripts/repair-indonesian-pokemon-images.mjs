import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const origin = (process.env.POKEMON_CATALOG_ORIGIN || 'https://vivreplay.com').replace(/\/$/, '');
const pageSize = 250;
const concurrency = Math.max(1, Math.min(12, Number(process.env.POKEMON_IMAGE_REPAIR_CONCURRENCY || 8)));
const apply = process.argv.includes('--apply');
const includeLinked = process.argv.includes('--include-linked');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Math.max(0, Number(limitArg.slice(8)) || 0) : 0;
const offsetArg = process.argv.find((arg) => arg.startsWith('--offset='));
const offset = offsetArg ? Math.max(0, Number(offsetArg.slice(9)) || 0) : 0;
const wrangler = join(process.cwd(), 'node_modules/.bin/wrangler');
const config = join(process.cwd(), 'dist/server/wrangler.json');
const temp = mkdtempSync(join(tmpdir(), 'vivreplay-pokemon-id-images-'));

function json(value) { return JSON.stringify(value); }
function sql(value) { return value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`; }
function stableUuid(value) {
  const bytes = createHash('sha256').update(`vivreplay:pokemon-id-image:${value}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function payloadFor(card) {
  const value = card.source_payload;
  if (typeof value === 'string') { try { return JSON.parse(value); } catch { return {}; } }
  return value && typeof value === 'object' ? value : {};
}
function cardNumber(card, payload) {
  const explicit = String(payload.localId ?? payload.collectorNumber ?? '').trim();
  const description = String(payload.shortDescription ?? '').trim() || String(payload.description ?? '').trim();
  const parsed = description.match(/(?:^|\s|[·•])([A-Za-z0-9]+(?:\/[A-Za-z0-9]+)?)\s*$/)?.[1];
  const raw = explicit || parsed || String(card.printing_code ?? '');
  return raw.replace(/^([^/]+)\/.+$/, '$1');
}
function sourcesFor(card) {
  const linkedCandidates = [];
  if (typeof card.card_image_url === 'string' && card.card_image_url) {
    try {
      const source = new URL(card.card_image_url);
      if (source.protocol !== 'https:' || source.hostname !== 'assets.tcgdex.net') return [];
      const exact = source.toString();
      const base = exact.replace(/\/(?:high|low)\.(?:avif|png|webp|jpe?g)$/i, '');
      linkedCandidates.push(exact);
      for (const quality of ['high', 'low']) for (const extension of ['webp', 'png', 'jpg', 'avif']) linkedCandidates.push(`${base}/${quality}.${extension}`);
    } catch { return []; }
  }
  const payload = payloadFor(card);
  const set = payload.set && typeof payload.set === 'object' ? payload.set : {};
  const setId = String(set.id ?? card.set_code ?? '');
  const local = cardNumber(card, payload);
  const count = String(set.cardCount?.official ?? '');
  if (!/^[a-z0-9_-]{1,40}$/i.test(setId) || !/^[a-z0-9._-]{1,32}$/i.test(local)) return [];
  const setNames = [...new Set([setId, setId.toUpperCase(), setId.toLowerCase()])];
  const official = /^[0-9]{1,4}$/.test(count) ? count.padStart(3, '0') : '';
  const urls = [];
  for (const name of setNames) {
    if (!/^\d+$/.test(local)) urls.push(`https://cdn.pokepedia.id/${encodeURIComponent(name)}/${encodeURIComponent(`${local}.webp`)}`);
    if (official) urls.push(`https://cdn.pokepedia.id/${encodeURIComponent(name)}/${encodeURIComponent(`${local}_${official}.webp`)}`);
  }
  return [...new Set([...linkedCandidates, ...urls])];
}
async function loadMissingPrintings() {
  if (includeLinked) {
    const statement = "SELECT p.id,p.set_code,p.printing_code,p.card_image_url,p.source_payload FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id JOIN tcg_games g ON g.id=i.game_id LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small' WHERE g.slug='pokemon' AND p.language='ID' AND a.id IS NULL AND p.card_image_url LIKE 'https://assets.tcgdex.net/%' ORDER BY p.id";
    const output = execFileSync(wrangler, ['d1', 'execute', 'vivreplay', '--remote', '--config', config, '--json', '--command', statement], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const result = JSON.parse(output);
    return result.flatMap((item) => item.results ?? []);
  }
  const cards = [];
  for (let pageOffset = 0; ; pageOffset += pageSize) {
    const params = new URLSearchParams({ game: 'pokemon', language: 'ID', missingImages: '1', limit: String(pageSize), offset: String(pageOffset), sort: 'latest', repairProbe: `${Date.now()}-${pageOffset}` });
    let response;
    let lastError;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        response = await fetch(`${origin}/api/cards/catalog?${params}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(90_000) });
        if (response.ok) break;
        lastError = new Error(`Catalog request failed (${response.status}) at offset ${pageOffset}.`);
      } catch (error) { lastError = error; }
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
    if (!response?.ok) throw lastError || new Error(`Catalog request failed at offset ${pageOffset}.`);
    const body = await response.json();
    if (!Array.isArray(body.cards)) throw new Error('The catalog response did not include a card list.');
    cards.push(...body.cards);
    if (body.cards.length < pageSize) break;
  }
  return cards;
}
async function findAndStore(card, index) {
  const candidates = sourcesFor(card);
  if (!candidates.length) return { card, reason: 'No safe Indonesian source path could be built.' };
  let found;
  for (const sourceUrl of candidates) {
    let response;
    try { response = await fetch(sourceUrl, { headers: { accept: 'image/webp,image/*;q=0.8' }, signal: AbortSignal.timeout(45_000) }); }
    catch { continue; }
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    if (!response.ok || !type.startsWith('image/')) { await response.body?.cancel(); continue; }
    try {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 12 * 1024 * 1024) continue;
      const image = sharp(bytes, { failOn: 'error' });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || metadata.width < 100 || metadata.height < 100) continue;
      const output = await image.rotate().resize({ width: 420, withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
      found = { card, sourceUrl, output, width: 420, height: Math.round(metadata.height * Math.min(1, 420 / metadata.width)) };
      break;
    } catch { /* Skip non-card or invalid image responses. */ }
  }
  if (!found) return { card, reason: 'No matching Indonesian scan was available at the known source paths.' };
  const objectKey = `pokemon/${String(card.set_code).toUpperCase().replace(/[^A-Z0-9]/g, '')}/id/small/${card.id}.webp`;
  const file = join(temp, `${index}.webp`);
  writeFileSync(file, found.output, { mode: 0o600 });
  return { ...found, objectKey, file, checksum: createHash('sha256').update(found.output).digest('hex'), byteSize: found.output.length };
}
async function bounded(items, fn) {
  const output = Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) output[cursor] = await fn(items[cursor], cursor++);
  }));
  return output;
}
async function runWrangler(args, { quiet = false, retries = 3 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(wrangler, [...args, '--config', config], { stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
        let stderr = '';
        if (quiet) child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-2_000); });
        child.once('error', reject);
        child.once('exit', (code, signal) => {
          if (code === 0) resolve();
          else reject(new Error(`Wrangler exited with ${signal || code}.${stderr ? ` ${stderr.trim()}` : ''}`));
        });
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < retries) {
        console.log(json({ retryingCloudflareRequest: attempt + 1, delayMs: 1000 * (attempt + 1) }));
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

try {
  const all = await loadMissingPrintings();
  const selected = all.slice(offset, limit ? offset + limit : undefined);
  console.log(json({ mode: apply ? 'apply' : 'preview', source: includeLinked ? 'TCGdex-linked' : 'Poképedia-missing', language: 'ID', catalogMissing: includeLinked ? undefined : all.length, sourceLinked: includeLinked ? all.length : undefined, selected: selected.length, offset, concurrency }));
  let checked = 0;
  const results = await bounded(selected, async (card, index) => {
    const result = await findAndStore(card, index);
    checked++;
    if (checked % 100 === 0 || checked === selected.length) console.log(json({ checked, total: selected.length }));
    return result;
  });
  const ready = results.filter((result) => result.objectKey);
  const missing = results.filter((result) => !result.objectKey).map((result) => ({ id: result.card.id, set: result.card.set_code, number: result.card.printing_code, reason: result.reason }));
  console.log(json({ verifiedImages: ready.length, stillMissing: missing.length, missingExamples: missing.slice(0, 20) }));
  if (!apply) {
    console.log('Preview only. Pass --apply to upload verified scans to R2 and attach them to their Indonesian printings in D1.');
    process.exitCode = missing.length ? 2 : 0;
  } else if (ready.length) {
    let cursor = 0;
    let uploaded = 0;
    const failures = [];
    await Promise.all(Array.from({ length: Math.min(6, ready.length) }, async () => {
      while (cursor < ready.length) {
        const job = ready[cursor++];
        try {
          await runWrangler(['r2', 'object', 'put', `tcg-card-images/${job.objectKey}`, '--remote', '--file', job.file, '--content-type', 'image/webp', '--cache-control', 'public, max-age=31536000, immutable', '--force'], { quiet: true });
          uploaded++;
          if (uploaded % 50 === 0 || uploaded === ready.length) console.log(json({ uploaded, total: ready.length }));
        } catch (error) {
          failures.push({ id: job.card.id, set: job.card.set_code, number: job.card.printing_code, error: error instanceof Error ? error.message : 'R2 upload failed' });
        }
      }
    }));

    const saved = ready.filter((job) => !failures.some((failure) => failure.id === job.card.id));
    for (let start = 0; start < saved.length; start += 60) {
      const chunk = saved.slice(start, start + 60);
      const createdAt = new Date().toISOString();
      const statements = chunk.flatMap((job) => {
        const assetId = stableUuid(`${job.card.id}:small`);
        const sourceId = stableUuid(`${job.card.id}:${job.sourceUrl}`);
        const variants = json({ small: job.objectKey });
        return [
          `INSERT OR IGNORE INTO tcg_card_assets (id,printing_id,kind,object_key,mime_type,width,height,byte_size,checksum,created_at) VALUES (${sql(assetId)},${sql(job.card.id)},'small',${sql(job.objectKey)},'image/webp',${job.width},${job.height},${job.byteSize},${sql(job.checksum)},${sql(createdAt)});`,
          `UPDATE tcg_card_printings SET card_image_url=COALESCE(NULLIF(card_image_url,''),${sql(job.sourceUrl)}) WHERE id=${sql(job.card.id)};`,
          `INSERT OR IGNORE INTO tcg_card_asset_sources (id,printing_id,source_type,source_url,rights_status,observed_at,storage_path,approved_for_display,approved_for_storage,created_at,storage_variants,stored_format) VALUES (${sql(sourceId)},${sql(job.card.id)},${sql(new URL(job.sourceUrl).hostname === 'assets.tcgdex.net' ? 'tcgdex' : 'pokepedia')},${sql(job.sourceUrl)},'source_attribution_pending_review',${sql(createdAt)},${sql(job.objectKey)},0,0,${sql(createdAt)},${sql(variants)},'webp');`,
        ];
      });
      const file = join(temp, `catalog-${start}.sql`);
      writeFileSync(file, statements.join('\n'), { mode: 0o600 });
      await runWrangler(['d1', 'execute', 'vivreplay', '--remote', '--file', file]);
      rmSync(file, { force: true });
    }
    console.log(json({ uploaded, catalogRowsAttached: saved.length, uploadFailures: failures.length, uploadFailureExamples: failures.slice(0, 20), noSourceFound: missing.length, stillMissing: missing.length + failures.length }));
    if (failures.length || missing.length) process.exitCode = 1;
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
