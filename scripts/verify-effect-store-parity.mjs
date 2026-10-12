import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error('Supabase environment is required.');

const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
  : item);
const runD1 = command => {
  const output = execFileSync('node_modules/.bin/wrangler', [
    'd1', 'execute', 'vivreplay', '--remote', '--config', 'dist/server/wrangler.json', '--json', '--command', command,
  ], { encoding: 'utf8', maxBuffer: 96 * 1024 * 1024 });
  const envelope = JSON.parse(output.trimStart())[0];
  if (!envelope?.success) throw new Error(envelope?.error?.text ?? 'Cloudflare D1 query failed.');
  return envelope.results ?? [];
};
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
const [{ data: supabaseRuleset, error: supabaseRulesetError }, d1Ruleset] = await Promise.all([
  supabase.from('tcg_rulesets').select('id,code,effective_from').eq('status', 'published')
    .lte('effective_from', new Date().toISOString().slice(0, 10)).order('effective_from', { ascending: false }).limit(1).single(),
  Promise.resolve(runD1("SELECT id,code,effective_from FROM tcg_rulesets WHERE status='published' AND effective_from<=date('now') ORDER BY effective_from DESC LIMIT 1")[0]),
]);
if (supabaseRulesetError) throw supabaseRulesetError;
if (!d1Ruleset || d1Ruleset.id !== supabaseRuleset.id) throw new Error('D1 and Supabase do not share the same active ruleset.');

async function pages(table, columns, order, filter) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from(table).select(columns).order(order).range(offset, offset + 499);
    if (filter) query = query.eq(filter[0], filter[1]);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

const [identities, revisions, d1Identities, d1Revisions] = await Promise.all([
  pages('tcg_card_identities', 'id,code,effect_text', 'id'),
  pages('tcg_card_rule_revisions', 'identity_id,effect_text,effect_schema', 'identity_id', ['ruleset_id', supabaseRuleset.id]),
  Promise.resolve(runD1('SELECT id,code,effect_text FROM tcg_card_identities')),
  Promise.resolve(runD1(`SELECT r.identity_id,i.code,r.effect_text,r.effect_schema FROM tcg_card_rule_revisions r JOIN tcg_card_identities i ON i.id=r.identity_id WHERE r.ruleset_id='${supabaseRuleset.id}'`)),
]);

const d1IdentityByCode = new Map(d1Identities.map(row => [row.code, row]));
const supabaseIdentityByCode = new Map(identities.map(row => [row.code, row]));
const identityTextDiffs = [];
for (const code of new Set([...d1IdentityByCode.keys(), ...supabaseIdentityByCode.keys()])) {
  const d1 = d1IdentityByCode.get(code);
  const supa = supabaseIdentityByCode.get(code);
  if (!d1 || !supa || d1.effect_text !== supa.effect_text) identityTextDiffs.push(code);
}

const d1RevisionByCode = new Map(d1Revisions.map(row => [row.code, row]));
const revisionByIdentity = new Map(revisions.map(row => [row.identity_id, row]));
const schemaDiffs = [];
const sharedMissingRevisions = [];
const d1MissingRevisions = [];
const supabaseMissingRevisions = [];
const revisionTextDiffs = [];
for (const code of new Set([...d1RevisionByCode.keys(), ...d1IdentityByCode.keys()])) {
  const d1 = d1RevisionByCode.get(code);
  const identity = supabaseIdentityByCode.get(code);
  const supa = identity ? revisionByIdentity.get(identity.id) : undefined;
  if (!d1 && !supa) {
    sharedMissingRevisions.push(code);
    continue;
  }
  if (!d1) {
    d1MissingRevisions.push(code);
    continue;
  }
  if (!supa) {
    supabaseMissingRevisions.push(code);
    continue;
  }
  const d1Schema = typeof d1.effect_schema === 'string' ? JSON.parse(d1.effect_schema) : d1.effect_schema;
  const supaSchema = typeof supa.effect_schema === 'string' ? JSON.parse(supa.effect_schema) : supa.effect_schema;
  if (canonical(d1Schema) !== canonical(supaSchema)) schemaDiffs.push(code);
  if (d1.effect_text !== supa.effect_text) revisionTextDiffs.push(code);
}

const report = {
  generatedAt: new Date().toISOString(),
  ruleset: supabaseRuleset,
  identities: { d1: d1Identities.length, supabase: identities.length, textDiffs: identityTextDiffs.length, textDiffCodes: identityTextDiffs },
  revisions: {
    d1: d1Revisions.length,
    supabase: revisions.length,
    schemaDiffs: schemaDiffs.length,
    schemaDiffCodes: schemaDiffs,
    sharedMissingRevisions: sharedMissingRevisions.length,
    sharedMissingRevisionCodes: sharedMissingRevisions,
    d1MissingRevisions: d1MissingRevisions.length,
    d1MissingRevisionCodes: d1MissingRevisions,
    supabaseMissingRevisions: supabaseMissingRevisions.length,
    supabaseMissingRevisionCodes: supabaseMissingRevisions,
    textDiffs: revisionTextDiffs.length,
    textDiffCodes: revisionTextDiffs,
  },
};
mkdirSync('reports/effects', { recursive: true });
writeFileSync('reports/effects/store-parity-live.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (identityTextDiffs.length || schemaDiffs.length || d1MissingRevisions.length || supabaseMissingRevisions.length || revisionTextDiffs.length) process.exitCode = 1;
