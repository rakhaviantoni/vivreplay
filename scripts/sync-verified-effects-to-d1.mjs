import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const planPath = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass a verified publication plan JSON path.');
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const candidates = plan.candidates ?? [];
if (!candidates.length) throw new Error('The publication plan has no verified candidates.');
const codes = candidates.map(candidate => candidate.code);
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const comparableText = value => String(value).replace(/\s+/g, ' ').trim().replace(/([.!?]) \[/g, '$1[');
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
  : item);
const rulesetId = plan.rulesetId;
if (!rulesetId) throw new Error('Publication plan is missing its ruleset ID.');
const codeList = codes.map(quote).join(',');
const select = `SELECT r.identity_id,i.code,r.effect_text,r.effect_schema FROM tcg_card_rule_revisions r JOIN tcg_card_identities i ON i.id=r.identity_id WHERE r.ruleset_id=${quote(rulesetId)} AND i.code IN (${codeList})`;
const runD1 = args => JSON.parse(execFileSync('node_modules/.bin/wrangler', [
  'd1', 'execute', 'site-creator-d1', '--remote', '--config', 'wrangler.migrations.json', '--json', ...args,
], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }))[0]?.results ?? [];
const before = runD1(['--command', select]);
const byCode = new Map(before.map(row => [row.code, row]));
if (byCode.size !== candidates.length) throw new Error(`Expected ${candidates.length} D1 rows, received ${byCode.size}.`);
for (const candidate of candidates) {
  const row = byCode.get(candidate.code);
  const nextText = candidate.effectTextAfter ?? row?.effect_text;
  if (!row || comparableText(row.effect_text) !== comparableText(candidate.publishedText) || (candidate.effectTextAfter !== undefined && comparableText(candidate.after.rawEffectText) !== comparableText(nextText))) {
    throw new Error(`Printed-text parity check failed for ${candidate.code}; no D1 rows were changed.`);
  }
}

const sql = candidates.map(candidate => {
  const row = byCode.get(candidate.code);
  const schema = JSON.stringify(candidate.after);
  const nextText = candidate.effectTextAfter ?? candidate.publishedText;
  return `UPDATE tcg_card_rule_revisions SET effect_text=${quote(nextText)},effect_schema=${quote(schema)} WHERE ruleset_id=${quote(rulesetId)} AND identity_id=${quote(row.identity_id)} AND effect_text=${quote(row.effect_text)};`;
}).join('\n');
const sqlPath = join(tmpdir(), `vivreplay-verified-effects-${Date.now()}.sql`);
writeFileSync(sqlPath, sql, { mode: 0o600 });
try {
  execFileSync('node_modules/.bin/wrangler', [
    'd1', 'execute', 'site-creator-d1', '--remote', '--config', 'wrangler.migrations.json', '--file', sqlPath,
  ], { stdio: 'inherit' });
} finally {
  rmSync(sqlPath, { force: true });
}

const after = runD1(['--command', select]);
const verified = new Map(after.map(row => [row.code, row]));
for (const candidate of candidates) {
  const row = verified.get(candidate.code);
  const expectedText = candidate.effectTextAfter ?? candidate.publishedText;
  if (!row || comparableText(row.effect_text) !== comparableText(expectedText) || canonical(JSON.parse(row.effect_schema)) !== canonical(candidate.after)) {
    throw new Error(`D1 schema readback failed for ${candidate.code}.`);
  }
}
console.log(JSON.stringify({ synced: candidates.length, readbackVerified: true, rulesetId }));
