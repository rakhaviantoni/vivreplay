import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { SITE_ASSET_PREFIX, TCG_STORAGE_BUCKET } from '../lib/server/supabase-storage';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before uploading site assets.');

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const publicRoot = join(process.cwd(), 'public');
const imageExt = new Set(['.webp', '.jpg', '.jpeg', '.png']);
const mimeByExt: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
}

const files = (await walk(publicRoot)).filter(file => {
  const rel = relative(publicRoot, file).split('\\').join('/');
  if (rel === 'art' || rel.startsWith('art/')) return false;
  return imageExt.has(extname(file).toLowerCase());
});

const uploaded: Array<{ path: string; key: string }> = [];
for (const file of files) {
  const rel = relative(publicRoot, file).split('\\').join('/');
  const objectKey = `${SITE_ASSET_PREFIX}/${rel.replace(/^assets\//, '')}`;
  const bytes = await readFile(file);
  const { error } = await supabase.storage.from(TCG_STORAGE_BUCKET).upload(objectKey, bytes, {
    contentType: mimeByExt[extname(file).toLowerCase()],
    upsert: true,
    cacheControl: '31536000',
  });
  if (error) throw new Error(`${objectKey}: ${error.message}`);
  uploaded.push({ path: `/${rel}`, key: objectKey });
}

console.log(JSON.stringify({ excluded: '/art/*', uploaded: uploaded.length, files: uploaded }, null, 2));
