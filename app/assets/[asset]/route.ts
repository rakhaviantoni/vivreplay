import { supabaseAdmin, TCG_STORAGE_BUCKET, siteAssetObjectKey } from '@/lib/server/supabase-storage';

const siteAssets = {
  'one-piece-header-bg.webp': 'image/webp',
  'one-piece-header-bg-mobile.webp': 'image/webp',
  'one-piece-leader-back.jpg': 'image/jpeg',
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ asset: string }> }) {
  const { asset } = await params;
  const contentType = siteAssets[asset as keyof typeof siteAssets];
  if (!contentType) return new Response('Not found', { status: 404 });
  const supabase = supabaseAdmin();
  if (!supabase) return new Response('Asset storage is unavailable', { status: 503 });
  const { data, error } = await supabase.storage.from(TCG_STORAGE_BUCKET).download(siteAssetObjectKey(asset));
  if (error || !data) return new Response('Not found', { status: 404 });
  return new Response(data.stream(), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
