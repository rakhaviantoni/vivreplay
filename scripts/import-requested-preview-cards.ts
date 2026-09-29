import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before importing.');
}

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = 'tcg-card-images';
const SCRAPE_CONCURRENCY = 8;
const UPLOAD_CONCURRENCY = 6;

const CARD_URLS = [
  // OP18 (13 cards)
  'https://oplaytcg.com/en/cards/OP18-001',
  'https://oplaytcg.com/en/cards/OP18-003',
  'https://oplaytcg.com/en/cards/OP18-021',
  'https://oplaytcg.com/en/cards/OP18-022',
  'https://oplaytcg.com/en/cards/OP18-028',
  'https://oplaytcg.com/en/cards/OP18-031',
  'https://oplaytcg.com/en/cards/OP18-041',
  'https://oplaytcg.com/en/cards/OP18-056',
  'https://oplaytcg.com/en/cards/OP18-060',
  'https://oplaytcg.com/en/cards/OP18-065',
  'https://oplaytcg.com/en/cards/OP18-078',
  'https://oplaytcg.com/en/cards/OP18-079',
  'https://oplaytcg.com/en/cards/OP18-119',

  // EB05 (47 cards)
  'https://oplaytcg.com/en/cards/EB05-001',
  'https://oplaytcg.com/en/cards/EB05-002',
  'https://oplaytcg.com/en/cards/EB05-004',
  'https://oplaytcg.com/en/cards/EB05-005',
  'https://oplaytcg.com/en/cards/EB05-006',
  'https://oplaytcg.com/en/cards/EB05-007',
  'https://oplaytcg.com/en/cards/EB05-009',
  'https://oplaytcg.com/en/cards/EB05-010',
  'https://oplaytcg.com/en/cards/EB05-011',
  'https://oplaytcg.com/en/cards/EB05-012',
  'https://oplaytcg.com/en/cards/EB05-013',
  'https://oplaytcg.com/en/cards/EB05-014',
  'https://oplaytcg.com/en/cards/EB05-016',
  'https://oplaytcg.com/en/cards/EB05-017',
  'https://oplaytcg.com/en/cards/EB05-018',
  'https://oplaytcg.com/en/cards/EB05-020',
  'https://oplaytcg.com/en/cards/EB05-021',
  'https://oplaytcg.com/en/cards/EB05-022',
  'https://oplaytcg.com/en/cards/EB05-023',
  'https://oplaytcg.com/en/cards/EB05-024',
  'https://oplaytcg.com/en/cards/EB05-025',
  'https://oplaytcg.com/en/cards/EB05-027',
  'https://oplaytcg.com/en/cards/EB05-028',
  'https://oplaytcg.com/en/cards/EB05-029',
  'https://oplaytcg.com/en/cards/EB05-031',
  'https://oplaytcg.com/en/cards/EB05-034',
  'https://oplaytcg.com/en/cards/EB05-035',
  'https://oplaytcg.com/en/cards/EB05-036',
  'https://oplaytcg.com/en/cards/EB05-037',
  'https://oplaytcg.com/en/cards/EB05-038',
  'https://oplaytcg.com/en/cards/EB05-039',
  'https://oplaytcg.com/en/cards/EB05-042',
  'https://oplaytcg.com/en/cards/EB05-043',
  'https://oplaytcg.com/en/cards/EB05-044',
  'https://oplaytcg.com/en/cards/EB05-045',
  'https://oplaytcg.com/en/cards/EB05-046',
  'https://oplaytcg.com/en/cards/EB05-047',
  'https://oplaytcg.com/en/cards/EB05-048',
  'https://oplaytcg.com/en/cards/EB05-050',
  'https://oplaytcg.com/en/cards/EB05-051',
  'https://oplaytcg.com/en/cards/EB05-052',
  'https://oplaytcg.com/en/cards/EB05-053',
  'https://oplaytcg.com/en/cards/EB05-054',
  'https://oplaytcg.com/en/cards/EB05-055',
  'https://oplaytcg.com/en/cards/EB05-056',
  'https://oplaytcg.com/en/cards/EB05-057',
  'https://oplaytcg.com/en/cards/EB05-060',
];

interface ScrapedCard {
  sourcePageUrl: string;
  code: string;
  setCode: string;
  setName: string;
  name: string;
  color: string;
  colors: string[];
  cardType: string;
  cost: number;
  power: number;
  life: number | null;
  counter: number;
  rarity: string;
  attribute: string | null;
  traits: string;
  traitsArray: string[];
  effect: string;
  imageUrl: string;
}

function normalizeSetCode(rawSet: string): string {
  const clean = rawSet.trim().toUpperCase();
  const match = clean.match(/^([A-Z]+)[-_]?0*(\d+)$/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}`;
  }
  return clean;
}

const SET_NAMES: Record<string, string> = {
  'OP-18': 'The Dominance of God',
  'EB-05': 'Extra Booster: One Piece Heroines Edition Vol.2',
};

const RARITY_MAP: Record<string, string> = {
  'Super Rare': 'SR',
  'Secret Rare': 'SEC',
  'Leader': 'L',
  'Rare': 'R',
  'Uncommon': 'UC',
  'Common': 'C',
  'Special': 'SP',
  'Promo': 'P',
};

const TYPE_MAP: Record<string, string> = {
  LEADER: 'Leader',
  CHARACTER: 'Character',
  EVENT: 'Event',
  STAGE: 'Stage',
};

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

async function scrapeCard(pageUrl: string): Promise<ScrapedCard> {
  const res = await fetch(pageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VivrePlayCardImporter/1.0)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${pageUrl}`);
  const html = await res.text();
  const match = html.match(/\\"card\\":\s*(\{[^<]+?\})\s*,\s*\\"lang\\"/);
  if (!match) throw new Error(`Failed to find card JSON in ${pageUrl}`);

  const rawJson = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const raw = JSON.parse(rawJson);

  const code: string = raw.code.trim();
  const rawSetCode = (raw.originSet || code.split('-')[0] || '').trim().toUpperCase();
  const setCode = normalizeSetCode(rawSetCode);
  const setName = SET_NAMES[setCode] || raw.originSetName || setCode;
  const name: string = (raw.name || '').trim();

  const colorsList: string[] = Array.isArray(raw.colors) && raw.colors.length > 0
    ? raw.colors
    : (Array.isArray(raw.colorNames) && raw.colorNames.length > 0 ? raw.colorNames : [raw.color || 'Red']);
  const color = colorsList.join(' ');

  const rawType = (raw.type || raw.typeCode || 'CHARACTER').toUpperCase();
  const cardType = TYPE_MAP[rawType] || 'Character';

  const cost = raw.cost !== null && raw.cost !== undefined ? Number(raw.cost) : 0;
  const power = raw.power !== null && raw.power !== undefined ? Number(raw.power) : 0;
  const life = raw.life !== null && raw.life !== undefined ? Number(raw.life) : null;
  const counter = raw.counter !== null && raw.counter !== undefined ? Number(raw.counter) : 0;

  const rawRarity = raw.printings?.[0]?.rarity_code || raw.rarity || 'P';
  const rarity = RARITY_MAP[rawRarity] || rawRarity;

  const attribute = raw.attribute || raw.attributeCode || null;

  const traitsArray: string[] = Array.isArray(raw.traits)
    ? raw.traits.map((t: any) => (typeof t === 'string' ? t.trim() : (t.name || t.code || '').trim())).filter(Boolean)
    : (typeof raw.traits === 'string' ? raw.traits.split(/\s*\/\s*/).filter(Boolean) : []);
  const traits = traitsArray.join(' / ');

  const effect: string = (raw.effect || raw.texts?.[0]?.effect || '').trim();

  const printing0 = raw.printings?.[0];
  const imageUrl: string = printing0?.imageFull || printing0?.image || `https://cards.oplaytcg.com/${setCode}/en/${code}.webp`;

  return {
    sourcePageUrl: pageUrl,
    code,
    setCode,
    setName,
    name,
    color,
    colors: colorsList,
    cardType,
    cost,
    power,
    life,
    counter,
    rarity,
    attribute,
    traits,
    traitsArray,
    effect,
    imageUrl,
  };
}

function objectKeyFor(card: ScrapedCard, kind?: 'small'): string {
  const normSet = card.setCode.toUpperCase().replaceAll('-', '');
  const code = card.code.toUpperCase();
  if (kind === 'small') {
    return `one-piece/${normSet}/en/small/${code}.webp`;
  }
  return `one-piece/${normSet}/en/${code}.webp`;
}

async function uploadCardImages(card: ScrapedCard, printingId: string) {
  let imgRes: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      imgRes = await fetch(card.imageUrl, {
        headers: { accept: 'image/webp,image/*;q=0.8' },
        signal: AbortSignal.timeout(20_000),
      });
      if (imgRes.ok) break;
    } catch {
      await new Promise(r => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  if (!imgRes || !imgRes.ok) {
    throw new Error(`Failed to fetch image for ${card.code} from ${card.imageUrl}`);
  }

  const rawBuffer = Buffer.from(await imgRes.arrayBuffer());
  const smallBuffer = await sharp(rawBuffer)
    .rotate()
    .resize({ width: 420, withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();

  const smallKey = objectKeyFor(card, 'small');
  const canonicalKey = objectKeyFor(card);

  // Upload small key
  const { error: smallUploadErr } = await supabase.storage.from(BUCKET).upload(smallKey, smallBuffer, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: true,
  });
  if (smallUploadErr) throw smallUploadErr;

  // Also upload canonical key
  const { error: canonicalUploadErr } = await supabase.storage.from(BUCKET).upload(canonicalKey, smallBuffer, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: true,
  });
  if (canonicalUploadErr) throw canonicalUploadErr;

  // Asset row in tcg_card_assets
  const { error: assetErr } = await supabase.from('tcg_card_assets').upsert(
    [
      {
        printing_id: printingId,
        kind: 'small',
        object_key: smallKey,
        width: 420,
      },
    ],
    { onConflict: 'printing_id,kind' }
  );
  if (assetErr) throw assetErr;

  // Asset source row in tcg_card_asset_sources
  const now = new Date().toISOString();
  const { error: sourceErr } = await supabase.from('tcg_card_asset_sources').upsert(
    [
      {
        printing_id: printingId,
        source_type: 'oplaytcg',
        source_url: card.imageUrl,
        rights_status: 'user_requested_import_pending_review',
        observed_at: now,
        storage_path: smallKey.toLowerCase(),
        storage_variants: {
          small: smallKey.toLowerCase(),
        },
        stored_format: 'webp',
        approved_for_display: false,
        approved_for_storage: false,
      },
    ],
    { onConflict: 'source_url' }
  );
  if (sourceErr) throw sourceErr;
}

async function main() {
  console.log(`Starting concurrent scrape of ${CARD_URLS.length} preview cards...`);
  const cards = await boundedMap(CARD_URLS, SCRAPE_CONCURRENCY, async (url, idx) => {
    const card = await scrapeCard(url);
    console.log(`[${idx + 1}/${CARD_URLS.length}] Scraped ${card.code} (${card.name})`);
    return card;
  });

  console.log(`\nSuccessfully scraped all ${cards.length} cards. Initializing database upserts...`);

  // 1. Ensure game
  const { data: game, error: gameError } = await supabase
    .from('tcg_games')
    .upsert({ slug: 'one-piece', name: 'One Piece Card Game' }, { onConflict: 'slug' })
    .select('id')
    .single();
  if (gameError || !game) throw gameError || new Error('Game not found');

  // 2. Ensure sets
  const setCodes = [...new Set(cards.map(c => c.setCode))];
  const setsToUpsert = setCodes.map(setCode => ({
    game_id: game.id,
    external_set_id: setCode,
    name: SET_NAMES[setCode] || setCode,
    set_kind: 'booster',
  }));
  const { error: setError } = await supabase.from('tcg_sets').upsert(setsToUpsert, { onConflict: 'game_id,external_set_id' });
  if (setError) throw setError;

  const { data: setRows, error: setLookupError } = await supabase
    .from('tcg_sets')
    .select('id,external_set_id')
    .eq('game_id', game.id)
    .in('external_set_id', setCodes);
  if (setLookupError || !setRows) throw setLookupError || new Error('Sets lookup failed');
  const setIdByCode = new Map(setRows.map(s => [s.external_set_id, s.id]));

  // 3. Upsert identities
  const now = new Date().toISOString();
  const identityPayloads = cards.map(c => ({
    game_id: game.id,
    code: c.code,
    name: c.name,
    color: c.color,
    card_type: c.cardType,
    cost: c.cost,
    power: c.power,
    effect_text: c.effect,
    updated_at: now,
  }));
  const { error: identErr } = await supabase.from('tcg_card_identities').upsert(identityPayloads, { onConflict: 'game_id,code' });
  if (identErr) throw identErr;

  const { data: identityRows, error: identLookupErr } = await supabase
    .from('tcg_card_identities')
    .select('id,code')
    .eq('game_id', game.id)
    .in('code', cards.map(c => c.code));
  if (identLookupErr || !identityRows) throw identLookupErr || new Error('Identity lookup failed');
  const identityIdByCode = new Map(identityRows.map(i => [i.code, i.id]));

  // 4. Upsert rules and localizations
  const rules = cards.map(c => ({
    identity_id: identityIdByCode.get(c.code)!,
    colors: c.colors.length > 1 ? [c.color] : c.colors,
    card_type: c.cardType,
    cost: c.cost,
    power: c.power,
    life: c.life,
    counter_amount: c.counter,
    attributes: c.attribute ? [c.attribute] : [],
    traits: c.traitsArray,
    updated_at: now,
  }));

  const localizations = cards.map(c => ({
    identity_id: identityIdByCode.get(c.code)!,
    language: 'EN',
    name: c.name,
    effect_text: c.effect,
    traits_text: c.traits,
    updated_at: now,
  }));

  const [{ error: rulesErr }, { error: locErr }] = await Promise.all([
    supabase.from('tcg_card_rules').upsert(rules, { onConflict: 'identity_id' }),
    supabase.from('tcg_card_localizations').upsert(localizations, { onConflict: 'identity_id,language' }),
  ]);
  if (rulesErr) throw rulesErr;
  if (locErr) throw locErr;

  // 5. Update any previously imported 'Standard' printings for these preview cards to 'Preview'
  const cardCodes = cards.map(c => c.code);
  await supabase
    .from('tcg_card_printings')
    .update({
      variant: 'Preview',
      source_kind: 'oplaytcg-preview',
      source_payload: {
        source: 'oplaytcg',
        preview: true,
        queue_eligibility: ['casual', 'new-cards', 'extended'],
        ranked_eligible: false,
        imported_at: now,
      },
    })
    .in('printing_code', cardCodes)
    .eq('language', 'EN')
    .eq('variant', 'Standard');

  // 6. Upsert printings with variant: 'Preview'
  const printings = cards.map(c => ({
    identity_id: identityIdByCode.get(c.code)!,
    language: 'EN',
    set_id: setIdByCode.get(c.setCode)!,
    set_code: c.setCode,
    set_name: c.setName,
    printing_code: c.code,
    rarity: c.rarity,
    variant: 'Preview',
    source_kind: 'oplaytcg-preview',
    life: c.life,
    sub_types: c.traits,
    counter_amount: c.counter,
    attribute: c.attribute,
    card_image_id: c.code,
    card_image_url: c.imageUrl,
    source_payload: {
      source: 'oplaytcg',
      preview: true,
      queue_eligibility: ['casual', 'new-cards', 'extended'],
      ranked_eligible: false,
      imported_at: now,
    },
  }));

  const { error: printingErr } = await supabase
    .from('tcg_card_printings')
    .upsert(printings, { onConflict: 'identity_id,language,set_code,variant' });
  if (printingErr) throw printingErr;

  const { data: printingRows, error: printLookupErr } = await supabase
    .from('tcg_card_printings')
    .select('id,printing_code')
    .in('printing_code', cardCodes)
    .eq('language', 'EN')
    .eq('variant', 'Preview');
  if (printLookupErr || !printingRows) throw printLookupErr || new Error('Printing lookup failed');
  const printingIdByCode = new Map(printingRows.map(p => [p.printing_code, p.id]));

  // 7. Concurrently upload images to Supabase storage and create asset records
  console.log(`\nUploading images for ${cards.length} cards to Supabase storage...`);
  let uploadedCount = 0;
  await boundedMap(cards, UPLOAD_CONCURRENCY, async (card, idx) => {
    const printingId = printingIdByCode.get(card.code);
    if (!printingId) throw new Error(`Printing ID missing for ${card.code}`);
    await uploadCardImages(card, printingId);
    uploadedCount++;
    console.log(`[${uploadedCount}/${cards.length}] Uploaded image & asset records for ${card.code}`);
  });

  console.log(`\nAll ${cards.length} cards successfully scraped, imported, and images uploaded to Supabase Storage!`);
}

main().catch(err => {
  console.error('Fatal error during import:', err);
  process.exit(1);
});
