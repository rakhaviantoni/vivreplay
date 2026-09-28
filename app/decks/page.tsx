import {DeckLibrary} from '@/components/tcg/deck-library';
import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'Decks',description:'Build, save, and refine One Piece Card Game decks in VivrePlay.',path:'/decks'});

export default function Page(){return <DeckLibrary/>;}
