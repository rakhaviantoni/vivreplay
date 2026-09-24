import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Missing Supabase environment variables.');

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = 'tcg-card-images';
const assets = [
  { name: 'back card', sourceUrl: 'https://oplaytcg.com/sim/backCard.png', objectKey: 'one-piece/game-assets/back-card.webp' },
  { name: 'DON!! back', sourceUrl: 'https://oplaytcg.com/sim/donBack.png', objectKey: 'one-piece/game-assets/don-back.webp' },
] as const;

async function fetchAsset(sourceUrl: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, { headers: { accept: 'image/avif,image/webp,image/png,*/*' } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function main() {
  const { data: run, error: runError } = await supabase.from('tcg_import_runs')
    .insert({ source: 'oplaytcg-simulator-assets', status: 'running' }).select('id').single();
  if (runError) throw runError;

  try {
    for (const asset of assets) {
      const source = await fetchAsset(asset.sourceUrl);
      const webp = await sharp(source).webp({ quality: 90, effort: 5 }).toBuffer();
      const { error } = await supabase.storage.from(bucket).upload(asset.objectKey, webp, {
        contentType: 'image/webp', upsert: true, cacheControl: '31536000',
      });
      if (error) throw new Error(`${asset.name}: ${error.message}`);
    }
    const summary = {
      imported: assets.map(asset => ({ ...asset, format: 'webp', rightsStatus: 'user_requested_import_pending_review' })),
    };
    const { error } = await supabase.from('tcg_import_runs').update({ status: 'completed', summary, completed_at: new Date().toISOString() }).eq('id', run.id);
    if (error) throw error;
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await supabase.from('tcg_import_runs').update({ status: 'failed', summary: { error: error instanceof Error ? error.message : 'unknown failure' }, completed_at: new Date().toISOString() }).eq('id', run.id);
    throw error;
  }
}

main();
