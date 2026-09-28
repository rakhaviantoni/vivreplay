import {SetDetail} from '@/components/tcg/set-detail';
import {pageMetadata} from '@/lib/site-metadata';
export async function generateMetadata({params}:{params:Promise<{code:string}>}){const {code}=await params;const setCode=code.toUpperCase();return pageMetadata({title:`${setCode} set archive`,description:`Browse the ${setCode} One Piece Card Game card pool, printings, and release details.`,path:`/sets/${encodeURIComponent(setCode)}`});}
export default async function Page({params}:{params:Promise<{code:string}>}){const {code}=await params;return <SetDetail code={code}/>;}
