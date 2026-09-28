import {Catalog} from '@/components/tcg/catalog';
import {pageMetadata} from '@/lib/site-metadata';
export const metadata=pageMetadata({title:'Card library',description:'Explore One Piece Card Game identities and English or Japanese printings in the live card archive.',path:'/cards'});
export default async function Page({searchParams}:{searchParams:Promise<{set?:string;archetype?:string}>}){const {set,archetype}=await searchParams;return <Catalog initialSet={set?.toUpperCase()} initialArchetype={archetype}/>}
