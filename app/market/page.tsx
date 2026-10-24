import {withRequestLocale} from '@/lib/with-request-locale';
import {Market} from '@/components/tcg/market';
import {requestPageMetadata} from '@/lib/request-page-metadata';

export async function generateMetadata(){return requestPageMetadata({title:'Market',description:'Browse community One Piece Card Game listings and find the exact cards for your collection.',path:'/market'});}
async function Page({searchParams}:{searchParams:Promise<{card?:string;cards?:string}>}){const p=await searchParams;return <Market initialCards={(p.cards||p.card||'').split(',').filter(Boolean)}/>}

export default withRequestLocale(Page);
