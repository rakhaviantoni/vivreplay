import {LiveCardDetail} from '@/components/tcg/live-card-detail';
import {pageMetadata} from '@/lib/site-metadata';
import {notFound} from 'next/navigation';
import {db} from '@/lib/server/store';

async function hasCard(code:string){
  try{return Boolean(await db().prepare(`SELECT 1 AS found FROM tcg_card_identities i WHERE upper(i.code)=? AND EXISTS(SELECT 1 FROM tcg_card_printings p WHERE p.identity_id=i.id) LIMIT 1`).bind(code.toUpperCase()).first())}catch{return true}
}

export async function generateMetadata({params}:{params:Promise<{code:string}>}){const {code}=await params;const cardCode=code.toUpperCase();if(!await hasCard(cardCode))notFound();return pageMetadata({title:`${cardCode} One Piece card`,description:`View ${cardCode} printing details, effect text, stats, and available printings in the VivrePlay card library.`,path:`/cards/${encodeURIComponent(cardCode)}`});}
export default async function Page({params,searchParams}:{params:Promise<{code:string}>;searchParams:Promise<{lang?:string}>}){const {code}=await params;if(!await hasCard(code))notFound();const {lang}=await searchParams;return <LiveCardDetail code={code} initialLanguage={lang==='JP'?'JP':'EN'}/>}
