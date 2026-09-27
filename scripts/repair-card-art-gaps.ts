import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = 'tcg-card-images';

type Target = {
  code: string;
  source: string;
  sourceType: 'official' | 'retailer' | 'catalog-variant';
  exact: boolean;
};

// The OPTCG feed has null URLs for these legacy entries. The two DON fallbacks
// deliberately use their matching non-gold printings until the upstream source
// publishes the gold files; this keeps the card visible without claiming it is
// the exact foil scan in source metadata.
const targets: Target[] = [
  { code: 'P-038', source: 'https://onepiece-cardgame.com/images/cardlist/card/P-038.png', sourceType: 'official', exact: true },
  { code: 'P-080', source: 'https://onepiece-cardgame.com/images/cardlist/card/P-080.png', sourceType: 'official', exact: true },
  { code: 'P-114', source: 'https://onepiece-cardgame.com/images/cardlist/card/P-114.png', sourceType: 'official', exact: true },
  { code: 'P-138', source: 'https://onepiece-cardgame.com/images/cardlist/card/P-138.png', sourceType: 'official', exact: true },
  { code: 'P-142', source: 'https://onepiece-cardgame.com/images/cardlist/card/P-142.png', sourceType: 'official', exact: true },
  { code: 'DON_169', source: 'https://static.dotgg.gg/onepiece/card/DON-655121.webp', sourceType: 'official', exact: true },
  { code: 'DON_132', source: 'https://animepoint.ph/cdn/shop/files/70726f647563742f454230336b696e6e646f6e332e6a7067003633300000740023666666666666.jpg?v=1771751413&width=1445', sourceType: 'retailer', exact: true },
  { code: 'DON_181', source: 'https://makeshop-multi-images.akamaized.net/toreque01/itemimages/000000002441_otsVujA.jpg', sourceType: 'retailer', exact: true },
  { code: 'DON_185', source: 'https://www.optcgapi.com/media/static/Card_Images/DON_Card_Alternate_Art_-_The_Time_of_Battle.jpg', sourceType: 'catalog-variant', exact: false },
  { code: 'P-700', source: 'https://onepiece-cardgame.com/images/cardlist/card/P-001.png', sourceType: 'catalog-variant', exact: false },
];

type Printing = { id: string; printing_code: string; set_code: string; language: string; source_payload: Record<string, unknown> | null };

async function download(source: string) {
  const response = await fetch(source, { headers: { accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8' }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${source} returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function repair(target: Target) {
  const { data, error } = await supabase
    .from('tcg_card_printings')
    .select('id,printing_code,set_code,language,source_payload')
    .eq('printing_code', target.code)
    .eq('language', 'EN')
    .single<Printing>();
  if (error) throw error;

  const source = await download(target.source);
  const objectKey = `one-piece/${data.set_code.toUpperCase().replaceAll('-', '')}/en/small/${target.code.toUpperCase()}.webp`;
  const image = await sharp(source).rotate().resize({ width: 420, withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toBuffer();
  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectKey, image, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
  if (uploadError) throw uploadError;

  const { error: assetError } = await supabase.from('tcg_card_assets').upsert({ printing_id: data.id, kind: 'small', object_key: objectKey, width: 420 }, { onConflict: 'printing_id,kind' });
  if (assetError) throw assetError;

  const sourcePayload = { ...(data.source_payload ?? {}), image_repair: { source: target.source, source_type: target.sourceType, exact_printing_art: target.exact, repaired_at: new Date().toISOString() } };
  const { error: printingError } = await supabase.from('tcg_card_printings').update({ card_image_url: target.source, source_payload: sourcePayload }).eq('id', data.id);
  if (printingError) throw printingError;

  const { error: sourceError } = await supabase.from('tcg_card_asset_sources').upsert({ printing_id: data.id, source_type: target.sourceType, source_url: target.source, rights_status: 'user_requested_import_pending_review', storage_path: objectKey, storage_variants: { small: objectKey }, stored_format: 'webp', approved_for_display: false, approved_for_storage: false }, { onConflict: 'source_url' });
  if (sourceError) throw sourceError;
  return { code: target.code, exact: target.exact, objectKey };
}

const repaired = await Promise.all(targets.map(repair));
console.log(JSON.stringify({ repaired }, null, 2));
