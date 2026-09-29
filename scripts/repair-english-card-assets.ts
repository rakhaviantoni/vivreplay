import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before importing.');
}

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = 'tcg-card-images';
const CONCURRENCY = 10;

// All 61 EB04 cards
const EB04_CODES = Array.from({ length: 61 }, (_, i) => `EB04-${String(i + 1).padStart(3, '0')}`);
// 5 previously missing OP02 cards
const OP02_TARGETS = ['OP02-004', 'OP02-013', 'OP02-085', 'OP02-099', 'OP02-120'];
// 9 previously missing OP03 cards
const OP03_TARGETS = [
  'OP03-003', 'OP03-006', 'OP03-032', 'OP03-050',
  'OP03-070', 'OP03-078', 'OP03-081', 'OP03-092', 'OP03-112'
];

interface CardToFix {
  code: string;
  folder: string;
  setCode: string;
  enImageUrl: string;
}

async function boundedMap<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await task(items[index], index);
      }
    })
  );
  return results;
}

async function resolveEnglishImageUrl(code: string, folder: string, setCode: string): Promise<CardToFix> {
  const pageUrl = `https://oplaytcg.com/en/cards/${code}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VivrePlayCardRepair/1.0)' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const match = html.match(/\\"card\\":\s*(\{[^<]+?\})\s*,\s*\\"lang\\"/);
      if (!match) throw new Error(`Card JSON not found in ${pageUrl}`);

      const rawJson = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      const raw = JSON.parse(rawJson);

      const enPrinting = raw.printings?.find(
        (p: any) => p.language_code === 'en' && (p.source_variant === 'base' || !p.source_variant)
      ) || raw.printings?.find((p: any) => p.language_code === 'en');

      if (!enPrinting) {
        throw new Error(`No English printing found for ${code}`);
      }

      const enImageUrl: string = enPrinting.imageFull || enPrinting.image;
      if (!enImageUrl || enImageUrl.includes('/cn/')) {
        throw new Error(`Resolved image URL is still non-English: ${enImageUrl}`);
      }

      return { code, folder, setCode, enImageUrl };
    } catch (err) {
      lastError = err;
      await new Promise(r => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new Error(`Failed to resolve English image for ${code}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function uploadEnglishImage(card: CardToFix) {
  let imgRes: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      imgRes = await fetch(card.enImageUrl, {
        headers: { accept: 'image/webp,image/*;q=0.8' },
        signal: AbortSignal.timeout(20_000),
      });
      if (imgRes.ok) break;
    } catch {
      await new Promise(r => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  if (!imgRes || !imgRes.ok) {
    throw new Error(`Failed to fetch image for ${card.code} from ${card.enImageUrl}`);
  }

  const rawBuffer = Buffer.from(await imgRes.arrayBuffer());
  const smallBuffer = await sharp(rawBuffer)
    .rotate()
    .resize({ width: 420, withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();

  const smallKey = `one-piece/${card.folder}/en/small/${card.code}.webp`;
  const canonicalKey = `one-piece/${card.folder}/en/${card.code}.webp`;

  // Overwrite small key
  const { error: smallErr } = await supabase.storage.from(BUCKET).upload(smallKey, smallBuffer, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: true,
  });
  if (smallErr) throw smallErr;

  // Overwrite canonical key
  const { error: canonicalErr } = await supabase.storage.from(BUCKET).upload(canonicalKey, smallBuffer, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: true,
  });
  if (canonicalErr) throw canonicalErr;

  // Update card_image_url in tcg_card_printings
  const { error: printErr } = await supabase
    .from('tcg_card_printings')
    .update({ card_image_url: card.enImageUrl })
    .eq('printing_code', card.code)
    .eq('language', 'EN')
    .eq('variant', 'Standard');
  if (printErr) throw printErr;

  // Update tcg_card_asset_sources
  const { error: srcErr } = await supabase
    .from('tcg_card_asset_sources')
    .update({
      source_url: card.enImageUrl,
      storage_path: smallKey.toLowerCase(),
      storage_variants: { small: smallKey.toLowerCase() },
      approved_for_display: true,
      approved_for_storage: true,
    })
    .eq('storage_path', smallKey.toLowerCase());
  if (srcErr) console.warn(`Asset source update warning for ${card.code}:`, srcErr.message);
}

async function main() {
  console.log('Resolving English image URLs for all 61 EB04 cards, 5 OP02 cards, and 9 OP03 cards...');

  const eb04Items = EB04_CODES.map(c => ({ code: c, folder: 'EB04', setCode: 'EB-04' }));
  const op02Items = OP02_TARGETS.map(c => ({ code: c, folder: 'OP02', setCode: 'OP-02' }));
  const op03Items = OP03_TARGETS.map(c => ({ code: c, folder: 'OP03', setCode: 'OP-03' }));

  const allItems = [...eb04Items, ...op02Items, ...op03Items];

  const resolved = await boundedMap(allItems, CONCURRENCY, async (item, idx) => {
    const card = await resolveEnglishImageUrl(item.code, item.folder, item.setCode);
    console.log(`[${idx + 1}/${allItems.length}] Resolved EN image for ${card.code}: ${card.enImageUrl}`);
    return card;
  });

  console.log(`\nAll ${resolved.length} English image URLs resolved. Uploading English artwork to Supabase Storage...`);

  let count = 0;
  await boundedMap(resolved, CONCURRENCY, async (card) => {
    await uploadEnglishImage(card);
    count++;
    console.log(`[${count}/${resolved.length}] Uploaded English artwork & updated DB for ${card.code}`);
  });

  // Also clean up any lingering /cn/ URLs in OP-02 and OP-03 printings table
  console.log('\nUpdating remaining OP-02 and OP-03 card_image_url entries from /cn/ to /en/ ...');
  const { data: op02cn } = await supabase
    .from('tcg_card_printings')
    .select('id,printing_code,card_image_url')
    .eq('set_code', 'OP-02')
    .eq('language', 'EN')
    .like('card_image_url', '%/cn/%');

  for (const row of op02cn ?? []) {
    const fixedUrl = row.card_image_url.replace('/cn/', '/en/');
    await supabase.from('tcg_card_printings').update({ card_image_url: fixedUrl }).eq('id', row.id);
  }
  console.log(`Cleaned up ${op02cn?.length ?? 0} OP-02 card_image_url entries.`);

  const { data: op03cn } = await supabase
    .from('tcg_card_printings')
    .select('id,printing_code,card_image_url')
    .eq('set_code', 'OP-03')
    .eq('language', 'EN')
    .like('card_image_url', '%/cn/%');

  for (const row of op03cn ?? []) {
    const fixedUrl = row.card_image_url.replace('/cn/', '/en/');
    await supabase.from('tcg_card_printings').update({ card_image_url: fixedUrl }).eq('id', row.id);
  }
  console.log(`Cleaned up ${op03cn?.length ?? 0} OP-03 card_image_url entries.`);

  console.log('\nAll English card assets successfully repaired and updated!');
}

main().catch(err => {
  console.error('Fatal error during repair:', err);
  process.exit(1);
});
