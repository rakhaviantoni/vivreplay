import {withRequestLocale} from '@/lib/with-request-locale';
import {Catalog} from '@/components/tcg/catalog';
import {requestPageMetadata} from '@/lib/request-page-metadata';
export async function generateMetadata(){return requestPageMetadata({title:'One Piece Card Database',description:'Search the One Piece Card Game card archive by name, number, set, color, type, language, and printing. Compare English and Japanese printings.',path:'/cards'});}
async function Page({searchParams}:{searchParams:Promise<{set?:string;archetype?:string;card?:string;printing?:string;lang?:string}>}){const {set,archetype,card,printing,lang}=await searchParams;const initialCard=card?.slice(0,40).toUpperCase();const initialPrinting=printing?.slice(0,100);const initialLanguage=lang?.trim().slice(0,8).toUpperCase();return <Catalog key={`${set??''}:${archetype??''}:${initialCard??''}:${initialPrinting??''}:${initialLanguage??''}`} initialSet={set?.toUpperCase()} initialArchetype={archetype} initialCard={initialCard} initialPrinting={initialPrinting} initialLanguage={initialLanguage}/>}

export default withRequestLocale(Page);
