import {Market} from '@/components/tcg/market';
export default async function Page({searchParams}:{searchParams:Promise<{card?:string;cards?:string}>}){const p=await searchParams;return <Market initialCards={(p.cards||p.card||'').split(',').filter(Boolean)}/>}
