import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const planPath = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass a verified Trigger publication plan.');
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const candidates = plan.candidates ?? [];
if (!candidates.length || !plan.rulesetId) throw new Error('The plan has no candidate identities or ruleset ID.');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbKey = process.env.SUPABASE_SECRET_KEY;
if (!dbUrl || !dbKey) throw new Error('Supabase environment is required.');
const supabase = createClient(dbUrl, dbKey, { auth: { persistSession: false, autoRefreshToken: false } });
const runD1 = args => {
  const envelope = JSON.parse(execFileSync('node_modules/.bin/wrangler', [
    'd1', 'execute', 'vivreplay', '--remote', '--config', 'dist/server/wrangler.json', '--json', ...args,
  ], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }))[0];
  if (!envelope?.success) throw new Error(envelope?.error?.text ?? 'Cloudflare D1 query failed.');
  return envelope.results ?? [];
};
const codes = candidates.map(candidate => candidate.code);
const codeSql = codes.map(quote).join(',');
const [supabaseResult, d1Rows] = await Promise.all([
  supabase.from('tcg_card_identities').select('id,code,effect_text').in('code', codes),
  Promise.resolve(runD1(['--command', `SELECT id,code,effect_text FROM tcg_card_identities WHERE code IN (${codeSql})`])),
]);
if (supabaseResult.error) throw supabaseResult.error;
const supabaseByCode = new Map(supabaseResult.data.map(row => [row.code, row]));
const d1ByCode = new Map(d1Rows.map(row => [row.code, row]));
if (supabaseByCode.size !== candidates.length || d1ByCode.size !== candidates.length) throw new Error('Identity preflight returned an unexpected row count.');
for (const candidate of candidates) {
  const beforeText = candidate.identityTextBefore ?? candidate.printedText;
  if (supabaseByCode.get(candidate.code)?.effect_text !== beforeText) throw new Error(`${candidate.code}: Supabase identity text changed; no identity rows were changed.`);
  if (d1ByCode.get(candidate.code)?.effect_text !== beforeText) throw new Error(`${candidate.code}: D1 identity text changed; no identity rows were changed.`);
}

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ dryRun: true, candidates: candidates.length, bothStoresPreflight: 'passed' }));
  process.exit(0);
}

const sql = candidates.map(candidate => {
  const row = d1ByCode.get(candidate.code);
  const beforeText = candidate.identityTextBefore ?? candidate.printedText;
  return `UPDATE tcg_card_identities SET effect_text=${quote(candidate.effectTextAfter)} WHERE id=${quote(row.id)} AND effect_text=${quote(beforeText)};`;
}).join('\n');
const sqlPath = join(tmpdir(), `vivreplay-verified-effect-identities-${Date.now()}.sql`);
writeFileSync(sqlPath, sql, { mode: 0o600 });
try {
  execFileSync('node_modules/.bin/wrangler', [
    'd1', 'execute', 'vivreplay', '--remote', '--config', 'dist/server/wrangler.json', '--file', sqlPath,
  ], { stdio: 'inherit' });
} finally {
  rmSync(sqlPath, { force: true });
}
for (const candidate of candidates) {
  const identity = supabaseByCode.get(candidate.code);
  const beforeText = candidate.identityTextBefore ?? candidate.printedText;
  const { data, error } = await supabase.from('tcg_card_identities')
    .update({ effect_text: candidate.effectTextAfter, updated_at: new Date().toISOString() })
    .eq('id', identity.id).eq('effect_text', beforeText).select('id');
  if (error) throw error;
  if (data.length !== 1) throw new Error(`${candidate.code}: concurrent Supabase identity update detected.`);
}

const [supabaseRead, d1Read] = await Promise.all([
  supabase.from('tcg_card_identities').select('code,effect_text').in('code', codes),
  Promise.resolve(runD1(['--command', `SELECT code,effect_text FROM tcg_card_identities WHERE code IN (${codeSql})`])),
]);
if (supabaseRead.error) throw supabaseRead.error;
for (const [store, rows] of [['Supabase', supabaseRead.data], ['D1', d1Read]]) {
  const byCode = new Map(rows.map(row => [row.code, row]));
  for (const candidate of candidates) if (byCode.get(candidate.code)?.effect_text !== candidate.effectTextAfter) throw new Error(`${candidate.code}: ${store} identity readback failed.`);
}
console.log(JSON.stringify({ updated: candidates.length, supabaseReadbackVerified: true, d1ReadbackVerified: true }));
