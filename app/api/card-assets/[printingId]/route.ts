import { database } from '@/lib/server/database';
import { supabaseAdmin, TCG_STORAGE_BUCKET } from '@/lib/server/supabase-storage';

const allowedKinds = new Set(['small']);

async function getObjectKey(printingId: string, kind: string) {
  try {
    const row = await database().prepare('SELECT object_key FROM tcg_card_assets WHERE printing_id=? AND kind=? LIMIT 1')
      .bind(printingId, kind).first<{ object_key: string }>();
    if (row?.object_key) return row.object_key;
  } catch { /* Supabase remains the metadata fallback */ }
  const supabase = supabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase.from('tcg_card_assets').select('object_key')
    .eq('printing_id', printingId).eq('kind', kind).maybeSingle();
  return data?.object_key ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ printingId: string }> }) {
  const { printingId } = await params;
  const kind = new URL(request.url).searchParams.get('kind') ?? 'small';
  if (!/^[0-9a-f-]{36}$/i.test(printingId) || !allowedKinds.has(kind)) return new Response('Not found', { status: 404 });
  const objectKey = await getObjectKey(printingId, kind);
  if (!objectKey) return new Response('Not found', { status: 404 });
  const supabase = supabaseAdmin();
  if (!supabase) return new Response('Asset storage is unavailable', { status: 503 });
  const { data, error } = await supabase.storage.from(TCG_STORAGE_BUCKET).download(objectKey);
  if (error || !data) return new Response('Not found', { status: 404 });
  return new Response(data.stream(), { headers: {
    'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  } });
}
