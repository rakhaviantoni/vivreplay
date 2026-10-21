import { database } from '@/lib/server/database';

const publicCardPath = (key: string) => {
  const match=key.replace(/^\/+/, '').match(/^one-piece\/([^/]+)\/([^/]+)\/(?:small\/|thumb\/|large\/)?(.+)$/);
  return match?`/${encodeURIComponent(match[1].replaceAll('-',''))}/${encodeURIComponent(match[2].toLowerCase())}/${match[3].split('/').map(encodeURIComponent).join('/')}`:'';
};
const parseJson = (value: unknown) => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
};

async function fromD1(code: string, gameSlug: 'one-piece'|'pokemon') {
  const db = database();
  const identity = await db.prepare(`SELECT id,code,name,color,card_type,cost,power,effect_text FROM tcg_card_identities WHERE code=? AND game_id=(SELECT id FROM tcg_games WHERE slug=?) LIMIT 1`)
    .bind(code,gameSlug).first<Record<string, unknown>>();
  if (!identity) return null;
  const identityId = String(identity.id);
  const [printingResult, rulingResult] = await Promise.all([
    db.prepare(`
      SELECT p.id,p.language,p.variant,p.rarity,p.set_code,p.set_name,p.printing_code,
        p.card_image_url,p.counter_amount,p.attribute,p.life,p.sub_types,p.source_payload,
        a.kind AS asset_kind,a.object_key
      FROM tcg_card_printings p LEFT JOIN tcg_card_assets a ON a.printing_id=p.id
      WHERE p.identity_id=? ORDER BY p.language,p.variant,a.kind
    `).bind(identityId).all<Record<string, unknown>>(),
    db.prepare(`SELECT id,printing_id,language,question,answer,source_url,source_reference,published_at FROM tcg_card_rulings WHERE identity_id=? ORDER BY published_at DESC`)
      .bind(identityId).all<Record<string, unknown>>(),
  ]);
  const byPrinting = new Map<string, Record<string, unknown>>();
  for (const row of printingResult.results) {
    const id = String(row.id);
    let printing = byPrinting.get(id);
    if (!printing) {
      printing = { ...row, source_payload: parseJson(row.source_payload), tcg_card_assets: [] };
      byPrinting.set(id, printing);
    }
    if (row.asset_kind && row.object_key) (printing.tcg_card_assets as Array<{ kind: unknown; object_key: unknown }>).push({ kind: row.asset_kind, object_key: row.object_key });
  }
  for (const printing of byPrinting.values()) {
    const assets = printing.tcg_card_assets as Array<{ kind: string; object_key: string }>;
    const asset = assets.find(item => item.kind === 'small') ?? assets[0];
    if (asset?.object_key) printing.card_image_url = publicCardPath(asset.object_key);
  }
  return { identity, printings: [...byPrinting.values()], rulings: rulingResult.results };
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode).trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code)) return Response.json({ error: 'Invalid card code.' }, { status: 400 });
  try {
    const gameSlug=new URL(request.url).searchParams.get('game')?.toLowerCase()==='pokemon'?'pokemon':'one-piece';
    const card = await fromD1(code,gameSlug);
    if (!card) return Response.json({ error: 'Card not found.' }, { status: 404 });
    return Response.json(card, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400', 'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable' } });
  } catch { return Response.json({ error: 'Card details are temporarily unavailable.' }, { status: 503 }); }
}
