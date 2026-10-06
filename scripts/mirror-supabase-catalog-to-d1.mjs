import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, rmSync } from 'node:fs';

const tables = [
  'tcg_games',
  'tcg_import_runs',
  'tcg_card_identities',
  'tcg_sets',
  'tcg_card_asset_sources',
  'tcg_card_printings',
  'tcg_card_rules',
  'tcg_card_localizations',
  'tcg_source_records',
  'tcg_card_assets',
  'tcg_price_observations',
  'tcg_card_rulings',
  'tcg_rulesets',
  'tcg_card_rule_revisions',
  'tcg_matches',
  'tcg_match_events',
];
const apply = process.argv.includes('--apply');
const targetArg = process.argv.find(argument => argument.startsWith('--target='))?.split('=')[1] ?? 'remote';
if (!['local', 'remote'].includes(targetArg)) throw new Error('Choose --target=local or --target=remote.');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment.');

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const literal = value => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'object') return quote(JSON.stringify(value));
  return quote(value);
};

const results = new Map();
let estimatedBytes = 0;
for (const table of tables) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(`Supabase export failed for ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  results.set(table, rows);
  estimatedBytes += Buffer.byteLength(JSON.stringify(rows));
  console.log(`${table}: ${rows.length} rows`);
}

console.log(`Total: ${[...results.values()].reduce((sum, rows) => sum + rows.length, 0)} rows`);
console.log(`Estimated JSON payload: ${(estimatedBytes / 1024 / 1024).toFixed(2)} MiB`);
if (!apply) {
  console.log('Dry run only. Pass --apply to insert/update the D1 catalog mirror. Supabase is never modified.');
  process.exit(0);
}

const statements = [];
for (const [table, rows] of results) {
  if (!rows.length) continue;
  const columns = Object.keys(rows[0]);
  // D1 limits each SQL statement to 100 KB; JSON provenance rows vary greatly in size.
  const prefix = `INSERT OR REPLACE INTO \`${table}\` (${columns.map(column => `\`${column}\``).join(',')}) VALUES\n`;
  let values = [];
  let valueBytes = 0;
  const flush = () => {
    if (!values.length) return;
    statements.push(`${prefix}${values.join(',\n')};`);
    values = [];
    valueBytes = 0;
  };
  for (const row of rows) {
    const value = `(${columns.map(column => literal(row[column])).join(',')})`;
    const bytes = Buffer.byteLength(value);
    if (bytes > 90_000) throw new Error(`${table} contains a row that exceeds D1's safe SQL statement size (${bytes} bytes).`);
    if (valueBytes + bytes + prefix.length > 70_000) flush();
    values.push(value);
    valueBytes += bytes + 2;
  }
  flush();
}

const sqlPath = join(tmpdir(), `vivreplay-tcg-catalog-${Date.now()}.sql`);
writeFileSync(sqlPath, statements.join('\n'), { mode: 0o600 });
try {
  const locationArgs = targetArg === 'local' ? ['--local', '--persist-to', '.wrangler/state'] : ['--remote'];
  const wranglerEnv = {...process.env, WRANGLER_LOG_PATH: join(tmpdir(), `vivreplay-wrangler-${targetArg}.log`)};
  execFileSync('node_modules/.bin/wrangler', [
    'd1', 'execute', 'site-creator-d1', ...locationArgs, '--config', 'wrangler.migrations.json', '--file', sqlPath,
  ], { stdio: 'inherit', env: wranglerEnv });
} finally {
  rmSync(sqlPath, { force: true });
}
const countColumns = tables.map((table, index) => `(SELECT count(*) FROM \`${table}\`) AS c${index}`).join(',');
const locationArgs = targetArg === 'local' ? ['--local', '--persist-to', '.wrangler/state'] : ['--remote'];
const countOutput = execFileSync('node_modules/.bin/wrangler', [
  'd1', 'execute', 'site-creator-d1', ...locationArgs, '--config', 'wrangler.migrations.json',
  '--json', '--command', `SELECT ${countColumns}`,
], { encoding: 'utf8', env: {...process.env, WRANGLER_LOG_PATH: join(tmpdir(), `vivreplay-wrangler-${targetArg}.log`)} });
const countResults = JSON.parse(countOutput)[0]?.results?.[0] ?? {};
const mismatches = tables.filter((table, index) => Number(countResults[`c${index}`]) !== results.get(table).length);
if (mismatches.length) throw new Error(`D1 row-count verification failed for: ${mismatches.join(', ')}`);
console.log(`D1 mirror import verified: ${[...results.values()].reduce((sum, rows) => sum + rows.length, 0)} rows across ${tables.length} tables.`);
