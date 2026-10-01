'use client';

import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {ChartLineUpIcon as ChartNoAxesCombined, CaretDownIcon as ChevronDown, CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, CookieIcon as Cookie, GameControllerIcon as Gamepad2, HouseIcon as Home, StackIcon as Layers3, BooksIcon as Library, MoonIcon as Moon, MagnifyingGlassIcon as Search, ShieldCheckIcon as ShieldCheck, StorefrontIcon as Store, SunIcon as Sun, TrophyIcon as Trophy, UserIcon as UserRound, XIcon as X} from '@phosphor-icons/react';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Toaster} from '@/components/ui/sonner';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {useAccount} from '@/lib/client';
import {createClient} from '@/utils/supabase/client';
import {CardArt} from './card-art';
import {displayCardName} from './card-name';
import type {Card} from '@/packages/card-data/catalog';
import {VivreMark} from './brand-assets';
import {AuthDialog} from './auth-dialog';
import {NewCardsAnnouncement} from './new-cards-announcement';
import {FeedbackForm} from './feedback-form';
import {FeedbackLaunchButton,type FeedbackRequest} from './feedback-launch';

type Locale='EN'|'ID';
type NavItem={href:string;label:string;labelId:string;icon:typeof Home};
type SearchIdentity={id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string;tcg_card_printings?:Array<{id:string;card_image_url:string|null;rarity:string|null;set_code:string;language:string;variant:string|null}>};
type SearchSet={external_set_id:string;name:string;set_kind:string|null};

const menus:Array<{label:string;labelId:string;items:NavItem[]}>= [
  {label:'Library',labelId:'Katalog',items:[{href:'/cards',label:'Card library',labelId:'Katalog kartu',icon:Layers3},{href:'/cards/index',label:'Card index',labelId:'Indeks kartu',icon:Library},{href:'/archetypes',label:'Archetypes',labelId:'Arketipe',icon:Layers3},{href:'/sets',label:'Set archive',labelId:'Arsip set',icon:Layers3},{href:'/meta',label:'Meta stats',labelId:'Meta permainan',icon:ChartNoAxesCombined}]},
  {label:'Collection',labelId:'Koleksi',items:[{href:'/vault',label:'Vault',labelId:'Vault',icon:ShieldCheck},{href:'/decks',label:'Decks',labelId:'Deck',icon:Library},{href:'/decks/builder',label:'Deck builder',labelId:'Pembuat deck',icon:Library}]},
  {label:'Arena',labelId:'Arena',items:[{href:'/play',label:'Arena lobby',labelId:'Lobi arena',icon:Gamepad2},{href:'/play/tutorial',label:'Learn to play',labelId:'Belajar bermain',icon:Gamepad2},{href:'/events',label:'Events',labelId:'Acara',icon:Trophy}]},
];
const market:NavItem={href:'/market',label:'Market',labelId:'Market',icon:Store};
const mobileNav:NavItem[]=[{href:'/',label:'Home',labelId:'Beranda',icon:Home},{href:'/cards',label:'Cards',labelId:'Kartu',icon:Layers3},{href:'/vault',label:'Vault',labelId:'Vault',icon:ShieldCheck},market,{href:'/play',label:'Arena',labelId:'Arena',icon:Gamepad2}];
const rail=[
  {title:'Build a deck',titleId:'Susun deck',body:'Choose a leader, then tune the curve with live cards.',bodyId:'Pilih leader, lalu atur kurva dengan kartu langsung.',action:'Open builder',actionId:'Buka pembuat deck',href:'/decks/builder'},
  {title:'Curate your vault',titleId:'Atur vault',body:'Keep the exact art and language you own together.',bodyId:'Simpan art dan bahasa cetakan yang Anda miliki.',action:'Open vault',actionId:'Buka vault',href:'/vault'},
  {title:'Learn the board',titleId:'Pelajari papan',body:'Use the guided table to understand each play zone.',bodyId:'Gunakan meja panduan untuk memahami setiap area.',action:'Open arena',actionId:'Buka arena',href:'/play'},
] as const;

function CookieNotice({language}:{language:Locale}) { const [open,setOpen]=useState(false); useEffect(()=>{const restore=()=>setOpen(true);setOpen(!window.localStorage.getItem('vivreplay-cookies'));window.addEventListener('vivreplay:cookie-preferences',restore);return()=>window.removeEventListener('vivreplay:cookie-preferences',restore)},[]); const dismiss=(choice:string)=>{window.localStorage.setItem('vivreplay-cookies',choice);setOpen(false)}; if(!open)return null; const copy=language==='ID'?{title:'Pilihan cookie',body:'Kami memakai penyimpanan lokal untuk preferensi tampilan dan bahasa. Banner ini tidak mengirim data analitik.',accept:'Terima',reject:'Tolak',settings:'Pengaturan'}:{title:'Cookie choices',body:'We use local storage for display and language preferences. This banner does not send analytics data.',accept:'Accept',reject:'Reject',settings:'Settings'}; return <aside className="cookie-notice" aria-label={copy.title}><Cookie size={17}/><div><strong>{copy.title}</strong><p>{copy.body}</p><div><button onClick={()=>dismiss('essential')}>{copy.reject}</button><button className="cookie-accept" onClick={()=>dismiss('all')}>{copy.accept}</button><button onClick={()=>dismiss('settings')}>{copy.settings}</button></div></div><button className="cookie-close" aria-label="Close cookie choices" onClick={()=>dismiss('dismissed')}><X size={14}/></button></aside>; }

function MiniRail({language}:{language:Locale}) {
  const [index,setIndex]=useState(0); const [expanded,setExpanded]=useState(false); const [closing,setClosing]=useState(false); const [dismissed,setDismissed]=useState(false); const item=rail[index];
  const collapse=()=>{setClosing(true);window.setTimeout(()=>{setExpanded(false);setClosing(false)},160)};
  const title=language==='ID'?item.titleId:item.title; const body=language==='ID'?item.bodyId:item.body; const action=language==='ID'?item.actionId:item.action;
  const linkHref=language==='ID'?`/id${item.href}`:item.href;
  if(dismissed)return <button type="button" className="mini-rail-reopen" aria-label={language==='ID'?'Buka aksi cepat':'Show quick actions'} onClick={()=>setDismissed(false)}><Layers3 size={17}/></button>;
  if(!expanded)return <button type="button" className="mini-rail-collapsed" onClick={()=>setExpanded(true)}><Layers3 size={16}/><span>{language==='ID'?'Aksi cepat':'Quick actions'}</span><ChevronLeft size={15}/></button>;
  return <aside className={`mini-rail is-expanded ${closing?'is-closing':''}`} aria-label={language==='ID'?'Aksi cepat VivrePlay':'VivrePlay quick actions'}>
    <header><span>{String(index+1).padStart(2,'0')} / {String(rail.length).padStart(2,'0')}</span><div><button type="button" aria-label={language==='ID'?'Tutup panel':'Collapse panel'} onClick={collapse}><ChevronDown size={15}/></button><button type="button" aria-label={language==='ID'?'Sembunyikan aksi cepat':'Dismiss quick actions'} onClick={()=>setDismissed(true)}><X size={15}/></button></div></header>
    <strong>{title}</strong><p>{body}</p><Link href={linkHref} className="mini-rail-action" onClick={collapse}>{action}<ChevronRight size={15}/></Link>
    <footer><button type="button" aria-label="Previous action" onClick={()=>setIndex(value=>(value+rail.length-1)%rail.length)}><ChevronLeft size={15}/></button><i><b style={{width:`${(index+1)/rail.length*100}%`}}/></i><button type="button" aria-label="Next action" onClick={()=>setIndex(value=>(value+1)%rail.length)}><ChevronRight size={15}/></button></footer>
  </aside>;
}

function cardFrom(identity:SearchIdentity):Card|undefined { const printing=(identity.tcg_card_printings??[]).filter(row=>row.card_image_url).sort((a,b)=>Number(a.language!=='EN')-Number(b.language!=='EN')+Number((a.variant??'').toLowerCase().includes('parallel'))-Number((b.variant??'').toLowerCase().includes('parallel')))[0]; if(!printing?.card_image_url)return undefined; return {id:printing.id,code:identity.code,name:displayCardName(identity.name,identity.code),color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:printing.rarity??'',art:0,effect:identity.effect_text,imageUrl:printing.card_image_url,imageSource:'external'}; }
function HeaderSearch({language}:{language:Locale}) {
  const [open,setOpen]=useState(false);const [query,setQuery]=useState('');const [results,setResults]=useState<Card[]>([]);const [setMatches,setSetMatches]=useState<SearchSet[]>([]);const [loading,setLoading]=useState(false);
  useEffect(()=>{if(!open||query.trim().length<2){setResults([]);setSetMatches([]);setLoading(false);return}let live=true;const timer=window.setTimeout(async()=>{setLoading(true);const term=query.trim().replaceAll(',',' ');const client=createClient();const [cards,sets]=await Promise.all([client.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text,tcg_card_printings(id,card_image_url,rarity,set_code,language,variant)').or(`code.ilike.%${term}%,name.ilike.%${term}%`).limit(7),client.from('tcg_sets').select('external_set_id,name,set_kind').or(`external_set_id.ilike.%${term}%,name.ilike.%${term}%`).limit(4)]);if(live){setResults(((cards.data??[]) as SearchIdentity[]).map(cardFrom).filter((card):card is Card=>Boolean(card)));setSetMatches((sets.data??[]) as SearchSet[]);setLoading(false)}},170);return()=>{live=false;window.clearTimeout(timer)}},[open,query]);
  const copy=language==='ID'?{button:'Cari',title:'Temukan kartu atau set',hint:'Cari nama atau nomor kartu, atau kode set',empty:'Cari kartu atau set dengan nama atau kode.',none:'Tidak ada kartu atau set yang cocok.',cards:'Kartu',sets:'Set'}:{button:'Find',title:'Find cards or sets',hint:'Search a card name, card number, or set code',empty:'Search a card or set by name or code.',none:'No cards or sets matched that search.',cards:'Cards',sets:'Sets'};
  const getHref=(href:string)=>language==='ID'?(href==='/'?'/id':`/id${href}`):href;
  return <Dialog open={open} onOpenChange={setOpen}><button type="button" aria-label={copy.button} className="search-link" onClick={()=>setOpen(true)}><Search size={16}/><span>{copy.button}</span><kbd>⌘ K</kbd></button><DialogContent className="header-search-dialog"><DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{copy.hint}</DialogDescription></DialogHeader><div className="header-search-input"><Search size={18}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder={copy.hint}/><kbd>ESC</kbd></div><div className="header-search-results" aria-live="polite">{loading&&Array.from({length:4}).map((_,i)=><i key={i} className="header-search-skeleton"/>)}{!loading&&query.trim().length<2&&<p>{copy.empty}</p>}{!loading&&query.trim().length>=2&&!results.length&&!setMatches.length&&<p>{copy.none}</p>}{!loading&&Boolean(setMatches.length)&&<><small className="header-search-group">{copy.sets}</small>{setMatches.map(set=><Link href={getHref(`/cards?set=${encodeURIComponent(set.external_set_id)}`)} onClick={()=>setOpen(false)} key={set.external_set_id} className="header-search-result header-search-set"><Layers3 size={18}/><span><b>{set.name}</b><small>{set.external_set_id}{set.set_kind?` · ${set.set_kind}`:''}</small></span><ChevronRight size={16}/></Link>)}</>}{!loading&&Boolean(results.length)&&<><small className="header-search-group">{copy.cards}</small>{results.map(card=><Link href={getHref(`/cards/${card.code}`)} onClick={()=>setOpen(false)} key={card.id} className="header-search-result"><CardArt card={card}/><span><b>{card.name}</b><small>{card.code} · {card.type}</small></span><ChevronRight size={16}/></Link>)}</>}</div></DialogContent></Dialog>;
}
function PrimaryNav({language,selected}:{language:Locale;selected:(url:string)=>boolean}) {
  const root=useRef<HTMLElement>(null);
  const getHref=(href:string)=>language==='ID'?(href==='/'?'/id':`/id${href}`):href;
  const closeAll=()=>root.current?.querySelectorAll('details[open]').forEach(item=>item.removeAttribute('open'));
  useEffect(()=>{const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))closeAll()};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')closeAll()};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}},[]);
  const openMenu=(menu:HTMLDetailsElement)=>{root.current?.querySelectorAll('details[open]').forEach(item=>{if(item!==menu)item.removeAttribute('open')});menu.open=true};
  return <nav ref={root} aria-label="Primary navigation" className="primary-nav">{menus.map(menu=><details key={menu.label} className="nav-more" onPointerEnter={event=>openMenu(event.currentTarget)} onPointerLeave={event=>event.currentTarget.removeAttribute('open')} onToggle={event=>{if(!event.currentTarget.open)return;root.current?.querySelectorAll('details[open]').forEach(item=>{if(item!==event.currentTarget)item.removeAttribute('open')})}}><summary className={menu.items.some(item=>selected(item.href))?'active':''}>{language==='ID'?menu.labelId:menu.label}<ChevronDown size={13}/></summary><div>{menu.items.map(item=>{const Icon=item.icon;return <Link key={item.href} href={getHref(item.href)} onClick={closeAll} className={selected(item.href)?'active':''}><Icon size={14}/>{language==='ID'?item.labelId:item.label}</Link>})}</div></details>)}<Link href={getHref(market.href)} onClick={closeAll} className={selected(market.href)?'active market-nav':''}><Store size={14}/>{language==='ID'?market.labelId:market.label}</Link></nav>;
}

function Footer({language}:{language:Locale}) {
  const id=language==='ID';
  const getHref=(href:string)=>id?(href==='/'?'/id':`/id${href}`):href;
  const reopenCookies=()=>{window.localStorage.removeItem('vivreplay-cookies');window.dispatchEvent(new Event('vivreplay:cookie-preferences'))};
  return <footer className="page-footer"><div className="footer-top"><div className="footer-intro"><Link className="footer-brand" href={getHref('/')}><VivreMark size={25}/>VivrePlay</Link><p>{id?'Tempat untuk menemukan kartu, membangun deck, mengelola koleksi, dan bermain.':'Find cards, build decks, manage your collection, and play.'}</p><Link className="footer-about-link" href={getHref('/about')}>{id?'Tentang VivrePlay':'About VivrePlay'}<ChevronRight size={14}/></Link></div><nav className="footer-column" aria-label={id?'Jelajahi':'Explore'}><b>{id?'Jelajahi':'Explore'}</b><Link href={getHref('/cards')}>{id?'Katalog kartu':'Card library'}</Link><Link href={getHref('/cards/index')}>{id?'Indeks kartu':'Card index'}</Link><Link href={getHref('/archetypes')}>{id?'Arketipe':'Archetypes'}</Link><Link href={getHref('/sets')}>{id?'Arsip set':'Sets'}</Link></nav><nav className="footer-column" aria-label={id?'Main dan koleksi':'Play and collect'}><b>{id?'Main dan koleksi':'Play & collect'}</b><Link href={getHref('/decks')}>{id?'Deck':'Decks'}</Link><Link href={getHref('/decks/builder')}>{id?'Pembuat deck':'Deck builder'}</Link><Link href={getHref('/play')}>Arena</Link><Link href={getHref('/market')}>Market</Link><FeedbackLaunchButton request={{initialCategory:'feedback'}} className="footer-feedback-trigger">{id?'Masukan & laporan':'Feedback & reports'}</FeedbackLaunchButton></nav></div><div className="footer-bottom"><p>Unofficial fan-made project, not affiliated with or endorsed by Bandai. “One Piece Card Game” © Bandai Co., Ltd. “One Piece” © Eiichiro Oda / Shueisha, Toei Animation. All trademarks, card images and game content belong to their respective owners and are used for informational and community purposes.</p><nav className="footer-legal" aria-label={id?'Legal':'Legal'}><Link href={getHref('/legal/terms')}>{id?'Ketentuan':'Terms'}</Link><Link href={getHref('/legal/privacy')}>{id?'Privasi':'Privacy'}</Link><button type="button" onClick={reopenCookies}>{id?'Preferensi cookie':'Cookie preferences'}</button></nav></div></footer>;
}

export function Shell({children}:{children:React.ReactNode}) {
  const router=useRouter();
  const path=usePathname();
  const isIdPath=path==='/id'||path.startsWith('/id/');
  const normalizedPath=isIdPath?(path.replace(/^\/id/,'')||'/'):path;
  const {data}=useAccount();
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [language,setLanguage]=useState<Locale>('EN');
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
      router.push(target);
    }else{
      router.push(normalizedPath);
    }
    return next;
  };

  const selected=(url:string)=>normalizedPath===url||(url!=='/'&&normalizedPath.startsWith(`${url}/`));
  const crumb=normalizedPath==='/'?(language==='ID'?'Beranda':'Home'):normalizedPath.split('/')[1].replace(/^./,char=>char.toUpperCase());
  const getHref=(href:string)=>language==='ID'?(href==='/'?'/id':`/id${href}`):href;

  return <div className="site-shell">
    <header className={`masthead ${scrolled?'is-scrolled':''} ${theme==='dark'?'theme-dark':''}`}>
      <Link className="wordmark" href={getHref('/')}><VivreMark size={28}/><span>VivrePlay</span></Link>
      <PrimaryNav language={language} selected={selected}/>
      <div className="masthead-actions">
        <HeaderSearch language={language}/>
        <button className="locale-toggle" type="button" onClick={toggleLanguage} aria-label="Switch language">{language}</button>
        <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Use ${theme==='light'?'dark':'light'} mode`}>{theme==='light'?<Moon size={16}/>:<Sun size={16}/>}</button>
        {data?<Link href={getHref('/profile')} aria-label="Open your profile" className="profile-mark"><UserRound size={17}/></Link>:<AuthDialog language={language}/>}
      </div>
    </header>
    <div className="context-row"><span>VivrePlay</span><span aria-hidden="true">/</span><strong>{crumb}</strong></div>
    {children}
    <Footer language={language}/>
    <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
      <DialogContent className="feedback-dialog">
        <DialogHeader>
          <DialogTitle>{language==='ID'?'Masukan & laporan':'Feedback & reports'}</DialogTitle>
          <DialogDescription>{language==='ID'?'Ceritakan masalah atau ide Anda. Halaman yang sedang dibuka akan disertakan.':'Tell us what you found. The page you are viewing is attached automatically.'}</DialogDescription>
        </DialogHeader>
        {feedbackRequest&&<FeedbackForm key={feedbackRequest.key} initialCategory={feedbackRequest.initialCategory} cardCode={feedbackRequest.cardCode} printingId={feedbackRequest.printingId} listingId={feedbackRequest.listingId} sourcePath={feedbackRequest.sourcePath}/>}
      </DialogContent>
    </Dialog>
    <CookieNotice language={language}/>
    <NewCardsAnnouncement/>
    <MiniRail language={language}/>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {mobileNav.map(item=>{const Icon=item.icon;return <Link key={item.href} href={getHref(item.href)} className={selected(item.href)?'active':''}><Icon size={20}/><span>{language==='ID'?item.labelId:item.label}</span></Link>})}
    </nav>
    <Toaster richColors theme={theme}/>
  </div>;
}
