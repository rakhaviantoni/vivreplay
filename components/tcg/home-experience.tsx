'use client';

import Link from 'next/link';
import {useEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import {ArrowUpRightIcon as ArrowUpRight, SealCheckIcon as BadgeCheck, PlayCircleIcon as CirclePlay, StackIcon as Layers3, BooksIcon as Library, PauseIcon as Pause, PlayIcon as Play, ShoppingBagIcon as ShoppingBag, SwordIcon as Swords} from '@phosphor-icons/react';
import {createClient} from '@/utils/supabase/client';
import {CardArt} from './card-art';
import {SetsExperience} from './sets-experience';
import type {Card} from '@/packages/card-data/catalog';
import {isPlayableSet} from '@/packages/domain/release-availability';

type Identity = {id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string};
type Row = {id:string;card_image_url:string|null;rarity:string|null;set_code:string;language:string;printing_code:string|null;tcg_card_assets?:Array<{kind:string;object_key:string}>;tcg_card_identities:Identity};
const metaLeaderCodes=['OP09-062','OP17-079','OP14-020','ST30-001'];
const colourAura:Record<string,string>={red:'210 78 57',blue:'59 130 190',green:'48 147 102',purple:'126 81 180',yellow:'213 159 43',black:'49 63 76'};

function setRank(code:string){const match=code.toUpperCase().match(/^(OP|EB|ST|PRB|P|DON)[-_ ]?0*(\d+)/);if(!match)return 0;const family:{[key:string]:number}={OP:600,EB:500,ST:400,PRB:300,P:200,DON:100};return (family[match[1]]??0)*1000+Number(match[2]);}

function asCard(row:Row, index:number):Card {
  const identity=row.tcg_card_identities;
  return {id:row.id,code:identity.code,name:identity.name,color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:row.rarity??'',art:index,effect:identity.effect_text,imageUrl:row.card_image_url??undefined,imageSource:'external',setCode:row.set_code,language:row.language,printingCode:row.printing_code??identity.code,assetPath:row.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key};
}

function auraFor(colour:string|undefined){const name=(colour??'').toLowerCase().split(/[,/]/)[0].trim();return colourAura[name]??'177 126 47'}

export function HomeExperience(){
  const [cards,setCards]=useState<Card[]>([]);
  const [leaders,setLeaders]=useState<Card[]>([]);
  const [counts,setCounts]=useState({identities:0,printings:0});
  const [motionPaused,setMotionPaused]=useState(false);
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');
  const heroRef=useRef<HTMLElement>(null);
  useEffect(()=>{const client=createClient();let active=true;
    const featuredLeaders=Promise.all(metaLeaderCodes.map(async code=>{
      const {data:identity}=await client.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text').eq('code',code).maybeSingle();
      if(!identity)return null;
      const {data:printing}=await client.from('tcg_card_printings').select('id,card_image_url,rarity,set_code,language,printing_code,tcg_card_assets(kind,object_key)').eq('identity_id',identity.id).eq('language','EN').not('card_image_url','is',null).limit(1).maybeSingle();
      return printing?{...printing,tcg_card_identities:identity} as Row:null;
    }));
    Promise.all([
      client.from('tcg_card_printings').select('id,card_image_url,rarity,set_code,language,printing_code,tcg_card_assets(kind,object_key),tcg_card_identities!inner(id,code,name,color,card_type,cost,power,effect_text)').eq('language','EN').not('card_image_url','is',null).order('created_at',{ascending:false}).limit(300),
      featuredLeaders,
      client.from('tcg_card_identities').select('*',{count:'exact',head:true}),
      client.from('tcg_card_printings').select('*',{count:'exact',head:true}),
    ]).then(([featured,meta,identities,printings])=>{if(!active)return;const sorted=((featured.data??[]) as unknown as Row[]).filter(row=>isPlayableSet(row.set_code)).sort((a,b)=>setRank(b.set_code)-setRank(a.set_code)||(a.tcg_card_identities.card_type==='Leader'?0:1)-(b.tcg_card_identities.card_type==='Leader'?0:1)||a.tcg_card_identities.code.localeCompare(b.tcg_card_identities.code));const liveMeta=meta.filter((row):row is Row=>Boolean(row));setCards(sorted.slice(0,12).map(asCard));setLeaders((liveMeta.length?liveMeta:sorted.filter(row=>row.tcg_card_identities.card_type==='Leader').slice(0,4)).map(asCard));setCounts({identities:identities.count??0,printings:printings.count??0});});
    return()=>{active=false};
  },[]);
  useEffect(()=>{
    const syncLocale=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail);
    syncLocale();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);
  useEffect(()=>{const sections=document.querySelectorAll<HTMLElement>('.home-reveal');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.16});sections.forEach(section=>observer.observe(section));return()=>observer.disconnect()},[]);
  const copy=language==='ID'?{
    title:<>Kenali kartunya.<br/><em>Menangkan pertandingannya.</em></>,
    description:'Telusuri setiap versi cetak. Susun deck. Tentukan langkah berikutnya.',
    cards:'Jelajahi kartu', arena:'Masuk Arena', identities:'Identitas kartu', printings:'Versi cetak', languages:'Bahasa kartu',
    leftName:'Mihawk × Luffy & Ace', leftStatus:'Tidak diunggulkan · Mihawk', leftWins:'62 menang / 137 laga',
    rightName:'Robin × Luffy', rightStatus:'Diunggulkan · Robin', rightWins:'151 menang / 280 laga', first:'Giliran 1', second:'Giliran 2', pause:'Jeda gerak', resume:'Lanjutkan gerak',
    utilityEyebrow:'EKOSISTEM KARTU TERPADU',
    utilityTitle:<>Mulai dari satu kartu.<br/>Bawa ke mana pun Anda melangkah.</>,
    utilityDescription:'Satu kartu bisa menjadi poros deck, melengkapi koleksi, atau membalikkan jalannya laga. Pantau versi cetak, peran deck, dan riwayat koleksi dalam satu tempat.',
    explorePrintings:'Jelajahi versi cetak',
    explorePrintingsSub:'Temukan versi rilis EN atau JP secara akurat',
    buildDeck:'Susun deck',
    buildDeckSub:'Rancang daftar kartu dari data live terkini',
    trackVault:'Kelola koleksi Anda',
    trackVaultSub:'Simpan kartu reguler dan slab gradasi bersamaan',
    featuredEyebrow:'BARU SAJA DIKATALOGKAN',
    featuredTitle:'Jelajahi koleksi.',
    viewAllCards:'Lihat semua kartu',
    marqueeLabel:'Kartu yang baru saja dikatalogkan',
    marketEyebrow:'MARKET KARTU YANG LEBIH SEDERHANA',
    marketTitle:<>Temukan kartunya.<br/>Tanpa kerumitan.</>,
    marketDescription:'Telusuri listing berdasarkan versi cetak spesifik yang Anda koleksi. Informasi kondisi, bahasa, dan penjual yang transparan - tanpa tampilan bursa yang rumit.',
    browseMarket:'Buka Market',
    wantedTag:'DICARI',
    completeDeck:'Lengkapi deck',
    completeDeckDesc:'Cocokkan listing dengan kartu yang Anda butuhkan.',
    collectTag:'KOLEKSI',
    rawGraded:'Reguler & slab',
    rawGradedDesc:'Satu katalog terpadu untuk kartu reguler dan slab.',
    playTag:'TANDING',
    seeFit:'Ketahui perannya',
    seeFitDesc:'Buka listing dan lihat kecocokannya di dalam deck.',
  }:{
    title:<>Know the card.<br/><em>Own the match.</em></>,
    description:'Trace every printing. Build the deck. Make the next move.',
    cards:'Explore cards', arena:'Enter Arena', identities:'Card identities', printings:'Printings tracked', languages:'Card languages',
    leftName:'Mihawk × Luffy & Ace', leftStatus:'Unfavored · Mihawk', leftWins:'62 wins / 137 games',
    rightName:'Robin × Luffy', rightStatus:'Favored · Robin', rightWins:'151 wins / 280 games', first:'1st', second:'2nd', pause:'Pause motion', resume:'Resume motion',
    utilityEyebrow:'A CONNECTED CARD LIFE',
    utilityTitle:<>Start with one card.<br/>Go wherever it takes you.</>,
    utilityDescription:'A card can anchor a deck, complete a collection, or swing a match. Keep its printings, deck roles, and collection history in one place.',
    explorePrintings:'Explore printings',
    explorePrintingsSub:'Find an exact EN or JP version',
    buildDeck:'Build a deck',
    buildDeckSub:'Shape a list from live card data',
    trackVault:'Track your Vault',
    trackVaultSub:'Keep raw cards and slabs together',
    featuredEyebrow:'RECENTLY CATALOGUED',
    featuredTitle:'Explore the collection.',
    viewAllCards:'View all cards',
    marqueeLabel:'Recently catalogued cards',
    marketEyebrow:'THE MARKET, SIMPLIFIED',
    marketTitle:<>Find the card.<br/>Skip the clutter.</>,
    marketDescription:'Browse listings by the exact printing you collect. Clear condition, language, and seller information - no trading-floor dashboard.',
    browseMarket:'Browse Market',
    wantedTag:'WANTED',
    completeDeck:'Complete a deck',
    completeDeckDesc:'Match listings to the cards you are missing.',
    collectTag:'COLLECT',
    rawGraded:'Raw & graded',
    rawGradedDesc:'Keep one catalogue for cards and slabs.',
    playTag:'PLAY',
    seeFit:'See where it fits',
    seeFitDesc:'Open a listing and jump to deck use.',
  };
  const heroTone=useMemo(()=>({'--hero-left-aura':auraFor(leaders[2]?.color||leaders[3]?.color),'--hero-right-aura':auraFor(leaders[0]?.color||leaders[1]?.color)} as CSSProperties),[leaders]);
  function moveHero(event:React.PointerEvent<HTMLElement>){if(motionPaused||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const rect=event.currentTarget.getBoundingClientRect();const x=((event.clientX-rect.left)/rect.width-.5)*10;const y=((event.clientY-rect.top)/rect.height-.5)*10;event.currentTarget.style.setProperty('--hero-x',`${x.toFixed(2)}px`);event.currentTarget.style.setProperty('--hero-y',`${y.toFixed(2)}px`)}
  function resetHero(){heroRef.current?.style.setProperty('--hero-x','0px');heroRef.current?.style.setProperty('--hero-y','0px')}
  return <main className="home-page">
    <section ref={heroRef} style={heroTone} className={`home-hero ${motionPaused?'motion-paused':''}`} onPointerMove={moveHero} onPointerLeave={resetHero}>
      <div className="hero-printings hero-duel hero-duel-left" aria-label="Mihawk versus Luffy and Ace matchup">{leaders[2]&&<Link href={`/cards/${leaders[2].code}`} className="hero-card hero-card-0"><CardArt card={leaders[2]}/><small>{leaders[2].code}</small></Link>}{leaders[3]&&<Link href={`/cards/${leaders[3].code}`} className="hero-card hero-card-2"><CardArt card={leaders[3]}/><small>{leaders[3].code}</small></Link>}{!leaders.length&&<div className="hero-card-skeletons" aria-hidden="true"><i/><i/></div>}<Link href="/meta" className="hero-matchup"><span>{copy.leftName}</span><strong>45% <i>±8.3</i></strong><b>{copy.leftStatus}</b><small>{copy.leftWins}</small><div><em>{copy.first} <b>45%</b><i>58</i></em><em>{copy.second} <b>46%</b><i>79</i></em></div></Link></div>
      <div className="home-hero-copy"><h1>{copy.title}</h1><p>{copy.description}</p><div className="hero-actions"><Link className="button" href="/cards"><Library size={16}/>{copy.cards}</Link><Link className="text-action" href="/play"><CirclePlay size={16}/>{copy.arena}</Link></div><dl className="hero-stats"><div><dt>{copy.identities}</dt><dd>{counts.identities||'…'}</dd></div><div><dt>{copy.printings}</dt><dd>{counts.printings||'…'}</dd></div><div><dt>{copy.languages}</dt><dd>EN · JP</dd></div></dl></div>
      <div className="hero-printings hero-duel hero-duel-right" aria-label="Robin versus Luffy matchup">{leaders[0]&&<Link href={`/cards/${leaders[0].code}`} className="hero-card hero-card-1"><CardArt card={leaders[0]}/><small>{leaders[0].code}</small></Link>}{leaders[1]&&<Link href={`/cards/${leaders[1].code}`} className="hero-card hero-card-3"><CardArt card={leaders[1]}/><small>{leaders[1].code}</small></Link>}{!leaders.length&&<><div className="hero-card-skeletons" aria-hidden="true"><i/><i/></div><span className="sr-only" role="status">Loading leader cards</span></>}<Link href="/meta" className="hero-matchup"><span>{copy.rightName}</span><strong>54% <i>±5.8</i></strong><b>{copy.rightStatus}</b><small>{copy.rightWins}</small><div><em>{copy.first} <b>53%</b><i>192</i></em><em>{copy.second} <b>57%</b><i>88</i></em></div></Link><button type="button" className="hero-motion-toggle" onClick={()=>setMotionPaused(value=>!value)} aria-pressed={motionPaused} aria-label={motionPaused?copy.resume:copy.pause}>{motionPaused?<Play size={14}/>:<Pause size={14}/>}</button></div>
    </section>
    <section className="home-utility home-reveal"><div><p className="eyebrow">{copy.utilityEyebrow}</p><h2>{copy.utilityTitle}</h2><p>{copy.utilityDescription}</p></div><div className="utility-links"><Link href="/cards"><Layers3 size={20}/><span><b>{copy.explorePrintings}</b><small>{copy.explorePrintingsSub}</small></span><ArrowUpRight size={16}/></Link><Link href="/decks/builder"><Swords size={20}/><span><b>{copy.buildDeck}</b><small>{copy.buildDeckSub}</small></span><ArrowUpRight size={16}/></Link><Link href="/vault"><BadgeCheck size={20}/><span><b>{copy.trackVault}</b><small>{copy.trackVaultSub}</small></span><ArrowUpRight size={16}/></Link></div></section>
    <section className="home-featured home-reveal"><div className="section-heading"><div><p className="eyebrow">{copy.featuredEyebrow}</p><h2>{copy.featuredTitle}</h2></div><Link className="text-action" href="/cards">{copy.viewAllCards} <ArrowUpRight size={15}/></Link></div><div className="home-card-marquee" aria-label={copy.marqueeLabel}><div className="home-card-track">{[...cards.slice(0,8),...cards.slice(0,8)].map((card,index)=><Link href={`/cards/${card.code}`} key={`${card.id}-${index}`} aria-label={`Open ${card.name}`}><CardArt card={card}/></Link>)}</div></div></section>
    <SetsExperience compact/>
    <section className="home-market home-reveal"><div className="market-copy"><p className="eyebrow">{copy.marketEyebrow}</p><h2>{copy.marketTitle}</h2><p>{copy.marketDescription}</p><Link className="button" href="/market"><ShoppingBag size={16}/>{copy.browseMarket}</Link></div><div className="market-board"><div><small>{copy.wantedTag}</small><b>{copy.completeDeck}</b><span>{copy.completeDeckDesc}</span></div><div><small>{copy.collectTag}</small><b>{copy.rawGraded}</b><span>{copy.rawGradedDesc}</span></div><div><small>{copy.playTag}</small><b>{copy.seeFit}</b><span>{copy.seeFitDesc}</span></div></div></section>
  </main>;
}
