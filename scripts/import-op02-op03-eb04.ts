import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before importing.');
}

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = 'tcg-card-images';
const SCRAPE_CONCURRENCY = 10;
const UPLOAD_CONCURRENCY = 8;

// Build list of all card codes requested:
// OP02: 121 cards
const OP02_CODES = Array.from({ length: 121 }, (_, i) => `OP02-${String(i + 1).padStart(3, '0')}`);
// OP03: 123 cards
const OP03_CODES = Array.from({ length: 123 }, (_, i) => `OP03-${String(i + 1).padStart(3, '0')}`);
// EB04: 61 cards
const EB04_CODES = Array.from({ length: 61 }, (_, i) => `EB04-${String(i + 1).padStart(3, '0')}`);

const ALL_CODES = [...OP02_CODES, ...OP03_CODES, ...EB04_CODES];

interface SetMeta {
  setCode: string;
  setName: string;
  folder: string;
}

const SET_CONFIG: Record<string, SetMeta> = {
  OP02: { setCode: 'OP-02', setName: 'Paramount War', folder: 'OP02' },
  OP03: { setCode: 'OP-03', setName: 'Pillars of Strength', folder: 'OP03' },
  EB04: { setCode: 'EB-04', setName: 'Extra Booster: Egghead Crisis', folder: 'EB04' },
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

interface ScrapedCard {
  code: string;
  setCode: string;
  setName: string;
  folder: string;
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

async function scrapeCard(code: string): Promise<ScrapedCard> {
  const pageUrl = `https://oplaytcg.com/en/cards/${code}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VivrePlayCardImporter/1.0)' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const match = html.match(/\\"card\\":\s*(\{[^<]+?\})\s*,\s*\\"lang\\"/);
      if (!match) throw new Error(`Card JSON not found in ${pageUrl}`);

      const rawJson = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      const raw = JSON.parse(rawJson);

      const prefix = code.split('-')[0].toUpperCase();
      const meta = SET_CONFIG[prefix] || {
        setCode: prefix,
        setName: raw.originSetName || prefix,
        folder: prefix,
      };

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

      const rawRarity = raw.printings?.[0]?.rarity_code || raw.rarity || 'C';
      const rarity = RARITY_MAP[rawRarity] || rawRarity;

      const attribute = raw.attribute || raw.attributeCode || null;

      const traitsArray: string[] = Array.isArray(raw.traits)
        ? raw.traits.map((t: any) => (typeof t === 'string' ? t.trim() : (t.name || t.code || '').trim())).filter(Boolean)
        : (typeof raw.traits === 'string' ? raw.traits.split(/\s*\/\s*/).filter(Boolean) : []);
      const traits = traitsArray.join(' / ');

      const effect: string = (raw.effect || raw.texts?.[0]?.effect || '').trim();

      const enPrinting = raw.printings?.find(
        (p: any) => p.language_code === 'en' && (p.source_variant === 'base' || !p.source_variant)
      ) || raw.printings?.find((p: any) => p.language_code === 'en');
      const imageUrl: string = enPrinting?.imageFull || enPrinting?.image || raw.printings?.[0]?.imageFull || raw.printings?.[0]?.image || `https://cards.oplaytcg.com/${meta.folder}/en/${code}.webp`;

      return {
        code,
        setCode: meta.setCode,
        setName: meta.setName,
        folder: meta.folder,
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
    } catch (err) {
      lastError = err;
      await new Promise(r => setTimeout(r, 600 * 2 ** attempt));
    }
  }
  throw new Error(`Failed to scrape ${code}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function uploadCardImages(card: ScrapedCard, printingId: string, storageKeysSet: Set<string>) {
  const smallKey = `one-piece/${card.folder}/en/small/${card.code}.webp`;
  const canonicalKey = `one-piece/${card.folder}/en/${card.code}.webp`;

  // Check if smallKey already exists in storage
  const alreadyInStorage = storageKeysSet.has(smallKey);

  if (!alreadyInStorage) {
    let imgRes: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        imgRes = await fetch(card.imageUrl, {
          headers: { accept: 'image/webp,image/*;q=0.8' },
          signal: AbortSignal.timeout(20_000),
        });
        if (imgRes.ok) break;
      } catch {
        await new Promise(r => setTimeout(r, 600 * 2 ** attempt));
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

    // Upload small key
    const { error: smallUploadErr } = await supabase.storage.from(BUCKET).upload(smallKey, smallBuffer, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: true,
    });
    if (smallUploadErr) throw smallUploadErr;

    // Upload canonical key
    const { error: canonicalUploadErr } = await supabase.storage.from(BUCKET).upload(canonicalKey, smallBuffer, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: true,
    });
    if (canonicalUploadErr) throw canonicalUploadErr;

    storageKeysSet.add(smallKey);
  }

  // Ensure asset record in tcg_card_assets
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

  // Asset source row
  const now = new Date().toISOString();
  const { error: sourceErr } = await supabase.from('tcg_card_asset_sources').upsert(
    [
      {
        printing_id: printingId,
        source_type: 'oplaytcg',
        source_url: card.imageUrl,
        rights_status: 'official_release',
        observed_at: now,
        storage_path: smallKey.toLowerCase(),
        storage_variants: {
          small: smallKey.toLowerCase(),
        },
        stored_format: 'webp',
        approved_for_display: true,
        approved_for_storage: true,
      },
    ],
    { onConflict: 'source_url' }
  );
  if (sourceErr) throw sourceErr;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function main() {
  console.log(`Starting scrape of ${ALL_CODES.length} cards (OP-02: 121, OP-03: 123, EB-04: 61)...`);

  let scrapedCount = 0;
  const cards = await boundedMap(ALL_CODES, SCRAPE_CONCURRENCY, async (code) => {
    const card = await scrapeCard(code);
    scrapedCount++;
    if (scrapedCount % 25 === 0 || scrapedCount === ALL_CODES.length) {
      console.log(`[${scrapedCount}/${ALL_CODES.length}] Scraped ${card.code} (${card.name})`);
    }
    return card;
  });

  console.log(`\nSuccessfully scraped all ${cards.length} cards.`);

  // 1. Ensure game
  const { data: game, error: gameError } = await supabase
    .from('tcg_games')
    .upsert({ slug: 'one-piece', name: 'One Piece Card Game' }, { onConflict: 'slug' })
    .select('id')
    .single();
  if (gameError || !game) throw gameError || new Error('Game lookup failed');

  // 2. Ensure sets
  const requiredSets = [
    { external_set_id: 'OP-02', name: 'Paramount War', set_kind: 'booster' },
    { external_set_id: 'OP-03', name: 'Pillars of Strength', set_kind: 'booster' },
    { external_set_id: 'EB-04', name: 'Extra Booster: Egghead Crisis', set_kind: 'booster' },
  ];
  const { error: setError } = await supabase.from('tcg_sets').upsert(
    requiredSets.map(s => ({ game_id: game.id, ...s })),
    { onConflict: 'game_id,external_set_id' }
  );
  if (setError) throw setError;

  const { data: setRows, error: setLookupError } = await supabase
    .from('tcg_sets')
    .select('id,external_set_id')
    .eq('game_id', game.id)
    .in('external_set_id', ['OP-02', 'OP-03', 'EB-04']);
  if (setLookupError || !setRows) throw setLookupError || new Error('Sets query failed');
  const setIdByCode = new Map(setRows.map(s => [s.external_set_id, s.id]));

  // 3. Upsert identities (chunked)
  console.log('Upserting card identities...');
  const now = new Date().toISOString();
  const identityPayloads = cards.map(c => ({
    game_id: game.id,
    code: c.code,
    name: c.name, // clean name from oplaytcg without (SP)
    color: c.color,
    card_type: c.cardType,
    cost: c.cost,
    power: c.power,
    effect_text: c.effect,
    updated_at: now,
  }));

  for (const chunk of chunkArray(identityPayloads, 100)) {
    const { error: idErr } = await supabase.from('tcg_card_identities').upsert(chunk, { onConflict: 'game_id,code' });
    if (idErr) throw idErr;
  }

  // Fetch all identity IDs
  const identityIdByCode = new Map<string, string>();
  for (const chunk of chunkArray(ALL_CODES, 100)) {
    const { data: idRows, error: idLookupErr } = await supabase
      .from('tcg_card_identities')
      .select('id,code')
      .eq('game_id', game.id)
      .in('code', chunk);
    if (idLookupErr || !idRows) throw idLookupErr || new Error('Identities lookup failed');
    for (const r of idRows) identityIdByCode.set(r.code, r.id);
  }

  // 4. Upsert rules and localizations (chunked)
  console.log('Upserting rules and localizations...');
  const rulesPayloads = cards.map(c => ({
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

  const locPayloads = cards.map(c => ({
    identity_id: identityIdByCode.get(c.code)!,
    language: 'EN',
    name: c.name,
    effect_text: c.effect,
    traits_text: c.traits,
    updated_at: now,
  }));

  for (const chunk of chunkArray(rulesPayloads, 100)) {
    const { error: rErr } = await supabase.from('tcg_card_rules').upsert(chunk, { onConflict: 'identity_id' });
    if (rErr) throw rErr;
  }

  for (const chunk of chunkArray(locPayloads, 100)) {
    const { error: lErr } = await supabase.from('tcg_card_localizations').upsert(chunk, { onConflict: 'identity_id,language' });
    if (lErr) throw lErr;
  }

  // 5. Reassign any existing EB04 printings under OP14-EB04 / OP15-EB04 to EB-04
  console.log('Reassigning any legacy EB04 printings from OP14-EB04 / OP15-EB04 to EB-04...');
  const eb04SetId = setIdByCode.get('EB-04')!;
  const { error: reassignErr } = await supabase
    .from('tcg_card_printings')
    .update({
      set_code: 'EB-04',
      set_name: 'Extra Booster: Egghead Crisis',
      set_id: eb04SetId,
    })
    .like('printing_code', 'EB04%')
    .in('set_code', ['OP14-EB04', 'OP15-EB04']);
  if (reassignErr) console.warn('Warning during EB04 reassign:', reassignErr.message);

  // 6. Upsert standard printings for all 305 cards
  console.log('Upserting standard printings for all 305 cards...');
  const printingPayloads = cards.map(c => ({
    identity_id: identityIdByCode.get(c.code)!,
    language: 'EN',
    set_id: setIdByCode.get(c.setCode)!,
    set_code: c.setCode,
    set_name: c.setName,
    printing_code: c.code,
    rarity: c.rarity,
    variant: 'Standard',
    source_kind: 'oplaytcg',
    life: c.life,
    sub_types: c.traits,
    counter_amount: c.counter,
    attribute: c.attribute,
    card_image_id: c.code,
    card_image_url: c.imageUrl,
    source_payload: {
      source: 'oplaytcg',
      imported_at: now,
    },
  }));

  for (const chunk of chunkArray(printingPayloads, 100)) {
    const { error: pErr } = await supabase
      .from('tcg_card_printings')
      .upsert(chunk, { onConflict: 'identity_id,language,set_code,variant' });
    if (pErr) throw pErr;
  }

  // Fetch all printing IDs for these 305 standard printings
  const printingIdByCode = new Map<string, string>();
  for (const chunk of chunkArray(ALL_CODES, 100)) {
    const { data: pRows, error: pLookupErr } = await supabase
      .from('tcg_card_printings')
      .select('id,printing_code')
      .in('printing_code', chunk)
      .eq('language', 'EN')
      .eq('variant', 'Standard');
    if (pLookupErr || !pRows) throw pLookupErr || new Error('Printings query failed');
    for (const r of pRows) printingIdByCode.set(r.printing_code, r.id);
  }

  // 7. Check existing images in storage so we only download missing ones
  console.log('Checking existing images in Supabase storage...');
  const storageKeysSet = new Set<string>();

  for (const folder of ['OP02', 'OP03', 'EB04']) {
    for (let offset = 0; ; offset += 100) {
      const { data: fileList, error: listErr } = await supabase.storage
        .from(BUCKET)
        .list(`one-piece/${folder}/en/small`, { limit: 100, offset });
      if (listErr) {
        console.warn(`Could not list one-piece/${folder}/en/small:`, listErr.message);
        break;
      }
      for (const f of fileList ?? []) {
        storageKeysSet.add(`one-piece/${folder}/en/small/${f.name}`);
      }
      if (!fileList || fileList.length < 100) break;
    }
  }
  console.log(`Found ${storageKeysSet.size} existing small webp files across OP02, OP03, EB04.`);

  // 8. Upload missing images & upsert assets
  console.log(`Ensuring images and asset records for all ${cards.length} cards...`);
  let uploadedCount = 0;
  await boundedMap(cards, UPLOAD_CONCURRENCY, async (card) => {
    const printingId = printingIdByCode.get(card.code);
    if (!printingId) throw new Error(`Missing printing ID for ${card.code}`);
    await uploadCardImages(card, printingId, storageKeysSet);
    uploadedCount++;
    if (uploadedCount % 25 === 0 || uploadedCount === cards.length) {
      console.log(`[${uploadedCount}/${cards.length}] Handled image & assets for ${card.code}`);
    }
  });

  console.log(`\nDone! Successfully processed all ${cards.length} cards across OP-02, OP-03, and EB-04.`);
}

main().catch(err => {
  console.error('Fatal error during import:', err);
  process.exit(1);
});
