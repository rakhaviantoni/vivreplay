import {withRequestLocale} from '@/lib/with-request-locale';
import {Market} from '@/components/tcg/market';
import {requestPageMetadata} from '@/lib/request-page-metadata';

export async function generateMetadata(){
  return requestPageMetadata({
    title: 'Market',
    description: 'Buy and sell One Piece Card Game, Pokémon TCG, graded slabs, sealed booster boxes, and collector goods with verified community escrow on VivrePlay Market.',
    path: '/market',
    image: '/brand/vivreplay-market-og.png',
  });
}
async function Page({searchParams}:{searchParams:Promise<{card?:string;cards?:string}>}){const p=await searchParams;return <Market initialCards={(p.cards||p.card||'').split(',').filter(Boolean)}/>}

export default withRequestLocale(Page);
