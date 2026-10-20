'use client';

import Link from 'next/link';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {ChartLineUpIcon as ChartNoAxesCombined, CaretDownIcon as ChevronDown, CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, CaretUpIcon as ChevronUp, CookieIcon as Cookie, GameControllerIcon as Gamepad2, HouseIcon as Home, StackIcon as Layers3, BooksIcon as Library, MoonIcon as Moon, MagnifyingGlassIcon as Search, ShieldCheckIcon as ShieldCheck, StorefrontIcon as Store, SunIcon as Sun, TrophyIcon as Trophy, UserIcon as UserRound, XIcon as X} from '@phosphor-icons/react';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Toaster} from '@/components/ui/sonner';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {useAccount} from '@/lib/client';
import {CardArt} from './card-art';
import {displayCardName} from './card-name';
import type {Card} from '@/packages/card-data/catalog';
import {VivreMark} from './brand-assets';
import {AuthDialog} from './auth-dialog';
import {NewCardsAnnouncement} from './new-cards-announcement';
import {FeedbackForm} from './feedback-form';
import {FeedbackLaunchButton,type FeedbackRequest} from './feedback-launch';
import {AnalyticsConsent} from './analytics-consent';
import {MarketStoreNav} from './market-store-nav';
import {MarketDialogHost} from './market-dialog-host';

type Locale='EN'|'ID';
type NavItem={href:string;label:string;labelId:string;icon:typeof Home};
type SearchIdentity={id:string;printingId?:string;printingCode?:string|null;language?:string|null;set_code?:string|null;imageUrl?:string;rarity?:string|null;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string};
type SearchSet={code:string;name:string;setKind?:string};

const pokemonDisclaimer={
  EN:'VivrePlay is an independent fan project and is not affiliated with or endorsed by Nintendo, The Pokémon Company, Game Freak, or Creatures Inc. Pokémon, Pokémon TCG, and related card artwork are the property of their respective rights holders.',
  ID:'VivrePlay adalah proyek penggemar independen dan tidak berafiliasi dengan atau didukung oleh Nintendo, The Pokémon Company, Game Freak, maupun Creatures Inc. Pokémon, Pokémon TCG, dan ilustrasi kartu terkait adalah milik pemegang hak masing-masing.',
} as const;

const collectionMenu={label:'Collection',labelId:'Koleksi',items:[{href:'/vault',label:'Vault',labelId:'Koleksi',icon:ShieldCheck},{href:'/decks',label:'Decks',labelId:'Deck',icon:Library},{href:'/decks/builder',label:'Deck builder',labelId:'Pembuat deck',icon:Library}]} satisfies {label:string;labelId:string;items:NavItem[]};
const arenaMenu={label:'Arena',labelId:'Arena',items:[{href:'/play',label:'Arena lobby',labelId:'Lobi arena',icon:Gamepad2},{href:'/play/tutorial',label:'Learn to play',labelId:'Belajar bermain',icon:Gamepad2},{href:'/events',label:'Events',labelId:'Acara',icon:Trophy}]} satisfies {label:string;labelId:string;items:NavItem[]};
const market:NavItem={href:'/market',label:'Market',labelId:'Market',icon:Store};
const mobileNav:NavItem[]=[{href:'/',label:'Home',labelId:'Beranda',icon:Home},{href:'/cards',label:'Cards',labelId:'Kartu',icon:Layers3},{href:'/vault',label:'Vault',labelId:'Koleksi',icon:ShieldCheck},market,{href:'/play',label:'Arena',labelId:'Arena',icon:Gamepad2}];
const pokemonMobileNav:NavItem[]=[{href:'/',label:'Home',labelId:'Beranda',icon:Home},{href:'/pokemon',label:'Cards',labelId:'Kartu',icon:Layers3},{href:'/pokemon/sets',label:'Sets',labelId:'Set',icon:Library},{href:'/vault',label:'Vault',labelId:'Koleksi',icon:ShieldCheck},market];
const rail=[
  {title:'Build a deck',titleId:'Susun deck',body:'Choose a leader, then tune the curve with live cards.',bodyId:'Pilih leader, lalu atur kurva dengan kartu langsung.',action:'Open builder',actionId:'Buka pembuat deck',href:'/decks/builder'},
  {title:'Curate your vault',titleId:'Atur koleksi',body:'Keep the exact art and language you own together.',bodyId:'Simpan art dan bahasa cetakan yang Anda miliki.',action:'Open vault',actionId:'Buka koleksi',href:'/vault'},
  {title:'Learn the board',titleId:'Pelajari papan',body:'Use the guided table to understand each play zone.',bodyId:'Gunakan meja panduan untuk memahami setiap area.',action:'Open arena',actionId:'Buka arena',href:'/play'},
] as const;
const pokemonRail=[
  {title:'Browse Pokémon sets',titleId:'Jelajahi set Pokémon',body:'Compare releases and open a set to see its cards.',bodyId:'Bandingkan rilisan dan buka set untuk melihat kartunya.',action:'Browse sets',actionId:'Jelajahi set',href:'/pokemon/sets'},
  {title:'Build your Pokémon vault',titleId:'Isi Vault Pokémon',body:'Save the exact Pokémon card printing you own.',bodyId:'Simpan cetakan kartu Pokémon yang Anda miliki.',action:'Open Pokémon Vault',actionId:'Buka Vault Pokémon',href:'/vault?game=pokemon'},
  {title:'Find a Pokémon card',titleId:'Cari kartu Pokémon',body:'Search the catalog by name, number, set, or illustrator.',bodyId:'Cari katalog berdasarkan nama, nomor, set, atau ilustrator.',action:'Open card library',actionId:'Buka katalog kartu',href:'/pokemon'},
] as const;

function CookieNotice({language}:{language:Locale}) { const [open,setOpen]=useState(false); useEffect(()=>{const restore=()=>setOpen(true);setOpen(!window.localStorage.getItem('vivreplay-cookies'));window.addEventListener('vivreplay:cookie-preferences',restore);return()=>window.removeEventListener('vivreplay:cookie-preferences',restore)},[]); const dismiss=(choice:string)=>{window.localStorage.setItem('vivreplay-cookies',choice);window.dispatchEvent(new CustomEvent('vivreplay:consent-change',{detail:choice}));window.dispatchEvent(new Event('vivreplay:track-attribution'));setOpen(false)}; if(!open)return null; const copy=language==='ID'?{title:'Pilihan privasi',body:'Preferensi bahasa dan tampilan disimpan secara esensial. Terima pengukuran analitik dan kampanye opsional; tolak untuk menonaktifkannya.',accept:'Terima analitik',reject:'Tolak analitik'}:{title:'Privacy choices',body:'Language and display preferences use essential storage. Accept optional usage and UTM campaign measurement, or reject it.',accept:'Accept analytics',reject:'Reject analytics'}; return <aside className="cookie-notice" aria-label={copy.title}><Cookie size={17}/><div><strong>{copy.title}</strong><p>{copy.body}</p><div><button type="button" onClick={()=>dismiss('essential')}>{copy.reject}</button><button type="button" className="cookie-accept" onClick={()=>dismiss('all')}>{copy.accept}</button></div></div><button type="button" className="cookie-close" aria-label="Reject analytics and close cookie choices" onClick={()=>dismiss('essential')}><X size={14}/></button></aside>; }

function MiniRail({language,game}:{language:Locale;game:'one-piece'|'pokemon'}) {
  const actions=game==='pokemon'?pokemonRail:rail;
  const [index,setIndex]=useState(0); const [expanded,setExpanded]=useState(false); const [closing,setClosing]=useState(false); const [dismissed,setDismissed]=useState(false); const item=actions[index%actions.length];
  const collapse=()=>{setClosing(true);window.setTimeout(()=>{setExpanded(false);setClosing(false)},160)};
  const title=language==='ID'?item.titleId:item.title; const body=language==='ID'?item.bodyId:item.body; const action=language==='ID'?item.actionId:item.action;
  const linkHref=language==='ID'?`/id${item.href}`:item.href;
  if(dismissed)return <button type="button" className="mini-rail-reopen" aria-label={language==='ID'?'Buka aksi cepat':'Show quick actions'} onClick={()=>setDismissed(false)}><Layers3 size={17}/></button>;
  if(!expanded)return <button type="button" className="mini-rail-collapsed" aria-label={language==='ID'?'Buka aksi cepat':'Open quick actions'} aria-expanded="false" onClick={()=>setExpanded(true)}><Layers3 size={16}/><span>{language==='ID'?'Aksi cepat':'Quick actions'}</span><ChevronUp size={15}/></button>;
  return <aside className={`mini-rail is-expanded ${closing?'is-closing':''}`} aria-label={language==='ID'?'Aksi cepat VivrePlay':'VivrePlay quick actions'}>
    <header><span>{String(index+1).padStart(2,'0')} / {String(actions.length).padStart(2,'0')}</span><div><button type="button" aria-label={language==='ID'?'Tutup panel':'Collapse panel'} onClick={collapse}><ChevronDown size={15}/></button><button type="button" aria-label={language==='ID'?'Sembunyikan aksi cepat':'Dismiss quick actions'} onClick={()=>setDismissed(true)}><X size={15}/></button></div></header>
    <strong>{title}</strong><p>{body}</p><Link href={linkHref} className="mini-rail-action" onClick={collapse}>{action}<ChevronRight size={15}/></Link>
    <footer><button type="button" aria-label={language==='ID'?'Aksi sebelumnya':'Previous action'} onClick={()=>setIndex(value=>(value+actions.length-1)%actions.length)}><ChevronLeft size={15}/></button><i><b style={{width:`${(index+1)/actions.length*100}%`}}/></i><button type="button" aria-label={language==='ID'?'Aksi berikutnya':'Next action'} onClick={()=>setIndex(value=>(value+1)%actions.length)}><ChevronRight size={15}/></button></footer>
  </aside>;
}

function cardFrom(identity:SearchIdentity):Card|undefined { if(!identity.imageUrl)return undefined;return {id:identity.printingId??identity.id,code:identity.code,name:displayCardName(identity.name,identity.code),color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:identity.rarity??'',art:0,effect:identity.effect_text,imageUrl:identity.imageUrl,setCode:identity.set_code??undefined,language:identity.language??'EN',printingCode:identity.printingCode??identity.code,imageSource:'external'}; }
function HeaderSearch({language,game}:{language:Locale;game:'one-piece'|'pokemon'}) {
  const [open,setOpen]=useState(false);const [query,setQuery]=useState('');const [results,setResults]=useState<Card[]>([]);const [setMatches,setSetMatches]=useState<SearchSet[]>([]);const [loading,setLoading]=useState(false);
  useEffect(()=>{if(game==='pokemon'||!open||query.trim().length<2){setResults([]);setSetMatches([]);setLoading(false);return}let live=true;const timer=window.setTimeout(async()=>{setLoading(true);const term=query.trim().replaceAll(',',' ');try{const [cards,sets]=await Promise.all([fetch(`/api/cards/identities?q=${encodeURIComponent(term)}`,{cache:'force-cache'}).then(async response=>response.ok?response.json() as Promise<{cards:SearchIdentity[]}>:{cards:[]}),fetch('/api/cards/sets?language=EN',{cache:'force-cache'}).then(async response=>response.ok?response.json() as Promise<{sets:SearchSet[]}>:{sets:[]})]);if(live){setResults(cards.cards.map(cardFrom).filter((card):card is Card=>Boolean(card)));setSetMatches(sets.sets.filter(set=>`${set.code} ${set.name}`.toLowerCase().includes(term.toLowerCase())).slice(0,4));setLoading(false)}}catch{if(live){setResults([]);setSetMatches([]);setLoading(false)}}},170);return()=>{live=false;window.clearTimeout(timer)}},[open,query,game]);
  const copy=language==='ID'?{button:'Cari',title:game==='pokemon'?'Cari kartu Pokémon':'Temukan kartu atau set',hint:game==='pokemon'?'Cari nama, nomor kartu, rarity, atau set.':'Cari nama, set, warna, tipe, biaya, atau rarity. Contoh: OP17 leader, 5c Luffy.',empty:'Cari kartu atau set dengan nama atau kode.',none:'Tidak ada kartu atau set yang cocok.',cards:'Kartu',sets:'Set'}:{button:'Find',title:game==='pokemon'?'Search Pokémon cards':'Find cards or sets',hint:game==='pokemon'?'Search by name, card number, rarity, or set.':'Search name, set, color, type, cost, or rarity. Try OP17 leader or 5c Luffy.',empty:'Search a card or set by name or code.',none:'No cards or sets matched that search.',cards:'Cards',sets:'Sets'};
  const getHref=(href:string)=>language==='ID'?(href==='/'?'/id':`/id${href}`):href;
  const pokemonSearchHref=getHref(`/pokemon?q=${encodeURIComponent(query.trim())}`);
  return <Dialog open={open} onOpenChange={setOpen}><button type="button" aria-label={copy.button} className="search-link" onClick={()=>setOpen(true)}><Search size={16}/><span>{copy.button}</span><kbd>⌘ K</kbd></button><DialogContent className="header-search-dialog"><DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{copy.hint}</DialogDescription></DialogHeader><div className="header-search-input"><Search size={18}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder={copy.hint}/><kbd>ESC</kbd></div><div className="header-search-results" aria-live="polite">{game==='pokemon'&&query.trim().length>=2&&<Link href={pokemonSearchHref} onClick={()=>setOpen(false)} className="header-search-result header-search-set"><Search size={18}/><span><b>{language==='ID'?'Cari di katalog Pokémon':'Search Pokémon catalog'}</b><small>{query.trim()}</small></span><ChevronRight size={16}/></Link>}{loading&&Array.from({length:4}).map((_,i)=><i key={i} className="header-search-skeleton"/>)}{!loading&&query.trim().length<2&&<p>{copy.empty}</p>}{game!=='pokemon'&&!loading&&query.trim().length>=2&&!results.length&&!setMatches.length&&<p>{copy.none}</p>}{!loading&&Boolean(setMatches.length)&&<><small className="header-search-group">{copy.sets}</small>{setMatches.map(set=><Link href={getHref(`/cards?set=${encodeURIComponent(set.code)}`)} onClick={()=>setOpen(false)} key={set.code} className="header-search-result header-search-set"><Layers3 size={18}/><span><b>{set.name}</b><small>{set.code}{set.setKind?` · ${set.setKind}`:''}</small></span><ChevronRight size={16}/></Link>)}</>}{!loading&&Boolean(results.length)&&<><small className="header-search-group">{copy.cards}</small>{results.map(card=><Link href={getHref(`/cards/${card.code}`)} onClick={()=>setOpen(false)} key={card.id} className="header-search-result"><CardArt card={card}/><span><b>{card.name}</b><small>{card.code} · {card.type}</small></span><ChevronRight size={16}/></Link>)}</>}</div></DialogContent></Dialog>;
}
function PrimaryNav({language,selected,game}:{language:Locale;selected:(url:string)=>boolean;game:'one-piece'|'pokemon'}) {
  const root=useRef<HTMLElement>(null);
  const getHref=(href:string)=>language==='ID'?(href==='/'?'/id':`/id${href}`):href;
  const closeAll=()=>root.current?.querySelectorAll('details[open]').forEach(item=>item.removeAttribute('open'));
  useEffect(()=>{const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))closeAll()};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')closeAll()};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}},[]);
  const openMenu=(menu:HTMLDetailsElement)=>{root.current?.querySelectorAll('details[open]').forEach(item=>{if(item!==menu)item.removeAttribute('open')});menu.open=true};
  const libraryItems:NavItem[]=game==='pokemon'
    ?[{href:'/pokemon',label:'Cards',labelId:'Kartu',icon:Layers3},{href:'/pokemon/sets',label:'Sets',labelId:'Set',icon:Library}]
    :[{href:'/cards',label:'Cards',labelId:'Kartu',icon:Layers3},{href:'/cards/index',label:'Card index',labelId:'Indeks kartu',icon:Library},{href:'/archetypes',label:'Archetypes',labelId:'Arketipe',icon:Layers3},{href:'/sets',label:'Sets',labelId:'Set',icon:Library},{href:'/meta',label:'Meta stats',labelId:'Meta permainan',icon:ChartNoAxesCombined}];
  const menus=game==='pokemon'
    ?[{label:'Library',labelId:'Katalog',items:libraryItems}]
    :[{label:'Library',labelId:'Katalog',items:libraryItems},collectionMenu,arenaMenu];
  return <nav ref={root} aria-label="Primary navigation" className="primary-nav">{menus.map(menu=><details key={menu.label} className="nav-more" onPointerEnter={event=>openMenu(event.currentTarget)} onPointerLeave={event=>event.currentTarget.removeAttribute('open')} onToggle={event=>{if(!event.currentTarget.open)return;root.current?.querySelectorAll('details[open]').forEach(item=>{if(item!==event.currentTarget)item.removeAttribute('open')})}}><summary className={menu.items.some(item=>selected(item.href))?'active':''}>{language==='ID'?menu.labelId:menu.label}<ChevronDown size={13}/></summary><div>{menu.items.map(item=>{const Icon=item.icon;return <Link key={item.href} href={getHref(item.href)} onClick={closeAll} className={selected(item.href)?'active':''}><Icon size={14}/>{language==='ID'?item.labelId:item.label}</Link>})}</div></details>)}{game==='pokemon'&&<Link href={getHref('/vault?game=pokemon')} onClick={closeAll} className={selected('/vault')?'active market-nav':''}><ShieldCheck size={14}/>{language==='ID'?'Vault':'Vault'}</Link>}<Link href={getHref(game==='pokemon'?'/market?game=pokemon':market.href)} onClick={closeAll} className={selected(market.href)?'active market-nav':''}><Store size={14}/>{language==='ID'?market.labelId:market.label}</Link></nav>;
}

function GameModeSwitch({language,game,path,search}:{language:Locale;game:'one-piece'|'pokemon';path:string;search:string}) {
  const options=[{id:'one-piece' as const,href:'/cards',label:'One Piece',logo:'/assets/one-piece-card-game-logo.png'},{id:'pokemon' as const,href:'/pokemon',label:'Pokémon',logo:'https://upload.wikimedia.org/wikipedia/commons/1/1a/Pok%C3%A9mon_Trading_Card_Game_logo.svg'}];
  const localize=(href:string)=>language==='ID'?`/id${href}`:href;
  const hrefFor=(option:typeof options[number])=>{
    if(path!=='/vault')return localize(option.href);
    const params=new URLSearchParams(search);
    if(option.id==='pokemon')params.set('game','pokemon');else params.delete('game');
    return localize(`/vault${params.size?`?${params.toString()}`:''}`);
  };
  return <nav className="game-mode-switch" aria-label={language==='ID'?'Pilih katalog kartu':'Choose a card catalog'}>{options.map(option=><Link key={option.id} href={hrefFor(option)} aria-label={option.label} title={option.label} aria-current={game===option.id?'page':undefined} className={`${game===option.id?'is-active ':''}game-mode-${option.id}`}><span className="game-mode-logo-pad"><img src={option.logo} alt="" aria-hidden="true"/></span><span className="sr-only">{option.label}</span></Link>)}</nav>;
}

function Footer({language,game}:{language:Locale;game:'one-piece'|'pokemon'}) {
  const id=language==='ID';
  const getHref=(href:string)=>id?(href==='/'?'/id':`/id${href}`):href;
  const reopenCookies=()=>{window.localStorage.removeItem('vivreplay-cookies');window.dispatchEvent(new Event('vivreplay:cookie-preferences'))};
  return <footer className="page-footer">
    <div className="footer-top">
      <div className="footer-intro">
        <span className="footer-kicker">{game==='pokemon'?(id?'KARTU POKÉMON / SET / VAULT':'POKÉMON CARDS / SETS / VAULT'):(id?'KARTU / DEK / ARENA':'CARDS / DECKS / PLAY')}</span>
        <Link className="footer-brand" href={getHref('/')}><VivreMark size={27}/>VivrePlay</Link>
        <p>{game==='pokemon'?(id?'Jelajahi set Pokémon dan simpan kartu yang Anda miliki di Vault.':'Browse Pokémon sets and save the cards you own in your Vault.'):(id?'Cari kartu, susun deck, kelola koleksi, dan bermain.':'Find cards, build decks, manage your collection, and play.')}</p>
        <div className="footer-intro-actions">
          <Link className="footer-primary-link" href={getHref(game==='pokemon'?'/market?game=pokemon':'/market')}>{id?'Jelajahi Market':'Browse the Market'}<ChevronRight size={15}/></Link>
          <Link className="footer-secondary-link" href={getHref('/about')}>{id?'Tentang VivrePlay':'About VivrePlay'}</Link>
        </div>
      </div>
      <nav className="footer-column" aria-label={id?'Jelajahi':'Explore'}>
        <b>{id?'Jelajahi':'Explore'}</b>
        <Link href={getHref(game==='pokemon'?'/pokemon':'/cards')}>{id?'Katalog kartu':'Cards'}</Link>
        {game==='pokemon'?<><Link href={getHref('/pokemon/sets')}>{id?'Set Pokémon':'Sets'}</Link><Link href={getHref('/vault?game=pokemon')}>{id?'Vault Pokémon':'Pokémon Vault'}</Link></>:<><Link href={getHref('/cards/index')}>{id?'Indeks kartu':'Card index'}</Link><Link href={getHref('/archetypes')}>{id?'Arketipe':'Archetypes'}</Link><Link href={getHref('/sets')}>{id?'Arsip set':'Sets'}</Link></>}
      </nav>
      <nav className="footer-column" aria-label={id?(game==='pokemon'?'Koleksi':'Deck dan permainan'):(game==='pokemon'?'Collection':'Decks and play')}>
        <b>{id?(game==='pokemon'?'Koleksi':'Deck dan permainan'):(game==='pokemon'?'Collection':'Decks & play')}</b>
        {game==='pokemon'?<Link href={getHref('/vault?game=pokemon')}>{id?'Vault Pokémon':'Pokémon Vault'}</Link>:<><Link href={getHref('/decks')}>{id?'Deck':'Decks'}</Link><Link href={getHref('/decks/builder')}>{id?'Pembuat deck':'Deck builder'}</Link><Link href={getHref('/play')}>Arena</Link></>}
      </nav>
      <nav className="footer-column" aria-label={id?'Market dan bantuan':'Market and help'}>
        <b>{id?'Market dan bantuan':'Market & help'}</b>
        <Link href={getHref('/market')}>Market</Link>
        <Link href={getHref('/help')}>{id?'Pusat bantuan':'Help center'}</Link>
        <Link href={getHref('/faq')}>FAQ</Link>
        <FeedbackLaunchButton request={{initialCategory:'feedback'}} className="footer-feedback-trigger">{id?'Masukan & laporan':'Feedback & reports'}</FeedbackLaunchButton>
        <a href={`https://wa.me/6287892660993?text=${encodeURIComponent(id?'Halo VivrePlay, saya perlu bantuan tentang ':'Hi VivrePlay, I need help with ')}`} target="_blank" rel="noreferrer">WhatsApp</a>
      </nav>
    </div>
    <div className="footer-bottom">
      <p>{game==='pokemon'?(id?pokemonDisclaimer.ID:pokemonDisclaimer.EN):(id?'VivrePlay adalah proyek buatan penggemar dan tidak berafiliasi dengan atau didukung oleh Bandai. “One Piece Card Game” © Bandai Co., Ltd. “One Piece” © Eiichiro Oda / Shueisha, Toei Animation. Merek dagang, gambar kartu, dan konten permainan adalah milik pemegang hak masing-masing.':'Unofficial fan-made project, not affiliated with or endorsed by Bandai. “One Piece Card Game” © Bandai Co., Ltd. “One Piece” © Eiichiro Oda / Shueisha, Toei Animation. All trademarks, card images and game content belong to their respective owners and are used for informational and community purposes.')}</p>
      <div className="footer-bottom-side">
        <nav className="footer-legal" aria-label={id?'Legal':'Legal'}>
          <Link href={getHref('/legal/terms')}>{id?'Syarat & Ketentuan':'Terms'}</Link>
          <Link href={getHref('/legal/refund')}>{id?'Pengembalian dana':'Refunds'}</Link>
          <Link href={getHref('/legal/privacy')}>{id?'Privasi':'Privacy'}</Link>
          <button type="button" onClick={reopenCookies}>{id?'Preferensi cookie':'Cookie preferences'}</button>
        </nav>
      </div>
    </div>
  </footer>;
}

function MarketFooter({language,game}:{language:Locale;game:'one-piece'|'pokemon'}) {
  const id=language==='ID';
  const getHref=(href:string)=>id?(href==='/'?'/id':`/id${href}`):href;
  return <footer className={`market-footer${game==='pokemon'?' market-footer-pokemon':''}`}>
    <div className="market-footer-main">
      <Link className="market-footer-brand" href={getHref('/market')}><VivreMark size={24}/><span>VivrePlay <b>Market</b></span></Link>
      <p>{id?'Beli dan jual kartu dengan aman di VivrePlay Market.':'Buy and sell cards on VivrePlay Market.'}</p>
      <nav aria-label={id?'Jelajahi Market':'Market'}><Link href={getHref(game==='pokemon'?'/market?game=pokemon':'/market')}>{id?'Semua listing':'All listings'}</Link><Link href={getHref(game==='pokemon'?'/market?game=pokemon&tab=selling':'/market?tab=selling')}>{id?'Jual kartu':'Sell cards'}</Link><Link href={getHref(game==='pokemon'?'/market?game=pokemon&tab=buying':'/market?tab=buying')}>{id?'Cari kartu':'Find cards'}</Link></nav>
    </div>
    <div className="market-footer-side">
      <nav aria-label={id?'Bantuan dan kebijakan':'Help and policies'}><Link href={getHref('/help')}>{id?'Pusat bantuan':'Help center'}</Link><Link href={getHref('/faq')}>FAQ</Link><Link href={getHref('/contact')}>{id?'Kontak':'Contact'}</Link><Link href={getHref('/legal/terms')}>{id?'Syarat & Ketentuan':'Terms'}</Link><Link href={getHref('/legal/refund')}>{id?'Kebijakan pengembalian dana':'Refund policy'}</Link><Link href={getHref('/legal/privacy')}>{id?'Privasi':'Privacy'}</Link></nav>
      <small>{game==='pokemon'?(id?pokemonDisclaimer.ID:pokemonDisclaimer.EN):(id?'Proyek buatan penggemar, tidak berafiliasi dengan atau didukung oleh Bandai. One Piece Card Game dan seluruh gambar kartu adalah milik pemegang hak masing-masing.':'Unofficial fan-made project, not affiliated with or endorsed by Bandai. One Piece Card Game and all card artwork belong to their respective owners.')}</small>
    </div>
  </footer>;
}

export function Shell({children,initialPath='/'}:{children:React.ReactNode;initialPath?:string}) {
  const router=useRouter();
  const path=usePathname()??initialPath;
  const searchParams=useSearchParams();
  const isIdPath=path==='/id'||path.startsWith('/id/');
  const normalizedPath=isIdPath?(path.replace(/^\/id/,'')||'/'):path;
  const game:'one-piece'|'pokemon'=normalizedPath==='/pokemon'||normalizedPath.startsWith('/pokemon/')||searchParams.get('game')==='pokemon'?'pokemon':'one-piece';
  const marketCheckout=normalizedPath==='/checkout/market'||normalizedPath==='/checkout/pro'||normalizedPath.startsWith('/checkout/order/');
  const marketRoute=normalizedPath==='/market'||normalizedPath.startsWith('/market/');
  const adminRoute=normalizedPath==='/admin'||normalizedPath.startsWith('/admin/');
  const {data}=useAccount();
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [language,setLanguage]=useState<Locale>(()=>initialPath==='/id'||initialPath.startsWith('/id/')?'ID':'EN');
  const [scrolled,setScrolled]=useState(false);
  const [feedbackOpen,setFeedbackOpen]=useState(false);
  const [feedbackRequest,setFeedbackRequest]=useState<(FeedbackRequest&{key:number})|null>(null);
  const feedbackSequence=useRef(0);

  useLayoutEffect(()=>{
    const open=(event:Event)=>{
      const request=(event as CustomEvent<FeedbackRequest>).detail??{};
      setFeedbackRequest({...request,sourcePath:request.sourcePath??`${window.location.pathname}${window.location.search}`,key:++feedbackSequence.current});
      setFeedbackOpen(true);
    };
    window.addEventListener('vivreplay:open-feedback',open);
    return()=>window.removeEventListener('vivreplay:open-feedback',open);
  },[]);

  useEffect(()=>{
    const record=()=>{
      if(window.localStorage.getItem('vivreplay-cookies')!=='all')return;
    const params=new URLSearchParams(window.location.search);
    const attribution:Record<string,string>={};
    params.forEach((value,key)=>{if(key.startsWith('utm_')||['gclid','dclid','fbclid','msclkid','ttclid','twclid','li_fat_id'].includes(key))attribution[key]=value.slice(0,300)});
    try{
      const visitorKey='vivreplay-attribution-visitor';
      const visitorId=window.sessionStorage.getItem(visitorKey)??crypto.randomUUID();
      window.sessionStorage.setItem(visitorKey,visitorId);
      const firstVisitKey='vivreplay-attribution-recorded';
      if(window.sessionStorage.getItem(firstVisitKey))return;
      window.sessionStorage.setItem(firstVisitKey,'1');
      void fetch('/api/attribution',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({visitorId,landingPath:window.location.pathname,referrer:document.referrer,params:attribution})}).catch(()=>{});
    }catch{}
    };
    record();
    window.addEventListener('vivreplay:track-attribution',record);
    return()=>window.removeEventListener('vivreplay:track-attribution',record);
  },[path]);

  useEffect(()=>{
    if(!data)return;
    const convert=()=>{
      if(window.localStorage.getItem('vivreplay-cookies')!=='all')return;
      const visitorId=window.sessionStorage.getItem('vivreplay-attribution-visitor');
      if(!visitorId)return;
      const key=`vivreplay-attribution-converted:${visitorId}`;
      if(window.sessionStorage.getItem(key))return;
      void fetch('/api/attribution/conversion',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({visitorId})})
        .then(async response=>{if(response.ok){const result=await response.json() as {converted?:boolean};if(result.converted)window.sessionStorage.setItem(key,'1')}})
        .catch(()=>{});
    };
    convert();
    window.addEventListener('vivreplay:consent-change',convert);
    return()=>window.removeEventListener('vivreplay:consent-change',convert);
  },[data]);

  useEffect(()=>{const update=()=>setScrolled(window.scrollY>72);update();window.addEventListener('scroll',update,{passive:true});return()=>window.removeEventListener('scroll',update)},[]);

  useEffect(()=>{
    const storedTheme=window.localStorage.getItem('vivreplay-theme');
    const storedLocale=window.localStorage.getItem('vivreplay-locale');
    const pathHasId=window.location.pathname==='/id'||window.location.pathname.startsWith('/id/');
    const nextTheme=storedTheme==='dark'?'dark':'light';
    const nextLocale=pathHasId?'ID':(storedLocale==='ID'?'ID':'EN');
    setTheme(nextTheme);
    setLanguage(nextLocale);
    document.documentElement.dataset.theme=nextTheme;
    document.documentElement.lang=nextLocale==='ID'?'id':'en';
    if(pathHasId&&storedLocale!=='ID'){
      window.localStorage.setItem('vivreplay-locale','ID');
      document.cookie='vivreplay-locale=ID; path=/; max-age=31536000';
    }
    window.dispatchEvent(new CustomEvent('vivreplay:locale',{detail:nextLocale}));
  },[]);

  useEffect(()=>{
    const pathHasId=path==='/id'||path.startsWith('/id/');
    const nextLocale:Locale=pathHasId?'ID':(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    setLanguage(nextLocale);
    document.documentElement.lang=nextLocale==='ID'?'id':'en';
    window.localStorage.setItem('vivreplay-locale',nextLocale);
    document.cookie=`vivreplay-locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    window.dispatchEvent(new CustomEvent('vivreplay:locale',{detail:nextLocale}));
  },[path]);

  useEffect(()=>{
    const syncTheme=(event:Event)=>{const next=(event as CustomEvent<'light'|'dark'>).detail??(window.localStorage.getItem('vivreplay-theme')==='dark'?'dark':'light');setTheme(next);document.documentElement.dataset.theme=next};
    const syncLocale=(event:Event)=>{const next=(event as CustomEvent<Locale>).detail??(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');setLanguage(next);document.documentElement.lang=next==='ID'?'id':'en'};
    window.addEventListener('vivreplay:theme',syncTheme);
    window.addEventListener('vivreplay:locale',syncLocale);
    return()=>{window.removeEventListener('vivreplay:theme',syncTheme);window.removeEventListener('vivreplay:locale',syncLocale)};
  },[]);

  const toggleTheme=()=>setTheme(current=>{const next=current==='light'?'dark':'light';document.documentElement.dataset.theme=next;window.localStorage.setItem('vivreplay-theme',next);return next});

  const toggleLanguage=()=>{
    const next:Locale=language==='EN'?'ID':'EN';
    setLanguage(next);
    document.documentElement.lang=next==='ID'?'id':'en';
    window.localStorage.setItem('vivreplay-locale',next);
    document.cookie=`vivreplay-locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
    window.dispatchEvent(new CustomEvent('vivreplay:locale',{detail:next}));
    if(next==='ID'){
      const target=normalizedPath==='/'?'/id':`/id${normalizedPath}`;
      router.push(`${target}${window.location.search}${window.location.hash}`);
    }else{
      router.push(`${normalizedPath}${window.location.search}${window.location.hash}`);
    }
    return next;
  };

  const selected=(url:string)=>normalizedPath===url||(url!=='/'&&normalizedPath.startsWith(`${url}/`));
  const crumb=normalizedPath==='/'?(language==='ID'?'Beranda':'Home'):normalizedPath.split('/')[1].replace(/^./,char=>char.toUpperCase());
  const getHref=(href:string)=>language==='ID'?(href==='/'?'/id':`/id${href}`):href;

  if(adminRoute)return <div className="admin-shell"><div className="admin-shell-content">{children}</div><Toaster theme={theme}/></div>;

  return <div className={`site-shell${game==='pokemon'?' game-pokemon':''}${marketCheckout?' market-checkout-shell':''}`}>
    {marketCheckout?<><MarketStoreNav showPromo={false}/>{!data&&<AuthDialog language={language} showTrigger={false}/>}</>:<header className={`masthead ${scrolled?'is-scrolled':''} ${theme==='dark'?'theme-dark':''}`}>
      <Link className="wordmark" href={getHref('/')}><VivreMark size={28}/><span>VivrePlay</span></Link>
      <GameModeSwitch language={language} game={game} path={normalizedPath} search={searchParams.toString()}/>
      <PrimaryNav language={language} selected={selected} game={game}/>
      <div className="masthead-actions">
        <HeaderSearch language={language} game={game}/>
        <button className="locale-toggle" type="button" onClick={toggleLanguage} aria-label="Switch language">{language}</button>
        <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Use ${theme==='light'?'dark':'light'} mode`}>{theme==='light'?<Moon size={16}/>:<Sun size={16}/>}</button>
        {data?<button type="button" aria-label={language==='ID'?'Buka profil':'Open your profile'} className="profile-mark" onClick={()=>window.dispatchEvent(new Event('vivreplay:open-public-profile'))}><UserRound size={17}/></button>:<AuthDialog language={language}/>}
      </div>
    </header>}
    {!marketCheckout&&<div className="context-row"><span>VivrePlay</span><span aria-hidden="true">/</span><strong>{crumb}</strong></div>}
    {children}
    {!marketCheckout&&(marketRoute?<MarketFooter language={language} game={game}/>:<Footer language={language} game={game}/>)}
    <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
      <DialogContent className="feedback-dialog">
        <DialogHeader>
          <DialogTitle>{language==='ID'?'Masukan & laporan':'Feedback & reports'}</DialogTitle>
          <DialogDescription>{language==='ID'?'Ceritakan masalah atau ide Anda. Halaman yang sedang dibuka akan disertakan.':'Tell us what you found. The page you are viewing is attached automatically.'}</DialogDescription>
        </DialogHeader>
        {feedbackRequest&&<FeedbackForm key={feedbackRequest.key} initialCategory={feedbackRequest.initialCategory} cardCode={feedbackRequest.cardCode} printingId={feedbackRequest.printingId} listingId={feedbackRequest.listingId} cardOptions={feedbackRequest.cardOptions} sourcePath={feedbackRequest.sourcePath}/>}
      </DialogContent>
    </Dialog>
    <CookieNotice language={language}/>
    <AnalyticsConsent/>
    {!adminRoute&&!marketRoute&&<MarketDialogHost accountActions={!marketCheckout}/>}
    {!marketCheckout&&<NewCardsAnnouncement/>}
    {!marketCheckout&&<MiniRail language={language} game={game}/>}
    {!marketCheckout&&<nav className="mobile-nav" aria-label="Mobile navigation">
      {(game==='pokemon'?pokemonMobileNav:mobileNav).map(item=>{const Icon=item.icon;const href=item.label==='Cards'&&game==='pokemon'?'/pokemon':game==='pokemon'&&item.label==='Vault'?'/vault?game=pokemon':game==='pokemon'&&item.label==='Market'?'/market?game=pokemon':item.href;const active=game==='pokemon'&&item.label==='Cards'?normalizedPath==='/pokemon':selected(item.label==='Vault'?'/vault':item.label==='Market'?'/market':href);return <Link key={item.href} href={getHref(href)} className={active?'active':''} aria-current={active?'page':undefined}><Icon size={20}/><span>{language==='ID'?item.labelId:item.label}</span></Link>})}
    </nav>}
    <Toaster theme={theme}/>
  </div>;
}
