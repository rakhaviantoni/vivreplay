import {withRequestLocale} from '@/lib/with-request-locale';
import {HomeExperience} from '@/components/tcg/home-experience';
import {requestPageMetadata} from '@/lib/request-page-metadata';

export async function generateMetadata(){return requestPageMetadata({title:'One Piece Card Game Card Database & Deck Builder',description:'Search One Piece Card Game cards and sets, build and share decks, manage a collection, browse community listings, and practice the rules with VivrePlay.',path:'/'});}
function Home(){return <HomeExperience/>}

export default withRequestLocale(Home);
