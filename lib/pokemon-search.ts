import { pokemonRarityLabel } from '@/lib/pokemon-rarity';
import {tokenizeSearchTerms} from '@/lib/card-search';

const rarityTerms: Record<string, string[]> = {
  sar: ['SAR', 'SIR'], sir: ['SAR', 'SIR'], ar: ['AR', 'IR'], ir: ['AR', 'IR'],
  rr: ['RR'], rrr: ['RRR'], sr: ['SR'], ur: ['UR'], hr: ['HR'], ssr: ['SSR'], ace: ['ACE'], promo: ['PROMO'],
  prism: ['PRISM STAR'], 'special art rare': ['SAR', 'SIR'], 'special illustration rare': ['SAR', 'SIR'],
  'illustration rare': ['AR', 'IR'], 'ultra rare': ['UR'], 'hyper rare': ['HR'], 'double rare': ['RR'],
  'triple rare': ['RRR'], 'ace spec rare': ['ACE'],
};
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function parsePokemonSearchQuery(value: string) {
  const words = tokenizeSearchTerms(value);
  const removed = new Set<number>();
  const rarityLabels = new Set<string>();
  for (const [phrase, labels] of Object.entries(rarityTerms).sort(([a], [b]) => b.length - a.length)) {
    const parts = phrase.split(' ');
    for (let start = 0; start <= words.length - parts.length; start += 1) {
      if (parts.every((part, offset) => !removed.has(start + offset) && normalize(words[start + offset]) === part)) {
        parts.forEach((_part, offset) => removed.add(start + offset));
        labels.forEach(label => rarityLabels.add(label));
      }
    }
  }
  return { query: words.filter((_word, index) => !removed.has(index)).join(' '), rarityLabels: [...rarityLabels] };
}

export function resolvePokemonSearchRarities(labels: string[], options: string[], language: string) {
  const accepted = new Set(labels.map(label => normalize(label).replace(/\s/g, '').toUpperCase()));
  if (!accepted.size) return [];
  const rawOptions = options.length ? options : [
    'SAR', 'Special Art Rare', 'Special Illustration Rare', 'Two Star', 'Double Star', 'SIR',
    'AR', 'Art Rare', 'Illustration Rare', 'One Star', 'IR', 'RR', 'Double Rare', 'RRR',
    'Triple Rare', 'SR', 'Secret Rare', 'UR', 'Ultra Rare', 'HR', 'Hyper Rare', 'SSR',
    'Shiny Ultra Rare', 'ACE', 'Ace Spec Rare', 'Promo', 'Promotional', 'Prism Star',
  ];
  return [...new Set(rawOptions.filter(value => accepted.has(normalize(pokemonRarityLabel(value, language)).replace(/\s/g, '').toUpperCase())))];
}
