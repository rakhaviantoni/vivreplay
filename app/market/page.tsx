import {Market} from '@/components/tcg/market';
import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'Market',description:'Browse community One Piece Card Game listings and find the exact cards for your collection.',path:'/market'});
export default async function Page({searchParams}:{searchParams:Promise<{card?:string;cards?:string}>}){const p=await searchParams;return <Market initialCards={(p.cards||p.card||'').split(',').filter(Boolean)}/>}
