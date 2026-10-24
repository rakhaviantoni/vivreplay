'use client';

import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';
import {ArrowUpRightIcon as ArrowUpRight, SealCheckIcon as BadgeCheck, PlayCircleIcon as CirclePlay, StackIcon as Layers3, BooksIcon as Library, PauseIcon as Pause, PlayIcon as Play, ShoppingBagIcon as ShoppingBag, SwordIcon as Swords} from '@phosphor-icons/react';
import {CardArt} from './card-art';
import {SetsExperience} from './sets-experience';
import type {Card} from '@/packages/card-data/catalog';

type Identity = {id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text?:string};
type Row = {id:string;card_image_url:string|null;rarity:string|null;set_code:string;set_name:string;language:string;printing_code:string|null;variant?:string|null;source_payload?:Record<string,unknown>|null;tcg_card_assets?:Array<{kind:string;object_key:string}>;tcg_card_identities:Identity};
type PokemonSet = {code:string;name:string;releaseYear:number;releaseDate?:string;mainSetTotal:number;parallelsTotal:number;productImageUrl?:string};
const metaLeaderCodes=['OP09-062','OP17-079','OP14-020','ST30-001'];

function setRank(code:string){const match=code.toUpperCase().match(/^(OP|EB|ST|PRB|P|DON)[-_ ]?0*(\d+)/);if(!match)return 0;const family:{[key:string]:number}={OP:600,EB:500,ST:400,PRB:300,P:200,DON:100};return (family[match[1]]??0)*1000+Number(match[2]);}

function asCard(row:Row, index:number, game:'one-piece'|'pokemon'='one-piece'):Card&{gameSlug?:string} {
  const identity=row.tcg_card_identities;
  const number=String(row.source_payload?.localId??row.printing_code??identity.code).replace(/_p\d+$/i,'');
  return {id:row.id,code:identity.code,name:identity.name,color:game==='pokemon'?'Yellow':identity.color,type:game==='pokemon'?'Character':identity.card_type,cost:identity.cost,power:identity.power,rarity:row.rarity??'',art:index,effect:identity.effect_text??'',imageUrl:row.card_image_url??undefined,imageSource:'external',setCode:row.set_code,language:row.language,printingCode:row.printing_code??identity.code,localCardNumber:game==='pokemon'?number:undefined,variant:row.variant??undefined,assetPath:row.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key,gameSlug:game==='pokemon'?'pokemon':undefined};
}

function PokemonHomeSets({language}:{language:'EN'|'ID'}){
  const [sets,setSets]=useState<PokemonSet[]>([]);
  const id=language==='ID';
  useEffect(()=>{let active=true;fetch('/api/cards/sets?game=pokemon&language=EN',{cache:'force-cache'}).then(async response=>response.ok?(await response.json() as {sets?:PokemonSet[]}).sets??[]:[]).then(rows=>{if(active)setSets(rows.slice(0,6))}).catch(()=>{if(active)setSets([])});return()=>{active=false}},[]);
  return <section className="home-sets home-sets-pokemon home-reveal"><div className="section-heading"><div><p className="eyebrow">{id?'ARSIP SET':'SET ARCHIVE'}</p><h2>{id?'Rilisan terbaru.':'Recent releases.'}</h2><p>{id?'Lihat kartu dari set Pokémon terbaru.':'Browse cards from recent Pokémon sets.'}</p></div><Link className="text-action" href={id?'/id/pokemon/sets':'/pokemon/sets'}>{id?'Semua set':'All sets'} <ArrowUpRight size={15}/></Link></div><div className="pokemon-home-set-grid">{sets.map(set=><Link href={`${id?'/id':''}/pokemon/cards?set=${encodeURIComponent(set.code)}`} className="pokemon-home-set" key={set.code}><small>{set.releaseYear||set.releaseDate?.slice(0,4)||''}</small><strong>{set.name}</strong><span>{set.code}</span></Link>)}{!sets.length&&<p className="pokemon-home-set-empty">{id?'Set akan muncul di sini setelah katalog tersedia.':'Sets will appear here as the catalog loads.'}</p>}</div></section>;
}

export function HomeExperience({game='one-piece'}:{game?:'one-piece'|'pokemon'}){
  const pokemon=game==='pokemon';
  const [cards,setCards]=useState<Array<Card&{gameSlug?:string}>>([]);
  const [leaders,setLeaders]=useState<Array<Card&{gameSlug?:string}>>([]);
  const [counts,setCounts]=useState({identities:0,printings:0});
  const [motionPaused,setMotionPaused]=useState(false);
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');
  const heroRef=useRef<HTMLElement>(null);
  useEffect(()=>{let active=true;
    const catalogUrl=pokemon?'/api/cards/catalog?game=pokemon&language=EN&limit=500':'/api/cards/catalog?language=EN&limit=500';
    const loadFeatured=async()=>{const response=await fetch(catalogUrl,{cache:'force-cache'});const rows=response.ok?(await response.json() as {cards:Row[]}).cards:[];if(!active)return;
      if(pokemon){const visible=rows.filter(row=>row.card_image_url);setCards(visible.slice(0,12).map((row,index)=>asCard(row,index,'pokemon')));setLeaders(visible.slice(0,4).map((row,index)=>asCard(row,index,'pokemon')));return;}
      const [metaResponse]=await Promise.all([fetch(`/api/cards/catalog?language=EN&codes=${encodeURIComponent(metaLeaderCodes.join(','))}`,{cache:'force-cache'})]);const meta=metaResponse.ok?(await metaResponse.json() as {cards:Row[]}).cards:[];if(!active)return;const sorted=rows.sort((a,b)=>setRank(b.set_code)-setRank(a.set_code)||(a.tcg_card_identities.card_type==='Leader'?0:1)-(b.tcg_card_identities.card_type==='Leader'?0:1)||a.tcg_card_identities.code.localeCompare(b.tcg_card_identities.code));const liveMeta=new Map<string,Row>();for(const row of meta){if(metaLeaderCodes.includes(row.tcg_card_identities.code)&&(!liveMeta.has(row.tcg_card_identities.code)||setRank(row.set_code)>setRank(liveMeta.get(row.tcg_card_identities.code)!.set_code)))liveMeta.set(row.tcg_card_identities.code,row)}setCards(sorted.slice(0,12).map((row,index)=>asCard(row,index)));setLeaders((liveMeta.size?metaLeaderCodes.map(code=>liveMeta.get(code)).filter((row):row is Row=>Boolean(row)):sorted.filter(row=>row.tcg_card_identities.card_type==='Leader').slice(0,4)).map((row,index)=>asCard(row,index)));
    };
    void loadFeatured().catch(()=>{});
    const loadCounts=()=>{void fetch(`/api/cards/summary${pokemon?'?game=pokemon':''}`,{cache:'force-cache'}).then(response=>response.ok?response.json() as Promise<{identities:number;printings:number}>:null).then(value=>{if(active&&value)setCounts(value)})};
    const idleWindow=window as Window&{requestIdleCallback?:(callback:()=>void,options?:IdleRequestOptions)=>number;cancelIdleCallback?:(handle:number)=>void};
    if(typeof idleWindow.requestIdleCallback==='function'){const idle=idleWindow.requestIdleCallback(loadCounts,{timeout:5000});return()=>{active=false;idleWindow.cancelIdleCallback?.(idle)}}
    const timer=window.setTimeout(loadCounts,2500);
    return()=>{active=false;window.clearTimeout(timer)};
  },[pokemon]);
  useEffect(()=>{
    const syncLocale=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail);
    syncLocale();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);
  useEffect(()=>{const sections=document.querySelectorAll<HTMLElement>('.home-reveal');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.16});sections.forEach(section=>observer.observe(section));return()=>observer.disconnect()},[]);
  const onePieceCopy=language==='ID'?{
    title:<>Kenali kartunya.<br/><em>Menangkan pertandingannya.</em></>,
    description:'Telusuri setiap versi cetak. Susun deck. Tentukan langkah berikutnya.',
    cards:'Jelajahi kartu', arena:'Masuk Arena', identities:'Identitas kartu', printings:'Versi cetak', languages:'Bahasa kartu',
    leftName:'Lihat pertandingan', rightName:'Jelajahi meta', pause:'Jeda gerak', resume:'Lanjutkan gerak',
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
    leftName:'Recorded matches', rightName:'Explore the meta', pause:'Pause motion', resume:'Resume motion',
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
  const pokemonCopy=language==='ID'?{
    title:<>Kenali setiap kartu.<br/><em>Bangun koleksimu.</em></>,description:'Jelajahi kartu Pokémon, rilisan, dan bahasa yang tersedia dalam katalog.',cards:'Jelajahi kartu',arena:'Lihat set',identities:'Identitas kartu',printings:'Versi cetak',languages:'Bahasa kartu',leftName:'Koleksi kartu',rightName:'Kartu terbaru',pause:'Jeda gerak',resume:'Lanjutkan gerak',utilityEyebrow:'KATALOG KARTU POKÉMON',utilityTitle:<>Cari kartunya.<br/>Simpan versi yang tepat.</>,utilityDescription:'Temukan kartu berdasarkan nama, nomor, set, bahasa, atau ilustrator. Simpan versi cetak yang Anda miliki di Vault.',explorePrintings:'Jelajahi katalog',explorePrintingsSub:'Cari nama, nomor, set, dan ilustrator',buildDeck:'Jelajahi set',buildDeckSub:'Lihat kartu dari setiap rilisan',trackVault:'Kelola Vault',trackVaultSub:'Simpan kartu Pokémon dan slab',featuredEyebrow:'KARTU DI KATALOG',featuredTitle:'Jelajahi kartu Pokémon.',viewAllCards:'Lihat katalog',marqueeLabel:'Kartu Pokémon',marketEyebrow:'BELI DAN JUAL KARTU',marketTitle:<>Temukan kartu.<br/>Pilih versi yang tepat.</>,marketDescription:'Jelajahi listing berdasarkan bahasa, set, dan versi cetak. Beli kartu atau pasang listing dari Vault.',browseMarket:'Buka Market',wantedTag:'CARI',completeDeck:'Temukan kartu',completeDeckDesc:'Telusuri kartu yang sedang dijual.',collectTag:'SIMPAN',rawGraded:'Kartu & slab',rawGradedDesc:'Kelola seluruh koleksi di Vault.',playTag:'JUAL',seeFit:'Pasang listing',seeFitDesc:'Pilih kartu langsung dari Vault.'
  }:{title:<>Find your Pokémon.<br/><em>Keep every printing.</em></>,description:'Browse Pokémon cards, releases, and languages across one card catalog.',cards:'Explore cards',arena:'Browse sets',identities:'Card identities',printings:'Printings tracked',languages:'Card languages',leftName:'Card collection',rightName:'Recent cards',pause:'Pause motion',resume:'Resume motion',utilityEyebrow:'THE POKÉMON CARD CATALOG',utilityTitle:<>Find the card.<br/>Keep the right printing.</>,utilityDescription:'Search by name, number, set, language, or illustrator. Save the exact printing you own to your Vault.',explorePrintings:'Browse the catalog',explorePrintingsSub:'Search by name, number, set, or illustrator',buildDeck:'Browse sets',buildDeckSub:'See the cards in each release',trackVault:'Manage your Vault',trackVaultSub:'Keep Pokémon cards and slabs together',featuredEyebrow:'IN THE CATALOG',featuredTitle:'Explore Pokémon cards.',viewAllCards:'View the catalog',marqueeLabel:'Pokémon cards',marketEyebrow:'BUY AND SELL CARDS',marketTitle:<>Find the card.<br/>Choose the right printing.</>,marketDescription:'Browse listings by language, set, and printing. Buy a card or create a listing from your Vault.',browseMarket:'Browse Market',wantedTag:'BUY',completeDeck:'Find a card',completeDeckDesc:'Browse cards currently listed for sale.',collectTag:'KEEP',rawGraded:'Cards & slabs',rawGradedDesc:'Manage your collection in one Vault.',playTag:'SELL',seeFit:'Create a listing',seeFitDesc:'Choose cards directly from your Vault.'};
  const copy=pokemon?pokemonCopy:onePieceCopy;
  function moveHero(event:React.PointerEvent<HTMLElement>){if(motionPaused||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const rect=event.currentTarget.getBoundingClientRect();const x=((event.clientX-rect.left)/rect.width-.5)*10;const y=((event.clientY-rect.top)/rect.height-.5)*10;event.currentTarget.style.setProperty('--hero-x',`${x.toFixed(2)}px`);event.currentTarget.style.setProperty('--hero-y',`${y.toFixed(2)}px`)}
  function resetHero(){heroRef.current?.style.setProperty('--hero-x','0px');heroRef.current?.style.setProperty('--hero-y','0px')}
  const localize=(href:string)=>language==='ID'?`/id${href}`:href;
  const cardHref=(card:Card&{gameSlug?:string})=>pokemon?localize(`/pokemon/cards?${new URLSearchParams({set:card.setCode??'',number:(card.localCardNumber??card.printingCode??card.code).replace(/_p\d+$/i,''),lang:card.language??'EN'})}`):localize(`/cards/${card.code}`);
  const libraryHref=localize(pokemon?'/pokemon/cards':'/cards');
  const setsHref=localize(pokemon?'/pokemon/sets':'/sets');
  const marketHref=localize(pokemon?'/market?game=pokemon':'/market');
  const vaultHref=localize(pokemon?'/vault?game=pokemon':'/vault');
  return <main className={`home-page${pokemon?' is-pokemon':''}`}>
    <section ref={heroRef} className={`home-hero ${motionPaused?'motion-paused':''}`} onPointerMove={moveHero} onPointerLeave={resetHero}>
      {!pokemon&&<picture className="home-hero-map"><source media="(max-width: 700px)" srcSet="/assets/one-piece-header-bg-mobile.webp"/><img src="/assets/one-piece-header-bg.webp" alt="" width="1920" height="1400" fetchPriority="high" decoding="async"/></picture>}
      <div className="hero-printings hero-duel hero-duel-left" aria-label={copy.leftName}>{leaders[2]&&<Link href={cardHref(leaders[2])} className="hero-card hero-card-0"><CardArt card={leaders[2]} imageWidth={360}/><small>{pokemon?leaders[2].name:leaders[2].code}</small></Link>}{leaders[3]&&<Link href={cardHref(leaders[3])} className="hero-card hero-card-2"><CardArt card={leaders[3]} imageWidth={360}/><small>{pokemon?leaders[3].name:leaders[3].code}</small></Link>}{!leaders.length&&<div className="hero-card-skeletons" aria-hidden="true"><i/><i/></div>}<Link href={pokemon?libraryHref:localize('/meta')} className="hero-matchup"><span>{copy.leftName}</span><ArrowUpRight size={17}/></Link></div>
      <div className="home-hero-copy"><h1>{copy.title}</h1><p>{copy.description}</p><div className="hero-actions"><Link className="button" href={libraryHref}><Library size={16}/>{copy.cards}</Link><Link className="text-action" href={pokemon?setsHref:localize('/play')}><CirclePlay size={16}/>{copy.arena}</Link></div><dl className="hero-stats"><div><dt>{copy.identities}</dt><dd>{counts.identities||'…'}</dd></div><div><dt>{copy.printings}</dt><dd>{counts.printings||'…'}</dd></div><div><dt>{copy.languages}</dt><dd>{pokemon?'EN, JP, ID':'EN, JP'}</dd></div></dl></div>
      <div className="hero-printings hero-duel hero-duel-right" aria-label={copy.rightName}>{leaders[0]&&<Link href={cardHref(leaders[0])} className="hero-card hero-card-1"><CardArt card={leaders[0]} imageWidth={360}/><small>{pokemon?leaders[0].name:leaders[0].code}</small></Link>}{leaders[1]&&<Link href={cardHref(leaders[1])} className="hero-card hero-card-3"><CardArt card={leaders[1]} imageWidth={360}/><small>{pokemon?leaders[1].name:leaders[1].code}</small></Link>}{!leaders.length&&<><div className="hero-card-skeletons" aria-hidden="true"><i/><i/></div><span className="sr-only" role="status">Loading cards</span></>}<Link href={pokemon?libraryHref:localize('/meta')} className="hero-matchup"><span>{copy.rightName}</span><ArrowUpRight size={17}/></Link><button type="button" className="hero-motion-toggle" onClick={()=>setMotionPaused(value=>!value)} aria-pressed={motionPaused} aria-label={motionPaused?copy.resume:copy.pause}>{motionPaused?<Play size={14}/>:<Pause size={14}/>}</button></div>
    </section>
    <section className="home-utility home-reveal"><div><p className="eyebrow">{copy.utilityEyebrow}</p><h2>{copy.utilityTitle}</h2><p>{copy.utilityDescription}</p></div><div className="utility-links"><Link href={libraryHref}><Layers3 size={20}/><span><b>{copy.explorePrintings}</b><small>{copy.explorePrintingsSub}</small></span><ArrowUpRight size={16}/></Link><Link href={pokemon?setsHref:localize('/decks/builder')}><Swords size={20}/><span><b>{copy.buildDeck}</b><small>{copy.buildDeckSub}</small></span><ArrowUpRight size={16}/></Link><Link href={vaultHref}><BadgeCheck size={20}/><span><b>{copy.trackVault}</b><small>{copy.trackVaultSub}</small></span><ArrowUpRight size={16}/></Link></div></section>
    <section className="home-featured home-reveal"><div className="section-heading"><div><p className="eyebrow">{copy.featuredEyebrow}</p><h2>{copy.featuredTitle}</h2></div><Link className="text-action" href={libraryHref}>{copy.viewAllCards} <ArrowUpRight size={15}/></Link></div><div className="home-card-marquee" aria-label={copy.marqueeLabel}><div className="home-card-track">{[...cards.slice(0,8),...cards.slice(0,8)].map((card,index)=><Link href={cardHref(card)} key={`${card.id}-${index}`} aria-label={`Open ${card.name}`}><CardArt card={card} imageWidth={360}/></Link>)}</div></div></section>
    {pokemon?<PokemonHomeSets language={language}/>:<SetsExperience compact/>}
    <section className={`home-market home-reveal${pokemon?' home-market-pokemon':''}`}><div className="market-copy"><p className="eyebrow">{copy.marketEyebrow}</p><h2>{copy.marketTitle}</h2><p>{copy.marketDescription}</p><Link className="button" href={marketHref}><ShoppingBag size={16}/>{copy.browseMarket}</Link></div><div className="market-board"><div><small>{copy.wantedTag}</small><b>{copy.completeDeck}</b><span>{copy.completeDeckDesc}</span></div><div><small>{copy.collectTag}</small><b>{copy.rawGraded}</b><span>{copy.rawGradedDesc}</span></div><div><small>{copy.playTag}</small><b>{copy.seeFit}</b><span>{copy.seeFitDesc}</span></div></div></section>
  </main>;
}
