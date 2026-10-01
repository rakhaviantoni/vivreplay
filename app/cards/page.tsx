import {Catalog} from '@/components/tcg/catalog';
import {pageMetadata} from '@/lib/site-metadata';
export const metadata=pageMetadata({title:'One Piece Card Database',description:'Search the One Piece Card Game card archive by name, number, set, color, type, language, and printing. Compare English and Japanese printings.',path:'/cards'});
export default async function Page({searchParams}:{searchParams:Promise<{set?:string;archetype?:string}>}){const {set,archetype}=await searchParams;return <Catalog initialSet={set?.toUpperCase()} initialArchetype={archetype}/>}
