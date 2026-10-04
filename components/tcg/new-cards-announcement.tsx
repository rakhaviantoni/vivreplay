'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ArrowUpRightIcon, EyeIcon, SparkleIcon, XIcon} from '@phosphor-icons/react';
import {useEffect,useState} from 'react';
import type {Card} from '@/packages/card-data/catalog';
import {CardArt} from './card-art';

const ANNOUNCEMENT_VERSION='p163-op18-eb05-2026-09';
const STORAGE_KEY='vivreplay-new-cards-announcement';
const mihawk:Card={id:'preview-p-163',code:'P-163',printingCode:'P-163',setCode:'P',language:'EN',name:'Dracule Mihawk',color:'Green',type:'Leader',cost:0,power:5000,counter:0,rarity:'P',art:0,effect:'[Activate: Main] [Once Per Turn] You may rest 1 of your cards: If there is a Character with a cost of 5 or more, give up to 3 rested DON!! cards to this Leader.',imageUrl:'https://cards.oplaytcg.com/P/en/P-163.webp',imageSource:'external'};
type ReleaseCard=Card&{setCode:string;setName:string};

function releaseCard(row:Record<string,unknown>):ReleaseCard|undefined{
 const identity=row.tcg_card_identities as Record<string,unknown>|undefined;
 if(!identity)return undefined;
 const code=String(identity.code??'').toUpperCase();
 if(!code.startsWith('OP18-')&&!code.startsWith('EB05-'))return undefined;
 const assets=(row.tcg_card_assets??[]) as Array<{kind?:string;object_key?:string}>;
 return {id:String(row.id??code),code,printingCode:String(row.printing_code??code),setCode:String(row.set_code??''),setName:String(row.set_name??row.set_code??''),language:String(row.language??'EN'),name:String(identity.name??code),color:String(identity.color??''),type:String(identity.card_type??'Character') as Card['type'],cost:Number(identity.cost??0),power:Number(identity.power??0),counter:Number(row.counter_amount??0),rarity:String(row.rarity??''),art:0,effect:String(identity.effect_text??''),imageUrl:String(row.card_image_url??'')||undefined,imageSource:'external',assetPath:assets.find(asset=>asset.kind==='small')?.object_key};
}

export function NewCardsAnnouncement(){
 const [open,setOpen]=useState(false);const path=usePathname();
 const [releaseCards,setReleaseCards]=useState<ReleaseCard[]>([]);const [cardsLoading,setCardsLoading]=useState(true);
 const [language,setLanguage]=useState<'EN'|'ID'>('EN');
 useEffect(()=>{
   const sync=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
   const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail);
   sync();
   window.addEventListener('vivreplay:locale',onLocale);
   return()=>window.removeEventListener('vivreplay:locale',onLocale);
 },[]);
 const id=language==='ID';
 useEffect(()=>{let active=true;const timer=window.setTimeout(()=>{if(active)setOpen(!path.startsWith('/play')&&window.localStorage.getItem(STORAGE_KEY)!==ANNOUNCEMENT_VERSION)},0);return()=>{active=false;window.clearTimeout(timer)}},[path]);
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();
  fetch('/api/cards/catalog?language=EN',{signal:controller.signal}).then(response=>response.ok?response.json():Promise.reject(new Error('Catalog unavailable'))).then(payload=>{
   const rows=(payload as {cards?:Record<string,unknown>[]}).cards??[];
   const unique=new Map<string,ReleaseCard>();
   for(const row of rows){const card=releaseCard(row);if(card&&!unique.has(card.code))unique.set(card.code,card)}
   setReleaseCards([...unique.values()].sort((a,b)=>a.setCode.localeCompare(b.setCode)||a.code.localeCompare(b.code)));
  }).catch(()=>{if(!controller.signal.aborted)setReleaseCards([])}).finally(()=>{if(!controller.signal.aborted)setCardsLoading(false)});
  return()=>controller.abort();
 },[open]);
 const dismiss=()=>{window.localStorage.setItem(STORAGE_KEY,ANNOUNCEMENT_VERSION);setOpen(false);};
 if(!open)return null;
 return <div className="new-cards-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)dismiss()}}><section className="new-cards-dialog" role="dialog" aria-modal="true" aria-labelledby="new-cards-title" onMouseDown={event=>event.stopPropagation()}>
   <header><span><SparkleIcon size={17} weight="fill"/> {id?'Kartu baru':'New cards'}</span><button type="button" aria-label={id?'Tutup kartu baru':'Dismiss new cards'} onClick={dismiss}><XIcon size={19}/></button></header>
   <div className="new-cards-body"><p className="eyebrow">{id?'KARTU BARU · TERSEDIA UNTUK DICOBA':'NEW CARDS · READY TO PLAY'}</p><h2 id="new-cards-title">{id?'Kartu terbaru telah tersedia.':'The latest cards are ready to play.'}</h2><p>{id?'Coba promo Dracule Mihawk, lalu jelajahi kartu OP18 dan EB05 yang sudah tersedia di katalog.':'Try the Dracule Mihawk promo, then browse the OP18 and EB05 cards currently available in the catalog.'}</p>
   <Link href="/cards/P-163" className="new-cards-feature" onClick={dismiss} aria-label={id?'Lihat kartu pratinjau Dracule Mihawk':'View preview card Dracule Mihawk'}><CardArt card={mihawk}/><span><small>{id?'P-163 · Leader Hijau':'P-163 · Green Leader'}</small><strong>Dracule Mihawk</strong><em>{id?'Kartu pratinjau · dapat dimainkan di mode kasual':'Preview card · playable in casual modes'}</em></span></Link>
   {(['OP18','EB05'] as const).map((setCode)=>{const cards=releaseCards.filter(card=>card.code.startsWith(`${setCode}-`));return <section className="new-cards-release" key={setCode} aria-label={`${setCode} cards`}><header><h3>{setCode}</h3><Link href={`/sets/${setCode}`} onClick={dismiss}>{id?'Lihat set':'View set'} <ArrowUpRightIcon aria-hidden="true" size={14}/></Link></header>{cards.length?<div className="new-cards-grid">{cards.map(card=><Link href={`/cards/${encodeURIComponent(card.code)}`} className="new-cards-card" key={card.code} onClick={dismiss} title={`${card.name} · ${card.code}`}><CardArt card={card}/><strong>{card.name}</strong><small>{card.code}</small></Link>)}</div>:<p className="new-cards-set-empty">{cardsLoading?(id?'Memuat kartu…':'Loading cards…'):(id?'Lihat arsip set untuk kartu yang tersedia.':'Open the set archive to browse available cards.')}</p>}</section>})}
   <div className="new-cards-actions"><Link href="/sets/OP18" onClick={dismiss}><EyeIcon size={17}/> OP18</Link><Link href="/sets/EB05" onClick={dismiss}><EyeIcon size={17}/> EB05</Link><Link className="new-cards-primary" href="/decks/builder?card=preview-p-163" onClick={dismiss}>{id?'Susun deck':'Build a deck'}</Link></div>
   </div>
 </section></div>;
}
