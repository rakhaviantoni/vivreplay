import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = 'tcg-card-images';
const assets = ['one-piece/game-assets/back-card.webp', 'one-piece/game-assets/don-back.webp'];

if (!supabaseUrl || !supabaseKey) throw new Error('Supabase URL and secret key are required.');
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
const workDir = mkdtempSync(join(tmpdir(), 'vivreplay-play-assets-'));
const wrangler = join(process.cwd(), 'node_modules/wrangler/bin/wrangler.js');

try {
  for (const objectKey of assets) {
    const { data, error } = await supabase.storage.from(bucket).download(objectKey);
    if (error || !data) throw new Error(`Supabase download failed for ${objectKey}: ${error?.message ?? 'empty object'}`);
    const sourcePath = join(workDir, objectKey.split('/').at(-1));
    const verifyPath = `${sourcePath}.verify`;
    const sourceBytes = Buffer.from(await data.arrayBuffer());
    if (!sourceBytes.length) throw new Error(`Refusing to upload empty asset: ${objectKey}`);
    writeFileSync(sourcePath, sourceBytes);

    const baseArgs = ['r2', 'object'];
    execFileSync(process.execPath, [wrangler, ...baseArgs, 'put', `${bucket}/${objectKey}`, '--remote', `--file=${sourcePath}`, '--content-type=image/webp', '--cache-control=public, max-age=31536000, immutable', '--force'], { stdio: 'inherit' });
    execFileSync(process.execPath, [wrangler, ...baseArgs, 'get', `${bucket}/${objectKey}`, '--remote', `--file=${verifyPath}`], { stdio: 'inherit' });

    const uploadedBytes = readFileSync(verifyPath);
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    if (hash(sourceBytes) !== hash(uploadedBytes)) throw new Error(`R2 verification mismatch for ${objectKey}`);
    console.log(`Verified ${objectKey} (${sourceBytes.length} bytes)`);
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
