import { database } from '@/lib/server/database';

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

export async function GET() {
  try {
    const result = await fromD1();
    if (result) return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Card rules could not be loaded.' }, { status: 503 }); }
  return Response.json({ error: 'Card rules could not be loaded.' }, { status: 503 });
}
