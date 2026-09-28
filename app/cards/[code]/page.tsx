import {LiveCardDetail} from '@/components/tcg/live-card-detail';
import {pageMetadata} from '@/lib/site-metadata';
export async function generateMetadata({params}:{params:Promise<{code:string}>}){const {code}=await params;const cardCode=code.toUpperCase();return pageMetadata({title:`${cardCode} One Piece card`,description:`View ${cardCode} printing details, effect text, stats, and available printings in the VivrePlay card library.`,path:`/cards/${encodeURIComponent(cardCode)}`});}
export default async function Page({params,searchParams}:{params:Promise<{code:string}>;searchParams:Promise<{lang?:string}>}){const {code}=await params;const {lang}=await searchParams;return <LiveCardDetail code={code} initialLanguage={lang==='JP'?'JP':'EN'}/>}
