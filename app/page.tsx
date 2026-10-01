import {HomeExperience} from '@/components/tcg/home-experience';
import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'One Piece Card Game Card Database & Deck Builder',description:'Search One Piece Card Game cards and sets, build and share decks, manage a collection, browse community listings, and practice the rules with VivrePlay.',path:'/'});
export default function Home(){return <HomeExperience/>}
