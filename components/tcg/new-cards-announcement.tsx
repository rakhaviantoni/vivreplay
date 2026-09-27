'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {EyeIcon, SparkleIcon, XIcon} from '@phosphor-icons/react';
import {useEffect,useState} from 'react';
import type {Card} from '@/packages/card-data/catalog';
import {CardArt} from './card-art';

const ANNOUNCEMENT_VERSION='p163-preview-2026-09';
const STORAGE_KEY='vivreplay-new-cards-announcement';
const mihawk:Card={id:'preview-p-163',code:'P-163',printingCode:'P-163',setCode:'P',language:'EN',name:'Dracule Mihawk',color:'Green',type:'Leader',cost:0,power:5000,counter:0,rarity:'P',art:0,effect:'[Activate: Main] [Once Per Turn] You may rest 1 of your cards: If there is a Character with a cost of 5 or more, give up to 3 rested DON!! cards to this Leader.',imageUrl:'https://cards.oplaytcg.com/P/en/P-163.webp',imageSource:'external'};

export function NewCardsAnnouncement(){
 const [open,setOpen]=useState(false);const path=usePathname();
 useEffect(()=>{if(path.startsWith('/play')){setOpen(false);return}setOpen(window.localStorage.getItem(STORAGE_KEY)!==ANNOUNCEMENT_VERSION);},[path]);
 const dismiss=()=>{window.localStorage.setItem(STORAGE_KEY,ANNOUNCEMENT_VERSION);setOpen(false);};
 if(!open)return null;
 return <div className="new-cards-backdrop" role="presentation"><section className="new-cards-dialog" role="dialog" aria-modal="true" aria-labelledby="new-cards-title">
   <header><span><SparkleIcon size={17} weight="fill"/> New cards</span><button type="button" aria-label="Dismiss new cards" onClick={dismiss}><XIcon size={19}/></button></header>
   <div className="new-cards-body"><p className="eyebrow">PREVIEW · CASUAL ONLY</p><h2 id="new-cards-title">A new card is ready to try.</h2><p>Dracule Mihawk is available in Casual, New Cards, and Extended. Preview cards stay out of Ranked until their release data is finalized.</p>
   <Link href="/cards/P-163" className="new-cards-feature" onClick={dismiss} aria-label="View preview card Dracule Mihawk"><CardArt card={mihawk}/><span><small>P-163 · Green Leader</small><strong>Dracule Mihawk</strong><em>Preview card · playable outside Ranked</em></span></Link>
   <div className="new-cards-actions"><Link href="/cards?set=P" onClick={dismiss}><EyeIcon size={17}/> View previews</Link><Link className="new-cards-primary" href="/decks/builder?card=preview-p-163" onClick={dismiss}>Build a deck</Link></div>
   </div>
 </section></div>;
}
