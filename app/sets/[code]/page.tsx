import {SetDetail} from '@/components/tcg/set-detail';
import {pageMetadata} from '@/lib/site-metadata';
import {notFound,redirect} from 'next/navigation';
import {db} from '@/lib/server/store';
import {isPlayableSet} from '@/packages/domain/release-availability';
export async function generateMetadata({params}:{params:Promise<{code:string}>}){const {code}=await params;const setCode=code.trim().toUpperCase().replace(/[-_]/g,'');return pageMetadata({title:`${setCode} set archive`,description:`Browse the ${setCode} One Piece Card Game card pool, printings, and release details.`,path:`/sets/${encodeURIComponent(setCode)}`});}
export default async function Page({params}:{params:Promise<{code:string}>}){const {code}=await params;const normalized=code.trim().toUpperCase().replace(/[-_]/g,'');if(!isPlayableSet(normalized))notFound();if(normalized!==code.trim())redirect(`/sets/${encodeURIComponent(normalized)}`);const set=await db().prepare(`SELECT 1 AS found FROM tcg_sets s WHERE replace(replace(upper(s.external_set_id),'-',''),'_','')=? AND EXISTS(SELECT 1 FROM tcg_card_printings p WHERE replace(replace(upper(p.set_code),'-',''),'_','')=?) LIMIT 1`).bind(normalized,normalized).first<{found:number}>().catch(()=>null);if(!set)notFound();return <SetDetail code={normalized}/>;}
