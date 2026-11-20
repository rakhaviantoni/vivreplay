import {withRequestLocale} from '@/lib/with-request-locale';
import {LiveCardDetail} from '@/components/tcg/live-card-detail';
import {requestPageMetadata} from '@/lib/request-page-metadata';
export async function generateMetadata({params}:{params:Promise<{code:string}>}){const {code}=await params;const cardCode=code.toUpperCase();return requestPageMetadata({title:`${cardCode} - One Piece Card`,description:`View ${cardCode} printing details, effect text, stats, and available printings in the VivrePlay card library.`,path:`/cards/${encodeURIComponent(cardCode)}`});}
async function Page({params,searchParams}:{params:Promise<{code:string}>;searchParams:Promise<{lang?:string}>}){const {code}=await params;const {lang}=await searchParams;return <LiveCardDetail code={code} initialLanguage={lang?.toUpperCase()==='JP'?'JP':'EN'}/>}

export default withRequestLocale(Page);
