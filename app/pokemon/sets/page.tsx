import {withRequestLocale} from '@/lib/with-request-locale';
import { PokemonSets } from '@/components/tcg/pokemon-sets';
import {requestPageMetadata} from '@/lib/request-page-metadata';

export async function generateMetadata(){return requestPageMetadata({ title: 'Pokémon TCG Sets', description: 'Browse Pokémon TCG releases, set dates, and card counts.', path: '/pokemon/sets' });}
function Page() { return <PokemonSets />; }

export default withRequestLocale(Page);
