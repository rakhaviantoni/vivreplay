import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

type Printing = {
  id: string;
  identity_id: string;
  printing_code: string | null;
  language: string;
  set_code: string;
  variant: string | null;
  tcg_card_assets: { kind: string; object_key: string }[];
};

async function allRows() {
  const rows: Printing[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('tcg_card_printings')
      .select('id,identity_id,printing_code,language,set_code,variant,tcg_card_assets(kind,object_key)')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data as Printing[]);
    if (data.length < 1000) return rows;
  }
}

const smallKey = (printing: Printing) => printing.tcg_card_assets.find(asset => asset.kind === 'small')?.object_key;
const baseCode = (code: string) => code.replace(/_p\d+$/i, '');
const isParallel = (printing: Printing) => Boolean(printing.printing_code && /_p\d+$/i.test(printing.printing_code));

async function fingerprint(objectKey: string) {
  const { data, error } = await supabase.storage.from('tcg-card-images').download(objectKey);
  if (error || !data) throw error ?? new Error(`No body for ${objectKey}`);
  const input = Buffer.from(await data.arrayBuffer());
  const { data: raw, info } = await sharp(input).rotate().resize(24, 34, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error(`Unexpected channels for ${objectKey}`);
  return createHash('sha256').update(raw).digest('hex');
}

const rows = await allRows();
const standards = new Map<string, Printing>();
for (const row of rows) {
  const code = row.printing_code;
  if (!code || isParallel(row) || !/^(standard|base)$/i.test(row.variant ?? 'Standard')) continue;
  standards.set(`${row.identity_id}:${row.language}:${baseCode(code).toUpperCase()}`, row);
}

const pairs = rows.flatMap(parallel => {
  const code = parallel.printing_code;
  if (!code || !isParallel(parallel)) return [];
  const standard = standards.get(`${parallel.identity_id}:${parallel.language}:${baseCode(code).toUpperCase()}`);
  const standardKey = standard && smallKey(standard);
  const parallelKey = smallKey(parallel);
  return standard && standardKey && parallelKey ? [{ standard, parallel, standardKey, parallelKey }] : [];
});

const concurrency = Math.max(1, Number(process.env.PARALLEL_AUDIT_CONCURRENCY ?? 12));
const offset = Math.max(0, Number(process.env.PARALLEL_AUDIT_OFFSET ?? 0));
const limit = Math.max(0, Number(process.env.PARALLEL_AUDIT_LIMIT ?? 0));
const scopedPairs = limit ? pairs.slice(offset, offset + limit) : pairs.slice(offset);
const duplicates: Array<{ base: string; parallel: string; language: string; set: string; baseKey: string; parallelKey: string }> = [];
let cursor = 0;
await Promise.all(Array.from({ length: Math.min(concurrency, scopedPairs.length) }, async () => {
  while (cursor < scopedPairs.length) {
    const pair = scopedPairs[cursor++];
    const [standardHash, parallelHash] = await Promise.all([fingerprint(pair.standardKey), fingerprint(pair.parallelKey)]);
    if (standardHash === parallelHash) duplicates.push({ base: pair.standard.printing_code!, parallel: pair.parallel.printing_code!, language: pair.parallel.language, set: pair.parallel.set_code, baseKey: pair.standardKey, parallelKey: pair.parallelKey });
  }
}));

duplicates.sort((a, b) => a.parallel.localeCompare(b.parallel));
console.log(JSON.stringify({ totalPairs: pairs.length, offset, checkedPairs: scopedPairs.length, duplicatePairs: duplicates.length, duplicates }, null, 2));
