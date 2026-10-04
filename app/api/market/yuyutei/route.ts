import { database } from '@/lib/server/database';
import { supabaseAdmin } from '@/lib/server/supabase-storage';

const printingIdPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function parseJson(value: unknown) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

async function fromD1(printingId: string) {
  const { results } = await database().prepare(`
    SELECT amount,currency,observed_at,source_kind,source_payload FROM (
      SELECT p.amount,p.currency,p.observed_at,p.source_kind,s.payload AS source_payload
      FROM tcg_price_observations p
      LEFT JOIN tcg_source_records s ON s.id=p.source_record_id
      WHERE p.printing_id=? AND p.source='yuyutei' AND p.source_kind='market_price'
      ORDER BY p.observed_at DESC LIMIT 60
    ) ORDER BY observed_at ASC
  `).bind(printingId).all<Record<string, unknown>>();
  return results.map(row => ({
    amount: row.amount, currency: row.currency, observed_at: row.observed_at,
    source_kind: row.source_kind,
    source_record: row.source_payload == null ? null : { payload: parseJson(row.source_payload) },
  }));
}

async function fromSupabase(printingId: string) {
  const db = supabaseAdmin();
  if (!db) throw new Error('Price history is unavailable.');
  const { data, error } = await db.from('tcg_price_observations')
    .select('amount,currency,observed_at,source_kind,source_record:tcg_source_records(payload)')
    .eq('printing_id', printingId).eq('source', 'yuyutei').eq('source_kind', 'market_price')
    .order('observed_at', { ascending: false }).limit(60);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function GET(request: Request) {
  const configuredRate=Number(process.env.JPY_TO_IDR_RATE??'');
  const jpyToIdrRate=Number.isFinite(configuredRate)&&configuredRate>0?configuredRate:110;
  const printingId = new URL(request.url).searchParams.get('printingId')?.trim() ?? '';
  if (!printingIdPattern.test(printingId)) return Response.json({ history: [] }, { status: 400 });
  let history;
  try { history = await fromD1(printingId); }
  catch {
    try { history = await fromSupabase(printingId); }
    catch { return Response.json({ history: [],jpyToIdrRate }, { status: 503 }); }
  }
  return Response.json({ history,jpyToIdrRate }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
}
