import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const FALLBACK_SUPABASE_URL = 'https://shqwaqxpxsyjafxdcibj.supabase.co';
const FALLBACK_SUPABASE_KEY = 'sb_publishable_yg4vygJx5VP-ecakkYF8WA_WTwBloIZ';

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_KEY;
  if (!url || !key) throw new Error('Supabase server configuration is missing.');
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: cookiesToSet => {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components cannot write response cookies. */ }
      },
    },
  });
}
