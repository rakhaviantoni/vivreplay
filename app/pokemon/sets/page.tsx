import { PokemonSets } from '@/components/tcg/pokemon-sets';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata = pageMetadata({ title: 'Pokémon TCG Sets', description: 'Browse Pokémon TCG releases, set dates, and card counts.', path: '/pokemon/sets' });
export default function Page() { return <PokemonSets />; }
