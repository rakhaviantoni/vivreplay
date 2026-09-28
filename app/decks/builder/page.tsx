import {LiveDeckBuilder} from '@/components/tcg/live-deck-builder';
import {privateMetadata} from '@/lib/site-metadata';
export const metadata=privateMetadata('Deck builder','Your deck workspace is not indexed.');

export default async function Page({searchParams}:{searchParams:Promise<{card?:string;local?:string}>}){
  const query=await searchParams;
  return <LiveDeckBuilder initialCardId={query.card} localDeckId={query.local}/>;
}
