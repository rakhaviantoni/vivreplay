import {withRequestLocale} from '@/lib/with-request-locale';
import { PokemonLibrary } from '@/components/tcg/pokemon-library';
import {requestPageMetadata} from '@/lib/request-page-metadata';

export async function generateMetadata(){return requestPageMetadata({ title: 'Pokémon TCG Card Library', description: 'Browse Pokémon TCG cards and printings in Indonesian, English, and Japanese.', path: '/pokemon/cards' });}
async function Page({ searchParams }: { searchParams: Promise<{ set?: string; q?: string; illustrator?: string; rarity?: string; card?: string; printing?: string; number?: string; lang?: string }> }) {
  const { set, q, illustrator, rarity, card, printing, number, lang } = await searchParams;
  const initialSet = set?.slice(0, 40);
  const initialQuery = q?.slice(0, 100);
  const initialIllustrator = illustrator?.slice(0, 80);
  const initialRarity = rarity?.slice(0, 80);
  const initialPrinting = printing?.slice(0, 100);
  const initialCard = card?.slice(0, 40);
  const initialNumber = number?.slice(0, 20);
  const initialLanguage = lang?.toUpperCase();
  return <PokemonLibrary key={`${initialSet ?? ''}:${initialQuery ?? ''}:${initialIllustrator ?? ''}:${initialRarity ?? ''}:${initialCard ?? ''}:${initialPrinting ?? ''}:${initialNumber ?? ''}:${initialLanguage ?? ''}`} initialSet={initialSet} initialQuery={initialQuery} initialIllustrator={initialIllustrator} initialRarity={initialRarity} initialCard={initialCard} initialPrinting={initialPrinting} initialNumber={initialNumber} initialLanguage={initialLanguage} />;
}

export default withRequestLocale(Page);
