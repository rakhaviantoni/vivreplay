import {getCurrentUser} from '@/lib/server/auth';
import {db} from '@/lib/server/store';
import {supabaseAdmin, TCG_STORAGE_BUCKET} from '@/lib/server/supabase-storage';

export async function GET(_req: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const a = await getCurrentUser();
  const row = await db().prepare(`SELECT ph.object_key,ph.mime,c.visibility,p.auth_subject,EXISTS(SELECT 1 FROM listings WHERE instance_id=c.id AND status='ACTIVE') AS listed FROM collectible_photos ph JOIN collectible_instances c ON c.id=ph.instance_id JOIN profiles p ON p.id=c.owner_id WHERE ph.id=? AND c.deleted_at IS NULL`).bind(id).first<{object_key: string; mime: string; visibility: string; auth_subject: string; listed: number}>();
  if (!row || !(row.visibility === 'public' || row.auth_subject === a?.id || row.listed)) {
    return new Response('Not found', {status: 404});
  }
  const supabase = supabaseAdmin();
  if (!supabase) return new Response('Not found', {status: 404});
  const {data, error} = await supabase.storage.from(TCG_STORAGE_BUCKET).download(row.object_key);
  if (error || !data) return new Response('Not found', {status: 404});
  return new Response(data.stream(), {
    headers: {
      'Content-Type': row.mime,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
