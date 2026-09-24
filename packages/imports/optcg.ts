import { z } from 'zod';

const API_ORIGIN = 'https://www.optcgapi.com/api';
const TIMEOUT_MS = 25_000;

const apiCard = z.object({
  card_set_id: z.string().optional(),
  card_image_id: z.string().optional(),
  life: z.coerce.number().nullable().optional(),
  sub_types: z.string().nullable().optional(),
  counter_amount: z.coerce.number().nullable().optional(),
  attribute: z.string().nullable().optional(),
  inventory_price: z.coerce.number().nullable().optional(),
  market_price: z.coerce.number().nullable().optional(),
  card_name: z.string().min(1),
  set_id: z.string().optional(),
  set_name: z.string().optional(),
  card_color: z.string().nullable().optional(),
  card_type: z.string().nullable().optional(),
  card_cost: z.string().nullable().optional(),
  card_power: z.string().nullable().optional(),
  card_text: z.string().nullable().optional(),
  rarity: z.string().nullable().optional(),
  card_image: z.string().url().nullable().optional(),
  date_scraped: z.string().nullable().optional(),
}).passthrough();

const apiSet = z.object({ set_id: z.string(), set_name: z.string() }).passthrough();

export type ImportKind = 'set' | 'starter' | 'promo' | 'don';
export type SourceCard = z.infer<typeof apiCard>;

export type NormalizedOPTCGCard = {
  code: string;
  name: string;
  setCode: string;
  setName: string;
  color: string;
  type: string;
  cost: number;
  power: number;
  effect: string;
  rarity: string;
  life: number | null;
  subTypes: string | null;
  counterAmount: number;
  attribute: string | null;
  imageId: string | null;
  imageUrl: string | null;
  inventoryPrice: number | null;
  marketPrice: number | null;
  source: 'optcgapi';
  sourceKind: ImportKind;
  sourceObservedAt: string | null;
  sourcePayload: Record<string, unknown>;
};

export type NormalizedOPTCGSet = { externalSetId: string; name: string; kind: ImportKind | 'booster' };

type BulkEndpoint = { kind: ImportKind; path: string };
const bulkEndpoints: BulkEndpoint[] = [
  { kind: 'set', path: '/allSetCards/' },
  { kind: 'starter', path: '/allSTCards/' },
  { kind: 'promo', path: '/allPromos/' },
  { kind: 'don', path: '/allDonCards/' },
];

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const relayAbort = () => controller.abort();
  signal?.addEventListener('abort', relayAbort, { once: true });
  try {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!response.ok) throw new Error(`OPTCG API ${path} returned ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', relayAbort);
  }
}

function numeric(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCard(row: unknown, sourceKind: ImportKind): NormalizedOPTCGCard | null {
  const parsed = apiCard.safeParse(row);
  if (!parsed.success) return null;
  const card = parsed.data;
  const code = card.card_set_id ?? card.card_image_id;
  if (!code) return null;
  return {
    code: code.toUpperCase(),
    name: card.card_name.trim(),
    setCode: card.set_id?.trim() || sourceKind.toUpperCase(),
    setName: card.set_name?.trim() || (sourceKind === 'don' ? 'DON!! collection' : sourceKind),
    color: card.card_color?.trim() || 'Colorless',
    type: card.card_type?.trim() || 'DON!!',
    cost: numeric(card.card_cost),
    power: numeric(card.card_power),
    effect: card.card_text?.trim() || '',
    rarity: card.rarity?.trim() || 'Unknown',
    life: card.life ?? null,
    subTypes: card.sub_types?.trim() || null,
    counterAmount: card.counter_amount ?? 0,
    attribute: card.attribute?.trim() || null,
    imageId: card.card_image_id ?? null,
    imageUrl: card.card_image ?? null,
    inventoryPrice: card.inventory_price ?? null,
    marketPrice: card.market_price ?? null,
    source: 'optcgapi',
    sourceKind,
    sourceObservedAt: card.date_scraped ?? null,
    sourcePayload: row as Record<string, unknown>,
  };
}

export async function fetchAllOPTCGCards(signal?: AbortSignal) {
  const [setPayload, responses] = await Promise.all([fetchJson<unknown[]>('/allSets/', signal), Promise.all(bulkEndpoints.map(async endpoint => {
    const payload = await fetchJson<unknown[]>(endpoint.path, signal);
    return { kind: endpoint.kind, rows: payload };
  }))]);
  const cards = responses.flatMap(({ kind, rows }) => rows.map(row => normalizeCard(row, kind)).filter((row): row is NormalizedOPTCGCard => Boolean(row)));
  const deduped = new Map<string, NormalizedOPTCGCard>();
  for (const card of cards) if (!deduped.has(card.code)) deduped.set(card.code, card);
  const setMap = new Map<string, NormalizedOPTCGSet>();
  for (const row of setPayload) {
    const parsed = apiSet.safeParse(row);
    if (parsed.success) setMap.set(parsed.data.set_id, { externalSetId: parsed.data.set_id, name: parsed.data.set_name, kind: 'booster' });
  }
  for (const card of cards) if (!setMap.has(card.setCode)) setMap.set(card.setCode, { externalSetId: card.setCode, name: card.setName, kind: card.sourceKind });
  return {
    cards: [...deduped.values()],
    sets: [...setMap.values()],
    counts: Object.fromEntries(responses.map(({ kind, rows }) => [kind, rows.length])) as Record<ImportKind, number>,
    fetchedAt: new Date().toISOString(),
  };
}

export const optcgSource = {
  id: 'optcgapi',
  sourceUrl: API_ORIGIN,
  rightsStatus: 'requires_review_before_asset_display_or_storage',
  fetchSets: (signal?: AbortSignal) => fetchJson<unknown[]>('/allSets/', signal),
  fetchCards: fetchAllOPTCGCards,
  fetchSet: (setId: string, signal?: AbortSignal) => fetchJson<unknown[]>(`/sets/${encodeURIComponent(setId)}/`, signal),
  fetchCard: (cardCode: string, signal?: AbortSignal) => fetchJson<unknown[]>(`/sets/card/${encodeURIComponent(cardCode)}/`, signal),
};
