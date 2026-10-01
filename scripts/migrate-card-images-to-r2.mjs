import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const bucket = process.env.CLOUDFLARE_R2_BUCKET || 'tcg-card-images';
const concurrency = Math.max(1, Number(process.env.R2_MIGRATION_CONCURRENCY || 4));
let minIntervalMs = Math.max(0, Number(process.env.R2_MIGRATION_MIN_INTERVAL_MS || 300));
const limit = Math.max(0, Number(process.env.R2_MIGRATION_LIMIT || 0));
const dryRun = process.env.R2_MIGRATION_DRY_RUN === 'true';

if (!supabaseUrl || !supabaseKey) throw new Error('Supabase URL and secret key are required.');
if (!cloudflareToken || !accountId) throw new Error('Cloudflare API token and account ID are required.');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const assets = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from('tcg_card_assets')
    .select('object_key')
    .eq('kind', 'small')
    .range(from, from + 999);
  if (error) throw error;
  assets.push(...data);
  if (data.length < 1000) break;
}

const catalogKeys = [...new Set(assets.map(({ object_key }) => object_key).filter(Boolean))]
  .filter((key) => key.startsWith('one-piece/') && key.endsWith('.webp'));
if (catalogKeys.length !== new Set(assets.map(({ object_key }) => object_key)).size) {
  throw new Error('Some catalog keys are outside the expected one-piece WebP namespace.');
}

const apiBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket)}/objects`;
const cloudflareHeaders = { authorization: `Bearer ${cloudflareToken}` };
async function listR2Keys() {
  const found = new Set();
  let bytes = 0;
  let cursor;
  do {
    const query = new URLSearchParams({ prefix: 'one-piece/', per_page: '1000' });
    if (cursor) query.set('cursor', cursor);
    const response = await fetch(`${apiBase}?${query}`, { headers: cloudflareHeaders });
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error(`R2 list failed (${response.status}): ${JSON.stringify(body.errors).slice(0, 500)}`);
    for (const object of body.result ?? []) {
      found.add(object.key);
      bytes += Number(object.size ?? 0);
    }
    cursor = body.result_info?.is_truncated ? body.result_info.cursor : undefined;
  } while (cursor);
  return { keys: found, bytes };
}

const existing = await listR2Keys();
const existingKeys = existing.keys;
const missingKeys = catalogKeys.filter((key) => !existingKeys.has(key));
const keys = missingKeys.slice(0, limit || undefined);
console.log(JSON.stringify({ bucket, catalogAssets: assets.length, uniqueImages: catalogKeys.length, alreadyCopied: existingKeys.size, alreadyCopiedBytes: existing.bytes, pending: keys.length, concurrency, minIntervalMs, dryRun }));
if (dryRun) process.exit(0);

let cursor = 0;
let copied = 0;
let bytes = 0;
let nextUploadAt = 0;
const failures = [];
async function waitForUploadSlot() {
  const now = Date.now();
  const waitMs = Math.max(0, nextUploadAt - now);
  nextUploadAt = Math.max(now, nextUploadAt) + minIntervalMs;
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
}
await Promise.all(Array.from({ length: Math.min(concurrency, keys.length) }, async () => {
  while (cursor < keys.length) {
    const key = keys[cursor++];
    try {
      const { data, error } = await supabase.storage.from('tcg-card-images').download(key);
      if (error || !data) throw new Error(error?.message || 'Supabase returned an empty object.');
      const body = Buffer.from(await data.arrayBuffer());
      if (!body.length) throw new Error('Refusing to copy an empty image.');

      const encodedKey = key.split('/').map(encodeURIComponent).join('/');
      let uploaded = false;
      let lastError;
      for (let attempt = 0; attempt < 7; attempt++) {
        try {
          await waitForUploadSlot();
          const response = await fetch(`${apiBase}/${encodedKey}`, {
            method: 'PUT',
            headers: {
              ...cloudflareHeaders,
              'content-type': 'image/webp',
              'cache-control': 'public, max-age=31536000, immutable',
              'cf-r2-storage-class': 'Standard',
            },
            body,
            signal: AbortSignal.timeout(60_000),
          });
          const result = await response.json();
          if (response.ok && result.success && Number(result.result?.size) === body.length) {
            uploaded = true;
            break;
          }
          lastError = new Error(`Cloudflare ${response.status}: ${JSON.stringify(result.errors).slice(0, 500)}`);
          if (response.status === 429) {
            minIntervalMs = Math.min(2_000, Math.max(300, minIntervalMs * 1.5));
            nextUploadAt = Math.max(nextUploadAt, Date.now() + 15_000);
          }
          if (response.status < 500 && response.status !== 429) break;
        } catch (error) {
          lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, 1_000 * (attempt + 1) ** 2)));
      }
      if (!uploaded) throw lastError || new Error('Cloudflare upload failed.');
      copied++;
      bytes += body.length;
      if (copied % 100 === 0 || copied === keys.length) {
        console.log(JSON.stringify({ copied, total: keys.length, bytes }));
      }
    } catch (error) {
      failures.push({ key, error: error instanceof Error ? error.message : String(error) });
      console.error(JSON.stringify(failures.at(-1)));
    }
  }
}));

console.log(JSON.stringify({ copied, total: keys.length, bytes, failed: failures.length }));
if (failures.length) process.exitCode = 1;
