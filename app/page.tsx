import {HomeExperience} from '@/components/tcg/home-experience';
import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'One Piece Card Game companion',description:'Explore One Piece Card Game cards, build decks, track your collection, browse listings, and practice at the table.',path:'/'});
export default function Home(){return <HomeExperience/>}
