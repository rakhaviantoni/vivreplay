import {LiveDeckBuilder} from '@/components/tcg/live-deck-builder';

export default async function Page({searchParams}:{searchParams:Promise<{card?:string;local?:string}>}){
  const query=await searchParams;
  return <LiveDeckBuilder initialCardId={query.card} localDeckId={query.local}/>;
}
