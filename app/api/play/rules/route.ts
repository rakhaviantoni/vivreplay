import { database } from '@/lib/server/database';
import { supabaseAdmin } from '@/lib/server/supabase-storage';

function jsonValue(value: unknown) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

async function fromD1() {
  const db = database();
  const ruleset = await db.prepare(`SELECT id,code,rules_revision FROM tcg_rulesets WHERE status='published' AND effective_from<=? ORDER BY effective_from DESC LIMIT 1`)
    .bind(new Date().toISOString().slice(0, 10)).first<Record<string, unknown>>();
  if (!ruleset) return null;
  const { results } = await db.prepare(`
    SELECT r.identity_id,r.effect_text,r.effect_schema,i.code
    FROM tcg_card_rule_revisions r JOIN tcg_card_identities i ON i.id=r.identity_id
    WHERE r.ruleset_id=? ORDER BY r.identity_id
  `).bind(String(ruleset.id)).all<Record<string, unknown>>();
  return { ruleset, cards: results.map(row => ({
    identity_id: row.identity_id, effect_text: row.effect_text,
    effect_schema: jsonValue(row.effect_schema), tcg_card_identities: { code: row.code },
  })) };
}

async function fromSupabase() {
  const db = supabaseAdmin();
  if (!db) throw new Error('Supabase rules fallback is unavailable.');
  const { data: ruleset, error } = await db.from('tcg_rulesets').select('id,code,rules_revision')
    .eq('status', 'published').lte('effective_from', new Date().toISOString().slice(0, 10))
    .order('effective_from', { ascending: false }).limit(1).maybeSingle();
  if (error || !ruleset) throw error ?? new Error('No published ruleset.');
  const cards = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: cardsError } = await db.from('tcg_card_rule_revisions')
      .select('identity_id,effect_text,effect_schema,tcg_card_identities!inner(code)')
      .eq('ruleset_id', ruleset.id).order('identity_id').range(from, from + 999);
    if (cardsError) throw cardsError;
    cards.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return { ruleset, cards };
}

export async function GET() {
  try {
    const result = await fromD1();
    if (result) return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch { /* use the retained Supabase fallback */ }
  try { return Response.json(await fromSupabase(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'Card rules could not be loaded.' }, { status: 503 }); }
}
