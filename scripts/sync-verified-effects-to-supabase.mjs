import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { scenarios } from './card-effect-scenarios.ts';

const planPath = process.argv[2];
if (!planPath) throw new Error('Pass a verified publication plan JSON path.');
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const candidates = plan.candidates ?? [];
if (!candidates.length) throw new Error('The publication plan has no verified candidates.');
if (!plan.rulesetId) throw new Error('Publication plan is missing its ruleset ID.');
const audit = JSON.parse(readFileSync('reports/effects/per-card.json', 'utf8'));
const auditByCode = new Map(audit.cards.map(card => [card.code, card]));
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
  : item);
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbKey = process.env.SUPABASE_SECRET_KEY;
if (!dbUrl || !dbKey) throw new Error('Supabase environment is required.');
const db = createClient(dbUrl, dbKey, { auth: { persistSession: false, autoRefreshToken: false } });

// Preflight every row before the first write. A changed catalog or revision aborts the batch.
const currentByCode = new Map();
for (const batch of chunks(candidates, 100)) {
  const { data: identities, error: identityError } = await db.from('tcg_card_identities')
    .select('id,code,effect_text').in('code', batch.map(candidate => candidate.code));
  if (identityError) throw identityError;
  const identityByCode = new Map(identities.map(row => [row.code, row]));
  if (identityByCode.size !== batch.length) throw new Error('Catalog preflight returned an unexpected row count.');
  for (const candidate of batch) {
    const identity = identityByCode.get(candidate.code);
    if (!identity || identity.effect_text !== candidate.printedText) throw new Error(`${candidate.code}: printed catalog text changed; no rows were changed.`);
  }
  const ids = batch.map(candidate => identityByCode.get(candidate.code).id);
  const { data: revisions, error: revisionError } = await db.from('tcg_card_rule_revisions')
    .select('identity_id,effect_text,effect_schema').eq('ruleset_id', plan.rulesetId).in('identity_id', ids);
  if (revisionError) throw revisionError;
  const revisionById = new Map(revisions.map(row => [row.identity_id, row]));
  if (revisionById.size !== batch.length) throw new Error('Ruleset preflight returned an unexpected row count.');
  for (const candidate of batch) {
    const identity = identityByCode.get(candidate.code);
    const current = revisionById.get(identity.id);
    if (!current || current.effect_text !== candidate.publishedText || hash(current.effect_schema) !== candidate.beforeHash || canonical(current.effect_schema) !== canonical(candidate.before)) {
      throw new Error(`${candidate.code}: published revision changed since planning; no rows were changed.`);
    }
    const card = auditByCode.get(candidate.code);
    if (!card) throw new Error(`${candidate.code}: card is missing from the audited snapshot.`);
    const scenarioRow = { code: candidate.code, name: card.name, color: card.color, card_type: card.cardType, cost: card.cost, power: card.power, effect_text: candidate.after.rawEffectText };
    const scenariosForCard = scenarios(scenarioRow);
    const remainingNames = new Map();
    for (const name of candidate.scenarioNames) remainingNames.set(name, (remainingNames.get(name) ?? 0) + 1);
    const selected = scenariosForCard.filter(scenario => {
      const remaining = remainingNames.get(scenario.name) ?? 0;
      if (!remaining) return false;
      remainingNames.set(scenario.name, remaining - 1);
      return true;
    });
    if (selected.length !== candidate.scenarioCount || [...remainingNames.values()].some(count => count !== 0)) throw new Error(`${candidate.code}: planned scenario set could not be reconstructed.`);
    for (const scenario of selected) scenario.run(candidate.after);
    currentByCode.set(candidate.code, { identity, current });
  }
}

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ dryRun: true, candidates: candidates.length, scenarios: candidates.reduce((sum, item) => sum + item.scenarioCount, 0), preflight: 'passed' }));
  process.exit(0);
}

const results = [];
let next = 0;
let failure;
const outputPath = planPath.replace(/\.json$/i, '.supabase-results.json');
const worker = async () => {
  while (failure === undefined) {
    const index = next++;
    if (index >= candidates.length) return;
    const candidate = candidates[index];
    const { identity, current } = currentByCode.get(candidate.code);
    const nextText = candidate.effectTextAfter ?? candidate.publishedText;
    try {
      const { data: updated, error: updateError } = await db.from('tcg_card_rule_revisions')
        .update({ effect_text: nextText, effect_schema: candidate.after })
        .eq('ruleset_id', plan.rulesetId).eq('identity_id', identity.id)
        .eq('effect_text', current.effect_text).eq('effect_schema', JSON.stringify(current.effect_schema))
        .select('identity_id');
      if (updateError) throw updateError;
      if (updated.length !== 1) throw new Error(`${candidate.code}: concurrent update detected.`);
      const { data: readback, error: readError } = await db.from('tcg_card_rule_revisions')
        .select('effect_schema,effect_text').eq('ruleset_id', plan.rulesetId).eq('identity_id', identity.id).single();
      if (readError) throw readError;
      if (hash(readback.effect_schema) !== candidate.afterHash || canonical(readback.effect_schema) !== canonical(candidate.after) || readback.effect_text !== nextText) {
        throw new Error(`${candidate.code}: Supabase readback differs from the verified plan.`);
      }
      results.push({ code: candidate.code, status: 'PUBLISHED_AND_READBACK_TESTED' });
      writeFileSync(outputPath, JSON.stringify(results, null, 2));
    } catch (error) {
      failure = error;
      return;
    }
  }
};
await Promise.all(Array.from({ length: 6 }, () => worker()));
if (failure !== undefined) throw failure;
if (results.length !== candidates.length) throw new Error('Not every schema update was read back successfully.');
await import('./bump-play-rules-cache-revision.mjs');
console.log(JSON.stringify({ published: results.length, readbackVerified: results.length === candidates.length, scenariosPassed: candidates.reduce((sum, item) => sum + item.scenarioCount, 0), rulesetId: plan.rulesetId }));
