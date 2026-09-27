import { createClient } from '@supabase/supabase-js';

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const storage = client.storage.from('tcg-card-images');
const totals = { thumb: { count: 0, bytes: 0 }, small: { count: 0, bytes: 0 }, large: { count: 0, bytes: 0 }, other: { count: 0, bytes: 0 } };

async function list(path) {
  const { data, error } = await storage.list(path, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw new Error(`${path}: ${error.message}`);
  return data;
}

const sets = await list('one-piece');
for (const set of sets.filter(item => item.id === null)) {
  const setPath = `one-piece/${set.name}`;
  for (const language of (await list(setPath)).filter(item => item.id === null)) {
    const languagePath = `${setPath}/${language.name}`;
    for (const variant of await list(languagePath)) {
      const variantPath = `${languagePath}/${variant.name}`;
      if (variant.id !== null) {
        totals.other.count += 1;
        totals.other.bytes += Number(variant.metadata?.size ?? 0);
        continue;
      }
      const bucket = totals[variant.name] ?? totals.other;
      const files = await list(variantPath);
      for (const file of files) {
        if (file.id === null) continue;
        bucket.count += 1;
        bucket.bytes += Number(file.metadata?.size ?? 0);
      }
    }
  }
}
console.log(JSON.stringify(totals, null, 2));
