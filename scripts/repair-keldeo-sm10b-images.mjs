import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const targets = [
  { id: 'c4261b78-0bb6-56f4-b7a6-0cf42f12904c', number: '019', source: 'https://cs-collect.com/cdn/shop/files/SM10b019054.jpg?v=1751035503' },
  { id: 'b0bb42d4-e43f-52d7-9344-ccde76cd83cd', number: '057', source: 'https://www.trollaustraliamelb.com.au/cdn/shop/files/573552.jpg?v=1773117134&width=1946' },
  { id: '87f829b2-bf27-5650-b43f-077e366a9292', number: '064', source: 'https://www.cardrush-pokemon.jp/phone/data/cardrushpokemon/product/20190425_e5d328.jpg' },
];
const config = 'dist/server/wrangler.json';
const env = { ...process.env, WRANGLER_LOG_PATH: join(tmpdir(), 'vivreplay-keldeo-image-repair.log') };
const temp = mkdtempSync(join(tmpdir(), 'vivreplay-keldeo-sm10b-'));
const quote = value => `'${String(value ?? '').replaceAll("'", "''")}'`;
const stableUuid = value => {
  const bytes = createHash('sha256').update(`vivreplay:${value}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const run = (args, options = {}) => execFileSync('node_modules/.bin/wrangler', args, { env, encoding: 'utf8', ...options });

try {
  const ids = targets.map(target => quote(target.id)).join(',');
  const checked = run(['d1', 'execute', 'vivreplay', '--remote', '--config', config, '--json', '--command', `SELECT p.id,p.language,p.set_code,p.printing_code FROM tcg_card_printings p WHERE p.id IN (${ids})`]);
  const rows = JSON.parse(checked)[0]?.results ?? [];
  if (rows.length !== targets.length || targets.some(target => !rows.some(row => row.id === target.id && row.language === 'JP' && row.set_code.toUpperCase() === 'SM10B' && row.printing_code === target.number))) {
    throw new Error('The production printings did not match the expected Japanese SM10b cards; no images were uploaded.');
  }

  const prepared = [];
  for (const [index, target] of targets.entries()) {
    const response = await fetch(target.source, { headers: { accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8' }, signal: AbortSignal.timeout(30000) });
    const type = response.headers.get('content-type')?.split(';')[0].toLowerCase() ?? '';
    if (!response.ok || !type.startsWith('image/')) throw new Error(`${target.number}: source returned ${response.status} (${type || 'no image type'}).`);
    const raw = Buffer.from(await response.arrayBuffer());
    if (!raw.length || raw.length > 12 * 1024 * 1024) throw new Error(`${target.number}: source image size is invalid.`);
    const metadata = await sharp(raw).metadata();
    if (!metadata.width || !metadata.height || metadata.width / metadata.height < 0.58 || metadata.width / metadata.height > 0.82) throw new Error(`${target.number}: source is not a card-shaped image.`);
    const image = await sharp(raw).rotate().resize({ width: 420, withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toBuffer();
    const outputMetadata = await sharp(image).metadata();
    const objectKey = `pokemon/SM10B/jp/small/${target.id}.webp`;
    const file = join(temp, `${index}.webp`);
    writeFileSync(file, image, { mode: 0o600 });
    prepared.push({ ...target, image, file, objectKey, width: outputMetadata.width, height: outputMetadata.height, checksum: createHash('sha256').update(image).digest('hex') });
  }

  for (const item of prepared) run(['r2', 'object', 'put', `tcg-card-images/${item.objectKey}`, '--remote', '--config', config, '--file', item.file, '--content-type', 'image/webp', '--cache-control', 'public, max-age=31536000, immutable', '--force'], { stdio: 'ignore' });

  const now = new Date().toISOString();
  const statements = prepared.flatMap(item => {
    const assetId = stableUuid(`${item.id}:small`);
    const sourceId = stableUuid(`${item.id}:${item.source}`);
    const variants = JSON.stringify({ small: item.objectKey });
    return [
      `INSERT INTO tcg_card_assets (id,printing_id,kind,object_key,mime_type,width,height,byte_size,checksum,created_at) VALUES (${quote(assetId)},${quote(item.id)},'small',${quote(item.objectKey)},'image/webp',${item.width},${item.height},${item.image.length},${quote(item.checksum)},${quote(now)}) ON CONFLICT(printing_id,kind) DO UPDATE SET object_key=excluded.object_key,mime_type=excluded.mime_type,width=excluded.width,height=excluded.height,byte_size=excluded.byte_size,checksum=excluded.checksum;`,
      `UPDATE tcg_card_printings SET card_image_url=${quote(item.source)},card_image_id=${quote(item.number)} WHERE id=${quote(item.id)};`,
      `INSERT OR IGNORE INTO tcg_card_asset_sources (id,printing_id,source_type,source_url,rights_status,observed_at,storage_path,approved_for_display,approved_for_storage,created_at,storage_variants,stored_format) VALUES (${quote(sourceId)},${quote(item.id)},'retailer',${quote(item.source)},'source_attribution_pending_review',${quote(now)},${quote(item.objectKey)},0,0,${quote(now)},${quote(variants)},'webp');`,
    ];
  });
  run(['d1', 'execute', 'vivreplay', '--remote', '--config', config, '--command', statements.join('\n')], { stdio: 'inherit' });
  console.log(JSON.stringify({ repaired: prepared.map(({ number, objectKey }) => ({ number, objectKey })) }, null, 2));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
