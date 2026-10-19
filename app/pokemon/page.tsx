import { PokemonLibrary } from '@/components/tcg/pokemon-library';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata = pageMetadata({ title: 'Pokémon TCG Card Library', description: 'Browse Pokémon TCG cards and printings in Indonesian, English, and Japanese.', path: '/pokemon' });
export default async function Page({ searchParams }: { searchParams: Promise<{ set?: string }> }) {
  const { set } = await searchParams;
  return <PokemonLibrary initialSet={set?.slice(0, 40)} />;
}
