export type SharedDeck = {
  leaderCode?: string;
  title?: string;
  entries: Array<{code: string; quantity: number}>;
};

const MAX_COPIES = 4;
const MAX_CARDS = 50;

function safeCode(value: string) {
  return /^[A-Z0-9]+-[A-Z0-9]+$/i.test(value) ? value.toUpperCase() : undefined;
}

export function parseSharedDeck(search: URLSearchParams): SharedDeck | undefined {
  if (search.get('game') && search.get('game') !== 'onepiece') return undefined;
  const source = search.get('deck');
  const leaderCode = safeCode(search.get('leader') ?? '');
  const title = search.get('name')?.trim().slice(0, 80);
  if (!source && !leaderCode) return undefined;

  let total = 0;
  const quantities = new Map<string, number>();
  for (const entry of (source ?? '').split('|')) {
    const match = entry.trim().match(/^(\d{1,2})x([A-Z0-9]+-[A-Z0-9]+)$/i);
    if (!match) continue;
    const code = safeCode(match[2]);
    if (!code || total >= MAX_CARDS) continue;
    const quantity = Math.min(MAX_COPIES, Number(match[1]), MAX_CARDS - total);
    const next = Math.min(MAX_COPIES, (quantities.get(code) ?? 0) + quantity);
    total += next - (quantities.get(code) ?? 0);
    quantities.set(code, next);
  }

  return {leaderCode, title: title || undefined, entries: [...quantities].map(([code, quantity]) => ({code, quantity}))};
}

export function sharedDeckSearch(deck: SharedDeck): string {
  const search = new URLSearchParams({view: 'deck', game: 'onepiece'});
  const leader = deck.leaderCode && safeCode(deck.leaderCode);
  if (leader) search.set('leader', leader);
  if (deck.title?.trim()) search.set('name', deck.title.trim().slice(0, 80));
  const entries = deck.entries
    .map(({code, quantity}) => ({code: safeCode(code), quantity: Math.min(MAX_COPIES, Math.max(1, Math.trunc(quantity)))}))
    .filter((entry): entry is {code: string; quantity: number} => Boolean(entry.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  if (entries.length) search.set('deck', entries.map(({code, quantity}) => `${quantity}x${code}`).join('|'));
  return search.toString();
}
