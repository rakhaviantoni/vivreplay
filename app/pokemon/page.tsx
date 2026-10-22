import { PokemonLibrary } from '@/components/tcg/pokemon-library';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata = pageMetadata({ title: 'Pokémon TCG Card Library', description: 'Browse Pokémon TCG cards and printings in Indonesian, English, and Japanese.', path: '/pokemon' });
export default async function Page({ searchParams }: { searchParams: Promise<{ set?: string; q?: string; illustrator?: string; card?: string; printing?: string }> }) {
  const { set, q, illustrator, card, printing } = await searchParams;
  const initialSet = set?.slice(0, 40);
  const initialQuery = q?.slice(0, 100);
  const initialIllustrator = illustrator?.slice(0, 80);
  const initialPrinting = printing?.slice(0, 100);
  const initialCard = card?.slice(0, 40);
  return <PokemonLibrary key={`${initialSet ?? ''}:${initialQuery ?? ''}:${initialIllustrator ?? ''}:${initialCard ?? ''}:${initialPrinting ?? ''}`} initialSet={initialSet} initialQuery={initialQuery} initialIllustrator={initialIllustrator} initialCard={initialCard} initialPrinting={initialPrinting} />;
}
