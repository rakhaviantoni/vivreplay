'use client';

import Link from 'next/link';
import {ArrowLeftIcon as ArrowLeft, ArrowRightIcon as ArrowRight, CardsIcon as Cards, CheckCircleIcon as CheckCircle, GameControllerIcon as GameController, GraduationCapIcon as GraduationCap, PlayCircleIcon as PlayCircle, SwordIcon as Sword, TrophyIcon as Trophy, UsersThreeIcon as UsersThree} from '@phosphor-icons/react';
import {useEffect,useMemo,useState} from 'react';
import {createClient} from '@/utils/supabase/client';
import {CardArt} from './card-art';
import {DepthCarousel} from './depth-carousel';
import {displayCardName} from './card-name';
import {readLocalDecks,type LocalDeck} from './local-decks';
import type {Card} from '@/packages/card-data/catalog';

type Format='ranked'|'friendly'|'practice';
type PrintingRow={id:string;rarity:string|null;set_code:string|null;card_image_url:string|null;tcg_card_assets?:Array<{kind:string;object_key:string}>;tcg_card_identities:{code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string}};
const formats:Array<{id:Format;title:string;copy:string;icon:typeof Trophy;available:boolean}>=[{id:'ranked',title:'Ranked',copy:'Constructed ladder. Requires a signed-in account when matchmaking opens.',icon:Trophy,available:false},{id:'friendly',title:'Friendly',copy:'Invite a player or test a finished list without the ladder.',icon:UsersThree,available:false},{id:'practice',title:'Practice table',copy:'Open your deck at the interactive table and rehearse lines.',icon:GameController,available:true}];
const total=(deck:LocalDeck)=>Object.values(deck.entries).reduce((sum,count)=>sum+count,0);const ready=(deck:LocalDeck)=>Boolean(deck.leaderPrintingId)&&total(deck)===50;
function cardFrom(row:PrintingRow):Card{const identity=row.tcg_card_identities;return{id:row.id,code:identity.code,name:displayCardName(identity.name,identity.code),color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:row.rarity??'',art:0,effect:identity.effect_text,imageUrl:row.card_image_url??undefined,imageSource:'external',setCode:row.set_code??undefined,assetPath:row.tcg_card_assets?.find(item=>item.kind==='small')?.object_key};}

export function ArenaLobby(){
 const [decks,setDecks]=useState<LocalDeck[]>([]);const [selectedId,setSelectedId]=useState('');const [format,setFormat]=useState<Format>('practice');const [cards,setCards]=useState<Record<string,Card>>({});const [heroFallback,setHeroFallback]=useState<Card[]>([]);
 useEffect(()=>{let active=true;void createClient().from('tcg_card_printings').select('id,rarity,set_code,card_image_url,tcg_card_assets(kind,object_key),tcg_card_identities!inner(code,name,color,card_type,cost,power,effect_text)').eq('language','EN').not('card_image_url','is',null).limit(3).then(({data})=>{if(active)setHeroFallback(((data??[]) as unknown as PrintingRow[]).map(cardFrom))});return()=>{active=false}},[]);
 useEffect(()=>{const refresh=()=>{const next=readLocalDecks().sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));setDecks(next);setSelectedId(current=>current&&next.some(deck=>deck.id===current)?current:next.find(ready)?.id??'');};refresh();window.addEventListener('vivreplay:decks-changed',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('vivreplay:decks-changed',refresh);window.removeEventListener('storage',refresh)}},[]);
 const playable=useMemo(()=>decks.filter(ready),[decks]);const selected=playable.find(deck=>deck.id===selectedId)??playable[0];const activeFormat=formats.find(item=>item.id===format)??formats[2];
 useEffect(()=>{const ids=[...new Set(playable.flatMap(deck=>[deck.leaderPrintingId,...Object.keys(deck.entries)].filter((id):id is string=>Boolean(id))))];if(!ids.length){setCards({});return}let active=true;void createClient().from('tcg_card_printings').select('id,rarity,set_code,card_image_url,tcg_card_assets(kind,object_key),tcg_card_identities!inner(code,name,color,card_type,cost,power,effect_text)').in('id',ids).then(({data})=>{if(active)setCards(Object.fromEntries(((data??[]) as unknown as PrintingRow[]).map(row=>[row.id,cardFrom(row)])))});return()=>{active=false}},[playable]);
 const selectedCards=selected?[selected.leaderPrintingId,...Object.keys(selected.entries)].map(id=>id?cards[selected.artworkIds[id]??id]??cards[id]:undefined).filter((card):card is Card=>Boolean(card)).slice(0,5):[];
 const deckHeroCards=playable.map(deck=>deck.leaderPrintingId?cards[deck.artworkIds[deck.leaderPrintingId]??deck.leaderPrintingId]??cards[deck.leaderPrintingId]:undefined).filter((card):card is Card=>Boolean(card)).slice(0,3);const heroCards=deckHeroCards.length?deckHeroCards:heroFallback;
 return <main className="page arena-lobby"><section className="library-intro arena-intro"><div className="library-intro-copy"><p className="kicker">ARENA</p><h1>Bring a finished deck to the table.</h1><p>Choose a legal list, select the way you want to play, then open the table with the same deck you built.</p></div><div className="library-intro-rail arena-intro-rail" aria-hidden="true"><div className="library-intro-rail-cards">{heroCards.map((card,index)=><div className={`library-intro-rail-card rail-card-${index}`} key={card.id}><CardArt card={card}/></div>)}{!heroCards.length&&Array.from({length:3},(_,index)=><i className={`library-intro-rail-skeleton rail-card-${index}`} key={index}/>)}</div></div></section>
 <section className="arena-deck-section"><header className="section-heading"><div><p className="eyebrow">YOUR PLAYABLE DECKS</p><h2>{playable.length?'Pick your main deck.':'No complete deck yet.'}</h2><p>{playable.length?'A deck needs one leader and exactly 50 cards before it can enter the Arena.':'Finish and save a deck in the builder, then come back here to play it.'}</p></div>{selected&&<Link className="text-action" href={`/decks/builder?local=${encodeURIComponent(selected.id)}`}>Edit selected deck <ArrowRight size={15}/></Link>}</header>{playable.length?<DepthCarousel className="arena-deck-carousel" label="Choose a deck for the Arena" items={playable.map(deck=>{const leader=deck.leaderPrintingId?cards[deck.artworkIds[deck.leaderPrintingId]??deck.leaderPrintingId]??cards[deck.leaderPrintingId]:undefined;return{id:deck.id,label:`Use ${deck.title} in the Arena`,onSelect:()=>setSelectedId(deck.id),content:leader?<CardArt card={leader}/>:<div className="arena-deck-card-fallback"><Cards size={22}/><b>{deck.leaderCode||'Leader'}</b></div>}})}/>:<section className="arena-empty-deck"><Cards size={25}/><div><h3>Build your first playable deck.</h3><p>Choose a leader, add 50 cards, and save the list on this device.</p></div><Link href="/decks/builder">Open deck builder <ArrowRight size={15}/></Link></section>}</section>
 <section className="arena-match-section"><header className="section-heading"><div><p className="eyebrow">MATCH SETUP</p><h2>{selected?selected.title:'Choose a deck first.'}</h2><p>{selected?`${selected.leaderCode||'Leader'} · ${total(selected)}/50 cards · ready for the table.`:'Match formats unlock once a complete saved deck is selected.'}</p></div></header><div className="arena-match-layout"><div className="arena-selected-deck">{selectedCards.length?<DepthCarousel className="arena-selected-carousel" label={`${selected?.title} card preview`} items={selectedCards.map(card=>({id:card.id,label:`View ${card.name}`,onSelect:()=>{},content:<CardArt card={card}/> }))}/>:<Cards size={25}/>}<div><p>SELECTED DECK</p><b>{selected?.title||'No deck selected'}</b><span>{selected?.leaderCode||'Leader needed'} · {selected?`${total(selected)}/50 cards`:'Complete a deck to continue'}</span>{selected&&<CheckCircle size={17}/>}</div></div><div className="arena-format-options">{formats.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} className={format===item.id?'selected':''} onClick={()=>setFormat(item.id)}><Icon size={20}/><span><b>{item.title}</b><small>{item.copy}</small></span><em>{item.available?'Available':'Preparing'}</em></button>})}</div><div className="arena-launch">{selected&&activeFormat.available?<Link className="button" href={`/play/board?deck=${encodeURIComponent(selected.id)}&format=${format}`}><PlayCircle size={18}/>Open practice table</Link>:<button className="button" type="button" disabled>{selected?'Format preparing':'Choose a complete deck'}</button>}</div></div></section>
 <section className="arena-guidance"><header className="section-heading"><div><p className="eyebrow">GET READY</p><h2>Everything needed before a first match.</h2></div></header><div><article><GraduationCap size={21}/><h3>Learn the table</h3><p>Walk through zones, turns, attacks, counters, and triggers at your own pace.</p><Link href="/play/tutorial">Open tutorial <ArrowRight size={14}/></Link></article><article><Cards size={21}/><h3>Tune the list</h3><p>Use the builder’s curve, counter, colour, and subtype checks before calling a deck finished.</p><Link href="/decks/builder">Open builder <ArrowRight size={14}/></Link></article><article><Sword size={21}/><h3>Practice a line</h3><p>Use the interactive table to rehearse sequencing and decisions with your saved deck.</p>{selected?<Link href={`/play/board?deck=${encodeURIComponent(selected.id)}&format=practice`}>Open table <ArrowRight size={14}/></Link>:<span>Choose a deck above</span>}</article></div></section>
 </main>;
}

const tutorialLessons = [
  {
    step: 0,
    number: '01',
    title: 'Welcome to the table',
    zone: 'Playmat overview',
    copy: 'Orient yourself on the maritime playmat, your player seat, and primary win conditions.',
  },
  {
    step: 1,
    number: '02',
    title: 'The Deck',
    zone: 'Deck zone',
    copy: '50-card regulation size, drawing each turn, and the 4-copy rule.',
  },
  {
    step: 2,
    number: '03',
    title: 'DON!! System',
    zone: 'Cost area',
    copy: '10-card DON!! deck, active vs rested states, and attaching power to units.',
  },
  {
    step: 3,
    number: '04',
    title: 'The Leader',
    zone: 'Leader zone',
    copy: 'Leader colour identity, base battle power, and Life counters.',
  },
  {
    step: 4,
    number: '05',
    title: 'Characters',
    zone: 'Character area',
    copy: 'Summoning Characters with DON!!, 5-card board limit, and attack sequencing.',
  },
  {
    step: 5,
    number: '06',
    title: 'The Stage',
    zone: 'Stage zone',
    copy: 'Persistent field cards providing continuous advantages for your crew.',
  },
  {
    step: 6,
    number: '07',
    title: 'Life & Triggers',
    zone: 'Life stack',
    copy: 'Taking damage into hand, preserving Life cards, and checking Trigger opportunities.',
  },
  {
    step: 7,
    number: '08',
    title: 'The Trash',
    zone: 'Trash zone',
    copy: 'Graveyard mechanics, reviewing discarded cards, and on-K.O. interactions.',
  },
  {
    step: 8,
    number: '09',
    title: 'Your Hand',
    zone: 'Hand tray',
    copy: 'Hidden information, mulligan decisions, and sorting by type, cost, or counter power.',
  },
  {
    step: 9,
    number: '10',
    title: 'The Whole Table',
    zone: 'Full board',
    copy: 'Synthesize turn flow: Refresh Phase, Draw Phase, DON!! Phase, and Main Phase.',
  },
];

export function ArenaTutorialIndex() {
  return (
    <main className="page directory-page tutorial-index-page">
      <header className="directory-hero page-intro-surface">
        <p className="eyebrow">TUTORIAL</p>
        <h1>Learn the table, then play it.</h1>
        <p>
          Master the official One Piece Card Game rules directly at the interactive table.
          Every lesson highlights the specific board zone with live simulator mechanics.
        </p>
        <div className="tutorial-intro-cta">
          <Link className="tutorial-index-start" href="/play/tutorial?step=0">
            <PlayCircle size={18} weight="bold" />
            <span>Start interactive tutorial</span>
          </Link>
          <Link className="tutorial-index-secondary" href="/play">
            <ArrowLeft size={16} />
            <span>Arena lobby</span>
          </Link>
        </div>
      </header>

      <section className="tutorial-chapters-section">
        <header className="section-heading">
          <div>
            <p className="eyebrow">INTERACTIVE LESSONS</p>
            <h2>Learn one part of the table at a time.</h2>
            <p>Each lesson opens the live board at the exact step it teaches.</p>
          </div>
          <span className="tutorial-path-status">10 lessons · Interactive table</span>
        </header>
        <div className="tutorial-chapter-grid">
          {tutorialLessons.map((item) => (
            <Link
              href={`/play/tutorial?step=${item.step}`}
              key={item.title}
              className="tutorial-chapter"
            >
              <b>{item.number}</b>
              <div className="tutorial-chapter-info">
                <span>{item.title}</span>
                <small>{item.zone}</small>
              </div>
              <em>
                <span>Play</span>
                <PlayCircle size={16} weight="bold" />
              </em>
            </Link>
          ))}
        </div>
      </section>

      <div className="tutorial-back">
        <Link href="/play" className="text-action">
          <ArrowLeft size={14} />
          <span>Return to Arena</span>
        </Link>
      </div>
    </main>
  );
}
