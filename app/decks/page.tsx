import {withRequestLocale} from '@/lib/with-request-locale';
import {DeckLibrary} from '@/components/tcg/deck-library';
import {requestPageMetadata} from '@/lib/request-page-metadata';

export async function generateMetadata(){return requestPageMetadata({title:'Decks',description:'Build, save, and refine One Piece Card Game decks in VivrePlay.',path:'/decks'});}

function Page(){return <DeckLibrary/>;}

export default withRequestLocale(Page);
