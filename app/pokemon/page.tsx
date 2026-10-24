import {HomeExperience} from '@/components/tcg/home-experience';
import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'Pokémon Card Library & Market',description:'Explore Pokémon cards, sets, printings, and languages. Manage your collection and browse card listings on VivrePlay.',path:'/pokemon'});

export default function PokemonHome(){return <HomeExperience game="pokemon"/>}
