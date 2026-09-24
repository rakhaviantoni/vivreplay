import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before importing.');

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = 'tcg-card-images';

type RequestedCard = {
  code: string;
  setCode: string;
  setName: string;
  name: string;
  color: string;
  type: string;
  cost: number;
  power: number;
  life: number | null;
  counter: number;
  rarity: string;
  attribute: string | null;
  traits: string;
  effect: string;
  imageUrl: string;
};

const requested: RequestedCard[] = [
  {
    code: 'OP18-022', setCode: 'OP18', setName: 'The Dominance of God', name: 'Monkey.D.Luffy',
    color: 'Green', type: 'Leader', cost: 0, power: 5000, life: 5, counter: 0, rarity: 'L', attribute: 'Strike', traits: 'Water Seven / Straw Hat Crew',
    effect: '[DON!! x3] [When Attacking] [Once Per Turn] You may set this Leader as active. If you do, this Leader will not become active in your next Refresh Phase.',
    imageUrl: 'https://cards.oplaytcg.com/OP18/en/small/OP18-022.webp?v=1789948989',
  },
  {
    code: 'EB05-014', setCode: 'EB05', setName: 'ONE PIECE Heroines Edition vol.2', name: 'Shirahoshi',
    color: 'Green', type: 'Character', cost: 1, power: 0, life: null, counter: 0, rarity: 'SR', attribute: 'Wisdom', traits: 'Merfolk / Fish-Man Island',
    effect: '[On Play] Look at 5 cards from the top of your deck; reveal up to a total of 2 [Megalo] or {Neptunian} type cards and add them to your hand. Then, trash the rest. [Activate: Main] You may rest this Character: Up to 1 of your {Neptunian} type Characters with 6000 power or less gains [Rush] during this turn.',
    imageUrl: 'https://cards.oplaytcg.com/EB05/en/small/EB05-014.webp?v=1790128562',
  },
  {
    code: 'EB05-048', setCode: 'EB05', setName: 'ONE PIECE Heroines Edition vol.2', name: 'Hedgehog Stinger',
    color: 'Black', type: 'Event', cost: 1, power: 0, life: null, counter: 0, rarity: 'R', attribute: null, traits: 'Baroque Works',
    effect: '[Main] You may rest 1 of your DON!! cards and K.O. 1 of your Characters with a type including {Baroque Works}: All of your opponent\'s Characters with a cost of 0 cannot activate [Blocker] during this turn. [Counter] Your Leader gains +3000 power during this battle.',
    imageUrl: 'https://cards.oplaytcg.com/EB05/en/small/EB05-048.webp?v=1790126740',
  },
];

function assetPath(card: RequestedCard, kind: 'thumb' | 'small' | 'large') {
  return `one-piece/${card.setCode.toLowerCase()}/en/${kind}/${card.code.toLowerCase()}.webp`;
}

async function uploadAssets(card: RequestedCard, printingId: string) {
  const response = await fetch(card.imageUrl);
  if (!response.ok) throw new Error(`${card.code} image returned ${response.status}`);
  const source = Buffer.from(await response.arrayBuffer());
  const sizes: Array<['thumb' | 'small' | 'large', number, number]> = [['thumb', 180, 72], ['small', 420, 78], ['large', 960, 84]];
  const assets = [] as Array<{ printing_id: string; kind: string; object_key: string; width: number }>;
  for (const [kind, width, quality] of sizes) {
    const objectKey = assetPath(card, kind);
    const body = await sharp(source).rotate().resize({ width, withoutEnlargement: true }).webp({ quality, effort: 4 }).toBuffer();
    const { error } = await supabase.storage.from(bucket).upload(objectKey, body, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
    if (error) throw error;
    assets.push({ printing_id: printingId, kind, object_key: objectKey, width });
  }
  const { error } = await supabase.from('tcg_card_assets').upsert(assets, { onConflict: 'printing_id,kind' });
  if (error) throw error;
}

async function main() {
  const { data: game, error: gameError } = await supabase.from('tcg_games').upsert({ slug: 'one-piece', name: 'One Piece Card Game' }, { onConflict: 'slug' }).select('id').single();
  if (gameError) throw gameError;

  const sets = [...new Map(requested.map(card => [card.setCode, card])).values()];
  const { error: setError } = await supabase.from('tcg_sets').upsert(sets.map(set => ({ game_id: game.id, external_set_id: set.setCode, name: set.setName, set_kind: 'booster' })), { onConflict: 'game_id,external_set_id' });
  if (setError) throw setError;
  const { data: setRows, error: setLookupError } = await supabase.from('tcg_sets').select('id,external_set_id').eq('game_id', game.id).in('external_set_id', sets.map(set => set.setCode));
  if (setLookupError) throw setLookupError;
  const setIdByCode = new Map((setRows ?? []).map(set => [set.external_set_id, set.id]));

  const { error: identityError } = await supabase.from('tcg_card_identities').upsert(requested.map(card => ({ game_id: game.id, code: card.code, name: card.name, color: card.color, card_type: card.type, cost: card.cost, power: card.power, effect_text: card.effect, updated_at: new Date().toISOString() })), { onConflict: 'game_id,code' });
  if (identityError) throw identityError;
  const { data: identities, error: identityLookupError } = await supabase.from('tcg_card_identities').select('id,code').eq('game_id', game.id).in('code', requested.map(card => card.code));
  if (identityLookupError) throw identityLookupError;
  const identityIdByCode = new Map((identities ?? []).map(identity => [identity.code, identity.id]));

  const rules = requested.map(card => ({ identity_id: identityIdByCode.get(card.code), colors: [card.color], card_type: card.type, cost: card.cost, power: card.power, life: card.life, counter_amount: card.counter, attributes: card.attribute ? [card.attribute] : [], traits: card.traits.split(/\s*\/\s*/).filter(Boolean), updated_at: new Date().toISOString() }));
  const localizations = requested.map(card => ({ identity_id: identityIdByCode.get(card.code), language: 'EN', name: card.name, effect_text: card.effect, traits_text: card.traits, updated_at: new Date().toISOString() }));
  const [{ error: rulesError }, { error: localizationError }] = await Promise.all([supabase.from('tcg_card_rules').upsert(rules, { onConflict: 'identity_id' }), supabase.from('tcg_card_localizations').upsert(localizations, { onConflict: 'identity_id,language' })]);
  if (rulesError) throw rulesError;
  if (localizationError) throw localizationError;

  const printings = requested.map(card => ({ identity_id: identityIdByCode.get(card.code), language: 'EN', set_id: setIdByCode.get(card.setCode), set_code: card.setCode, set_name: card.setName, printing_code: card.code, rarity: card.rarity, variant: 'Standard', source_kind: 'oplaytcg-requested', life: card.life, sub_types: card.traits, counter_amount: card.counter, attribute: card.attribute, card_image_id: card.code, card_image_url: card.imageUrl, source_payload: { source: 'oplaytcg', user_requested: true, imported_at: new Date().toISOString() } }));
  const { error: printingError } = await supabase.from('tcg_card_printings').upsert(printings, { onConflict: 'identity_id,language,set_code,variant' });
  if (printingError) throw printingError;
  const { data: printingRows, error: printingLookupError } = await supabase.from('tcg_card_printings').select('id,printing_code').in('printing_code', requested.map(card => card.code)).eq('language', 'EN');
  if (printingLookupError) throw printingLookupError;
  const printingIdByCode = new Map((printingRows ?? []).map(printing => [printing.printing_code, printing.id]));

  const sources = requested.map(card => ({ printing_id: printingIdByCode.get(card.code), source_type: 'oplaytcg', source_url: card.imageUrl, rights_status: 'user_requested_import_pending_review', observed_at: new Date().toISOString(), storage_path: assetPath(card, 'small'), storage_variants: { thumb: assetPath(card, 'thumb'), small: assetPath(card, 'small'), large: assetPath(card, 'large') }, stored_format: 'webp', approved_for_display: false, approved_for_storage: false }));
  const { error: sourceError } = await supabase.from('tcg_card_asset_sources').upsert(sources, { onConflict: 'source_url' });
  if (sourceError) throw sourceError;
  for (const card of requested) {
    const printingId = printingIdByCode.get(card.code);
    if (!printingId) throw new Error(`No printing for ${card.code}`);
    await uploadAssets(card, printingId);
  }
  console.log(JSON.stringify({ imported: requested.map(card => card.code) }, null, 2));
}

await main();
