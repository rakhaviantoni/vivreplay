import { createBrowserClient } from '@supabase/ssr';

const FALLBACK_SUPABASE_URL = 'https://shqwaqxpxsyjafxdcibj.supabase.co';
const FALLBACK_SUPABASE_KEY = 'sb_publishable_yg4vygJx5VP-ecakkYF8WA_WTwBloIZ';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_KEY;
  if (!url || !key) throw new Error('Supabase browser configuration is missing.');
  return createBrowserClient(url, key);
}
