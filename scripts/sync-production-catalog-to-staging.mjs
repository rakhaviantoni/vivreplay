import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const wrangler = path.join(root, 'node_modules/.bin/wrangler');
const stageConfig = process.argv[2];
if (!stageConfig) throw new Error('Pass the generated staging Wrangler config path.');

// These tables hold the public card catalog. Account, collection, listing,
// order, and payment data are deliberately kept in the staging database.
const tables = [
  'tcg_games',
  'tcg_card_identities',
  'tcg_sets',
  'tcg_rulesets',
  'tcg_card_printings',
  'tcg_card_asset_sources',
  'tcg_card_assets',
  'tcg_card_rules',
  'tcg_card_localizations',
  'tcg_card_rulings',
  'tcg_card_rule_revisions',
  'tcg_sealed_products',
];
const compatibilityTables = ['games', 'card_asset_sources', 'card_identities', 'card_printings'];
// Keep IDs stable for staging listings and older compatibility rows.
const preservedTables = ['tcg_sealed_products', ...compatibilityTables];
const sourceConfig = 'wrangler.migrations.json';
const env = {
  ...process.env,
  CLOUDFLARE_CF_FETCH_ENABLED: 'false',
  WRANGLER_SEND_METRICS: 'false',
  WRANGLER_WRITE_LOGS: 'false',
  WRANGLER_LOG_PATH: path.join(tmpdir(), 'vivreplay-wrangler-staging-catalog.log'),
};

function run(args, { capture = false } = {}) {
  const result = spawnSync(wrangler, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0) {
    throw new Error(`wrangler ${args.join(' ')} failed: ${output}`);
  }
  if (!capture && output) process.stdout.write(output);
  return capture ? result.stdout : '';
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function retryRemote(operation, label, attempts = 6) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      lastError = error;
      if (!/fetch failed|network|timeout|429|502|503|504/i.test(String(error))) throw error;
      if (attempt + 1 < attempts) {
        const delay = Math.min(8_000, 500 * (2 ** attempt));
        console.warn(`${label} did not connect; retrying in ${delay / 1000}s (${attempt + 1}/${attempts - 1}).`);
        await pause(delay);
      }
    }
  }
  throw lastError;
}

async function sourceRows(table, offset, limit = 500) {
  const output = await retryRemote(() => run([
      'd1', 'execute', 'DB', '--remote', '--config', sourceConfig,
      '--json', '--command', `SELECT * FROM \`${table}\` LIMIT ${limit} OFFSET ${offset}`,
    ], { capture: true }), `Production ${table} read`);
  const batches = JSON.parse(output);
  if (batches.some((batch) => batch.success === false)) throw new Error(`Production read failed for ${table}.`);
  return batches.flatMap((batch) => batch.results ?? []);
}

function literal(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insertStatements(table, rows, updateById = false) {
  if (!rows.length) return [];
  const columns = Object.keys(rows[0]);
  const prefix = `${updateById ? 'INSERT INTO' : 'INSERT OR REPLACE INTO'} \`${table}\` (${columns.map((name) => `\`${name}\``).join(',')}) VALUES\n`;
  const statements = [];
  let values = [];
  let bytes = 0;
  const flush = () => {
    if (!values.length) return;
    const updateClause = updateById
      ? ` ON CONFLICT(\`id\`) DO UPDATE SET ${columns.filter((name) => name !== 'id').map((name) => `\`${name}\`=excluded.\`${name}\``).join(',')}`
      : '';
    statements.push(`${prefix}${values.join(',\n')}${updateClause};`);
    values = [];
    bytes = 0;
  };
  for (const row of rows) {
    const value = `(${columns.map((column) => literal(row[column])).join(',')})`;
    const size = Buffer.byteLength(value);
    if (size > 90_000) throw new Error(`${table} contains a row too large to import safely.`);
    if (bytes + size + prefix.length > 70_000) flush();
    values.push(value);
    bytes += size + 2;
  }
  flush();
  return statements;
}

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'vivreplay-staging-catalog-'));
let fileNumber = 0;
async function importStatements(statements, label) {
  for (let offset = 0; offset < statements.length; offset += 30) {
    const sqlPath = path.join(temporaryDirectory, `catalog-${fileNumber++}.sql`);
    await writeFile(sqlPath, `${statements.slice(offset, offset + 30).join('\n')}\n`, { mode: 0o600 });
    await retryRemote(() => run([
      'd1', 'execute', 'DB', '--remote', '--config', stageConfig, '--file', sqlPath, '--yes',
    ]), `${label} import`, 3);
  }
}

try {
  for (const table of [...tables, ...compatibilityTables]) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const page = await sourceRows(table, offset);
      rows.push(...page);
      if (page.length < 500) break;
    }
    console.log(`Read ${rows.length.toLocaleString()} production ${table} rows.`);
    const statements = insertStatements(table, rows, preservedTables.includes(table));
    await importStatements(statements, table);

    const output = await retryRemote(() => run([
      'd1', 'execute', 'DB', '--remote', '--config', stageConfig,
      '--json', '--command', `SELECT COUNT(*) AS row_count FROM \`${table}\``,
    ], { capture: true }), `Staging ${table} verification`);
    const batches = JSON.parse(output);
    const count = Number(batches.flatMap((batch) => batch.results ?? [])[0]?.row_count ?? -1);
    if (count < rows.length) {
      throw new Error(`Staging ${table} count ${count} is below the ${rows.length} production rows.`);
    }
  }

  console.log('Staging card catalog refreshed from production. Account, market, and order data were left in staging.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
