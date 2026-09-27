import { createClient } from '@supabase/supabase-js';

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const dryRun = process.env.CARD_ASSET_PRUNE_DRY_RUN === 'true';
const kind = process.env.CARD_ASSET_PRUNE_KIND ?? 'large';
if (!['thumb', 'large'].includes(kind)) throw new Error('CARD_ASSET_PRUNE_KIND must be thumb or large.');
const assets = [];
for (let from = 0; ; from += 1_000) {
  const { data, error } = await client.from('tcg_card_assets').select('id,object_key').eq('kind', kind).range(from, from + 999);
  if (error) throw error;
  assets.push(...data);
  if (data.length < 1_000) break;
}

const objectKeys = [...new Set(assets.map(asset => asset.object_key))];
console.log(JSON.stringify({ kind, catalogRows: assets.length, storageObjects: objectKeys.length, dryRun }));
if (!dryRun) {
  const batches = Array.from({ length: Math.ceil(objectKeys.length / 100) }, (_, index) => objectKeys.slice(index * 100, index * 100 + 100));
  let cursor = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (cursor < batches.length) {
      const batch = batches[cursor++];
      const { error: removeError } = await client.storage.from('tcg-card-images').remove(batch);
      if (removeError) throw removeError;
    }
  }));
  const { error: deleteError } = await client.from('tcg_card_assets').delete().eq('kind', kind);
  if (deleteError) throw deleteError;
  console.log(JSON.stringify({ removedCatalogRows: assets.length, removedStorageObjects: objectKeys.length }));
}
