import {Catalog} from '@/components/tcg/catalog';
export const metadata={title:'Card library',description:'Explore card identities and English or Japanese printings in the live card archive.'};
export default async function Page({searchParams}:{searchParams:Promise<{set?:string}>}){const {set}=await searchParams;return <Catalog initialSet={set?.toUpperCase()}/>}
