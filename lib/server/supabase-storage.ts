import { createClient } from '@supabase/supabase-js';

export const TCG_STORAGE_BUCKET = 'tcg-card-images';
export const SITE_ASSET_PREFIX = 'one-piece/site-assets';

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function siteAssetObjectKey(filename: string) {
  return `${SITE_ASSET_PREFIX}/${filename}`;
}
