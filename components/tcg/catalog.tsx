'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {ArrowUpRightIcon, MagnifyingGlassIcon as Search, CheckIcon as Check, XIcon as X, CaretDownIcon as ChevronDown, SquaresFourIcon as Grid3X3} from '@phosphor-icons/react';
import {useCatalogTools} from './catalog-tools';
import {colors, type Card} from '@/packages/card-data/catalog';
import {CardArt} from './card-art';
import {displayCardName} from './card-name';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {CardPreviewModal} from './card-preview-modal';
import {isPlayableSet, PREVIEW_CARD_CODES} from '@/packages/domain/release-availability';
import {splitArchetypeTraits} from './library-directory';

type LibraryCard = Card & {setCode:string;setName:string;attribute:string;counter:number;block:string;keywords:string[];traits:string[];variant:string;printingCode:string};
type FilterOption = string | {value:string;label:string};
export type CatalogSetInfo={name?:string;set_kind?:string;release_date?:string|null;description?:string|null;official_url?:string|null;product_image_url?:string|null};

export function normalizeSetCode(code:string){return code.trim().toUpperCase().replace(/[-_\s]/g,'')}

const keywordAliases=new Map([
  ['rush','Rush'],['blocker','Blocker'],['when attacking','When Attacking'],['on play','On Play'],['on k.o.','On K.O.'],
  ["on your opponent's attack","On Your Opponent's Attack"],['activate: main','Activate: Main'],['once per turn','Once Per Turn'],
  ['trigger','Trigger'],['your turn','Your Turn'],["opponent's turn","Opponent's Turn"],['counter','Counter'],['main','Main'],
]);

function cardKeywords(effect:string|undefined|null){
  const keywords=new Set<string>();
  for(const match of (effect??'').matchAll(/\[([^\]]+)\]/g)){
    const raw=match[1].replace(/\s+/g,' ').replace(/\s*:\s*/g,': ').trim();
    const alias=keywordAliases.get(raw.toLowerCase());
    if(alias)keywords.add(alias);
    const don=raw.match(/^DON!!\s*(?:x|×)\s*(\d+)$/i);
    if(don)keywords.add(`DON!! ×${don[1]}`);
  }
  if(/\bblocker\b/i.test(effect??''))keywords.add('Blocker');
  return [...keywords];
}

/** Shared compact select used by the collection, market, and deck tools. */
export function Picker({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:FilterOption[];label:string}) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{options.map(item=>{const option=typeof item==='string'?{value:item,label:item}:item;return <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>})}</SelectContent></Select>;
}

function MultiFilter({label,values,selected,onToggle,searchPlaceholder}:{label:string;values:FilterOption[];selected:string[];onToggle:(value:string)=>void;searchPlaceholder?:string}) {
  const [open,setOpen]=useState(false); const [query,setQuery]=useState(''); const ref=useRef<HTMLDivElement>(null); const colour=label==='Colour'||label==='Warna'; const searchable=label==='Set'||label==='Archetype'||label==='Arketipe';
  const matches=values.filter(item=>{const option=typeof item==='string'?{value:item,label:item}:item;return option.label.toLowerCase().includes(query.toLowerCase())||option.value.toLowerCase().includes(query.toLowerCase())});
  useEffect(()=>{const close=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))setOpen(false)};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape)}},[]);
  return <div ref={ref} className={`filter-menu ${open?'is-open':''} ${selected.length?'has-selection':''} ${colour?'colour-menu':''} ${label==='Set'?'set-menu':''}`}>
    <button type="button" className="filter-trigger" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{label}{selected.length>0&&<b>{selected.length}</b>}<ChevronDown size={14}/></button>
    {open&&<div className="filter-options">{searchable&&<label className="filter-option-search"><Search size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={searchPlaceholder??`Find an ${label.toLowerCase()}`} autoFocus/></label>}{matches.map(item=>{const option=typeof item==='string'?{value:item,label:item}:item;return <button type="button" key={option.value} onClick={()=>onToggle(option.value)} aria-pressed={selected.includes(option.value)}>{!colour&&selected.includes(option.value)&&<Check size={14}/>} {colour&&<i className="filter-colour" style={{background:colors[option.value]}}/>}<span>{option.label}</span></button>})}</div>}
  </div>;
}

function GridDensity({value,onChange,locale='EN'}:{value:string;onChange:(value:string)=>void;locale?:'EN'|'ID'}) {
  const id=locale==='ID';
  const [open,setOpen]=useState(false);const ref=useRef<HTMLDivElement>(null);const choices=['auto','4','5','6','7','8','9'];
  useEffect(()=>{const close=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))setOpen(false)};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape)}},[]);
  const autoLabel=id?'Otomatis':'Auto';
  return <div ref={ref} className={`filter-menu density-menu ${open?'is-open':''}`}><button className="filter-trigger" type="button" aria-label={id?'Kartu per baris':'Cards per row'} aria-expanded={open} onClick={()=>setOpen(current=>!current)}><Grid3X3 size={14}/><span>{value==='auto'?autoLabel:value}</span><ChevronDown size={14}/></button>{open&&<div className="filter-options">{choices.map(choice=><button type="button" key={choice} aria-pressed={value===choice} onClick={()=>{onChange(choice);setOpen(false)}}>{value===choice&&<Check size={14}/>}<span>{choice==='auto'?autoLabel:(id?`${choice} kartu per baris`:`${choice} cards per row`)}</span></button>)}</div>}</div>;
}

function setRank(code:string){
  const normalized=code.toUpperCase(); const match=normalized.match(/^(OP|EB|ST|PRB|P|DON)[-_ ]?0*(\d+)/);
  if(!match)return 0; const series:{[key:string]:number}={OP:600,EB:500,ST:400,PRB:300,P:200,DON:100};
  return (series[match[1]]??0)*1000+Number(match[2]);
}

function cardRailRank(code:string){return [...code].reduce((value,char)=>(value*31+char.charCodeAt(0))|0,7)}

function blockForSet(code:string,payload?:{block?:string|number;block_value?:string|number}|null){
  const direct=payload?.block_value??payload?.block;
  if(direct!==undefined&&direct!==null&&String(direct).trim()) return String(direct).toUpperCase();
  const match=code.toUpperCase().match(/^(OP|EB|ST|PRB)[-_ ]?0*(\d+)/);
  if(!match)return 'X'; const number=Number(match[2]);
  if(match[1]==='OP')return String(Math.min(5,Math.max(1,Math.ceil(number/4))));
  if(match[1]==='EB')return String(Math.min(5,Math.max(1,Math.ceil((number+1)/2)+1)));
  if(match[1]==='ST')return number>=28?'5':number>=20?'4':number>=11?'3':number>=5?'2':'1';
  return number>=2?'5':'4';
}

const sortLabels = {
  EN: {
    'latest-leaders': 'Latest sets · leaders first',
    'leaders-latest': 'Leaders · latest first',
    latest: 'Latest sets',
    name: 'Name A-Z',
  },
  ID: {
    'latest-leaders': 'Set terbaru · Leader pertama',
    'leaders-latest': 'Leader · rilis terbaru',
    latest: 'Set terbaru',
    name: 'Nama A-Z',
  },
} as const;
type SortOrder = 'latest-leaders' | 'leaders-latest' | 'latest' | 'name';

function SortOrderPicker({value,onChange,locale='EN'}:{value:SortOrder;onChange:(value:SortOrder)=>void;locale?:'EN'|'ID'}) {
  const id=locale==='ID';
  const [open,setOpen]=useState(false);const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const close=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))setOpen(false)};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape)}},[]);
  const labels=id?sortLabels.ID:sortLabels.EN;
  return <div ref={ref} className={`filter-menu sort-menu ${open?'is-open':''}`}><button className="filter-trigger" type="button" aria-expanded={open} onClick={()=>setOpen(current=>!current)}><span>{id?'Urutkan':'Sort'}</span><ChevronDown size={14}/></button>{open&&<div className="filter-options">{(Object.entries(labels) as [SortOrder,string][]).map(([option,label])=><button type="button" key={option} aria-pressed={value===option} onClick={()=>{onChange(option);setOpen(false)}}>{value===option&&<Check size={14}/>}<span>{label}</span></button>)}</div>}</div>;
}

function CatalogTile({primary,variants,language,onOpen}:{primary:Card;variants:Card[];language:string;onOpen:(card:Card,origin:DOMRect)=>void}){
  const visible=variants.slice(0,4);
  const cardColours=primary.color.split(/\s*(?:\/|&|,|·)\s*|\s+/).map(colour=>colour.trim()).filter(colour=>Boolean(colors[colour]));
  const identityColours=cardColours.map(colour=>colors[colour]);
  const identityBackground=identityColours.length>1?`linear-gradient(135deg,${identityColours.map((colour,index)=>`${colour} ${(index/identityColours.length)*100}% ${((index+1)/identityColours.length)*100}%`).join(',')})`:identityColours[0]??'#657180';
  return <button type="button" onClick={event=>{const source=event.currentTarget.querySelector('.tcg-card');onOpen(primary,(source??event.currentTarget).getBoundingClientRect())}} style={{'--card-colour':identityColours[0]??'#657180','--card-colour-secondary':identityColours[1]??identityColours[0]??'#657180'} as React.CSSProperties} className={`catalog-card catalog-card-button ${variants.length>1?'has-printing-stack':''}`}>
    <div className="card-stage printing-stack">
      {visible.map((variant,index)=><div className="stacked-printing" style={{'--stack-index':index} as React.CSSProperties} key={variant.id}><CardArt card={variant}/></div>)}
    </div>
    <div className="card-meta"><span>{primary.code} · {language}</span><span className={`rarity rarity-${primary.rarity}`}>{primary.rarity}</span></div>
    <div className="card-title"><i className="filter-colour identity-colour" title={primary.color || undefined} aria-label={primary.color ? `${primary.color} color` : undefined} style={{background:identityBackground}}/><h3>{primary.name}</h3><span className="card-bottom" aria-label={`${primary.color} ${primary.type}`}>{primary.type}</span></div>
  </button>
}

function printingPriority(card:LibraryCard) {
  const variant=card.variant.toLowerCase();
  if (variant==='standard'||variant==='base'||!variant) return 0;
  if (/parallel|alternate|alt art|_p\d+/i.test(variant)) return 2;
  return 1;
}

export function Catalog({home=false,initialSet,initialArchetype,setPage=false,setInfo}:{home?:boolean;initialSet?:string;initialArchetype?:string;setPage?:boolean;setInfo?:CatalogSetInfo}) {
  const [query,setQuery] = useState('');
  const [color,setColor] = useState('All colors');
  const [types,setTypes] = useState<string[]>([]);
  const [selectedColors,setSelectedColors] = useState<string[]>([]);
  const [rarities,setRarities] = useState<string[]>([]);
  const [language,setLanguage] = useState('EN');
  const [locale,setLocale] = useState<'EN'|'ID'>('EN');
  const [gridColumns,setGridColumns] = useState('5');
  const [sortOrder,setSortOrder] = useState<SortOrder>('leaders-latest');
  const [preview,setPreview] = useState<Card>();
  const [previewOrigin,setPreviewOrigin] = useState<DOMRect>();
  const [liveCards,setLiveCards] = useState<LibraryCard[]>([]);
  const [catalogPage,setCatalogPage] = useState(0);
  const [catalogLoading,setCatalogLoading] = useState(true);

  useEffect(()=>{
    const syncLocale=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail);
    syncLocale();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);
  const id=locale==='ID';

  useEffect(()=>{
    let active=true; const controller=new AbortController();
    function toCards(rows:Record<string,unknown>[]){
      return Array.from(new Map(rows.map(row=>[String(row.id),row])).values()).map((row,index)=>{
        const identity=row.tcg_card_identities as {id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string};
        const keywords=cardKeywords(identity.effect_text);
        const payload=row.source_payload as {block?:string|number;block_value?:string|number}|null;
        const assets=(row.tcg_card_assets??[]) as Array<{kind:string;object_key:string}>;
        return {id:String(row.id),code:identity.code,name:displayCardName(identity.name,identity.code),color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:String(row.rarity??''),art:index%6,effect:identity.effect_text,imageUrl:String(row.card_image_url||'')||undefined,imageSource:'external' as const,setCode:String(row.set_code??''),setName:String(row.set_name??row.set_code??''),language:String(row.language??''),attribute:String(row.attribute??''),counter:Number(row.counter_amount??0),block:blockForSet(String(row.set_code??''),payload),keywords,traits:splitArchetypeTraits(row.sub_types as string[]|string|null),variant:String(row.variant??''),printingCode:String(row.printing_code??identity.code),assetPath:assets.find(asset=>asset.kind==='small')?.object_key};
      });
    }
    async function loadCatalog(){
      setCatalogLoading(true);setCatalogPage(0);setLiveCards([]);const rows:Record<string,unknown>[]=[];
      const response=await fetch(`/api/cards/catalog?language=${encodeURIComponent(language)}`,{signal:controller.signal});
      if(!response.ok)throw new Error('Catalog is unavailable.');
      const payload=await response.json() as {cards?:Record<string,unknown>[]};
      rows.push(...(payload.cards??[]));
      if(active){
        const mapped=toCards(rows).filter(card=>isPlayableSet(card.setCode) || PREVIEW_CARD_CODES.has(card.code.toUpperCase()));
        mapped.sort((a,b)=>setRank(b.setCode)-setRank(a.setCode)||(a.type==='Leader'?0:1)-(b.type==='Leader'?0:1)||a.code.localeCompare(b.code));
        setLiveCards(mapped);
        setCatalogLoading(false);
      }
    }
    loadCatalog().catch(()=>{if(active)setCatalogLoading(false)});return()=>{active=false;controller.abort()};
  },[language]);
  useCatalogTools(setQuery,setColor,value=>setTypes(value==='All types'?[]:[value]));
  const [attributes,setAttributes] = useState<string[]>([]); const [counters,setCounters] = useState<string[]>([]); const [keywords,setKeywords] = useState<string[]>([]); const [traits,setTraits] = useState<string[]>(initialArchetype?[initialArchetype]:[]); const [sets,setSets] = useState<string[]>(initialSet?[normalizeSetCode(initialSet)]:[]);
  const [blocks,setBlocks] = useState<string[]>([]);
  const filtered = [...liveCards].sort((a,b)=>{
    const latestSet=setRank(b.setCode)-setRank(a.setCode);
    const leaderFirst=(a.type==='Leader'?0:1)-(b.type==='Leader'?0:1);
    if(sortOrder==='name') return a.name.localeCompare(b.name)||a.code.localeCompare(b.code);
    if(sortOrder==='leaders-latest') return leaderFirst||latestSet||a.code.localeCompare(b.code);
    if(sortOrder==='latest') return latestSet||a.code.localeCompare(b.code);
    return latestSet||leaderFirst||a.code.localeCompare(b.code);
  }).filter(card => (card.name + card.code).toLowerCase().includes(query.toLowerCase()) && (!selectedColors.length || selectedColors.some(value=>card.color.includes(value))) && (!types.length || types.includes(card.type)) && (!rarities.length || rarities.includes(card.rarity)) && (!attributes.length || attributes.includes(card.attribute)) && (!counters.length || counters.includes(card.counter>0?`+${card.counter}`:(id?'Tanpa counter':'No counter'))) && (!keywords.length || keywords.some(value=>card.keywords.includes(value))) && (!traits.length || traits.some(value=>card.traits.includes(value))) && (!sets.length || sets.some(value=>normalizeSetCode(value)===normalizeSetCode(card.setCode))) && (!blocks.length || blocks.includes(card.block)));
  const groups = Array.from(filtered.reduce((map,card)=>{const group=map.get(card.code)??[];group.push(card);map.set(card.code,group);return map},new Map<string,LibraryCard[]>()).values()).map(group=>[...new Map(group.sort((a,b)=>printingPriority(a)-printingPriority(b)||a.printingCode.localeCompare(b.printingCode)).map(card=>[card.printingCode,card])).values()]);
  const headerCards=useMemo(()=>{const scoped=setPage&&initialSet?liveCards.filter(card=>normalizeSetCode(card.setCode)===normalizeSetCode(initialSet)):liveCards;const unique=Array.from(new Map(scoped.map(card=>[card.code,card])).values());return [...unique].sort((a,b)=>cardRailRank(a.code)-cardRailRank(b.code)).slice(0,6)},[liveCards,setPage,initialSet]);

  const typeOptions:FilterOption[] = [
    'Leader',
    {value:'Character',label:id?'Karakter':'Character'},
    'Event',
    'Stage',
    'DON!!'
  ];

  return <main className="page catalog-page">
    <section className="library-intro">
      <div className="library-intro-copy">
        {setPage&&<Link className="set-library-back" href="/sets">{id?'Semua set':'All sets'}</Link>}
        <p className="kicker">{setPage?(id?'ARSIP SET':'SET ARCHIVE'):(id?'KATALOG KARTU':'CARD LIBRARY')}</p>
        <h1>{setPage?(setInfo?.name??initialSet??''):(home ? (id?'Temukan kartu berikutnya.':'Find your next card.') : (id?'Temukan kartu, set, dan karya seni resminya.':'Find cards, sets, and exact art.'))}</h1>
        <p>{setPage?(setInfo?.description??(id?`Jelajahi kartu dan versi cetak dari ${initialSet}.`:`Browse the cards and printings from ${initialSet}.`)):(id?'Cari berdasarkan nama atau nomor kartu, bandingkan bahasa, dan susun deck dengan data live terkini.':'Search by name or number, compare languages, and build with the live card pool.')}</p>
        {setPage&&<div className="set-library-meta"><span>{initialSet}{setInfo?.set_kind&&<> · {setInfo.set_kind}</>}</span>{setInfo?.release_date&&<span>{new Intl.DateTimeFormat(id?'id-ID':'en',{year:'numeric',month:'long',day:'numeric'}).format(new Date(`${setInfo.release_date}T00:00:00`))}</span>}{setInfo?.official_url&&<a href={setInfo.official_url} target="_blank" rel="noreferrer">{id?'Halaman resmi set':'Official set page'} <ArrowUpRightIcon aria-hidden="true" size={14}/></a>}<span>{groups.length} {id?'kartu':'cards'}</span></div>}
      </div>
      <div className="library-intro-rail library-intro-random-rail" aria-hidden="true"><div className="library-intro-rail-cards">{headerCards.map((card,index)=><div className={`library-intro-rail-card rail-card-${index}`} key={card.id}><CardArt card={card}/></div>)}{!headerCards.length&&Array.from({length:6},(_,index)=><i className={`library-intro-rail-skeleton rail-card-${index}`} key={index}/>)}</div></div>
    </section>
    <section className="library-controls" aria-label={id?'Kontrol katalog kartu':'Card library controls'}>
      <div className="filter-workbench">
        <label className="search-box">
          <Search size={16}/>
          <input placeholder={id?'Cari nama atau nomor kartu':'Search name or card number'} value={query} onChange={e=>setQuery(e.target.value)}/>
          {query&&<button type="button" className="search-clear" onClick={()=>setQuery('')} aria-label={id?'Hapus pencarian':'Clear search'}><X size={12}/></button>}
        </label>
        <div className="filter-primary">
          <MultiFilter label={id?'Tipe':'Type'} values={typeOptions} selected={types} onToggle={value=>setTypes(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <MultiFilter label={id?'Warna':'Colour'} values={Object.keys(colors)} selected={selectedColors} onToggle={value=>setSelectedColors(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <MultiFilter label={id?'Arketipe':'Archetype'} searchPlaceholder={id?'Cari arketipe':'Find an archetype'} values={[...new Set(liveCards.flatMap(card=>card.traits))].sort()} selected={traits} onToggle={value=>setTraits(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <MultiFilter label={id?'Atribut':'Attribute'} values={[...new Set(liveCards.map(card=>card.attribute).filter(Boolean))].sort()} selected={attributes} onToggle={value=>setAttributes(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <MultiFilter label={id?'Kelangkaan':'Rarity'} values={[...new Set(liveCards.map(card=>card.rarity).filter(Boolean))].sort()} selected={rarities} onToggle={value=>setRarities(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <span className="filter-row-break" aria-hidden="true"/>
          <MultiFilter label="Counter" values={[...new Set(liveCards.map(card=>card.counter>0?`+${card.counter}`:(id?'Tanpa counter':'No counter')))].sort()} selected={counters} onToggle={value=>setCounters(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <MultiFilter label={id?'Kata Kunci':'Keyword'} values={[...new Set(liveCards.flatMap(card=>card.keywords))].sort()} selected={keywords} onToggle={value=>setKeywords(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <MultiFilter label={id?'Blok':'Block'} values={['1','2','3','4','5','X']} selected={blocks} onToggle={value=>setBlocks(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          {!setPage&&<MultiFilter label="Set" searchPlaceholder={id?'Cari set':'Find a set'} values={[...new Map(liveCards.map(card=>[card.setCode,{value:card.setCode,label:`${card.setCode} · ${card.setName}`}])).values()]} selected={sets} onToggle={value=>setSets(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>}
        </div>
        <div className="filter-secondary">
          <SortOrderPicker value={sortOrder} onChange={setSortOrder} locale={locale}/>
          <GridDensity value={gridColumns} onChange={setGridColumns} locale={locale}/>
          <div className="language-switch" aria-label="Printing language"><button aria-pressed={language==='EN'} onClick={()=>{setLanguage('EN');setCatalogPage(0);setCatalogLoading(true)}}>EN</button><button aria-pressed={language==='JP'} onClick={()=>{setLanguage('JP');setCatalogPage(0);setCatalogLoading(true)}}>JP</button></div>
          {(selectedColors.length||types.length||rarities.length||attributes.length||counters.length||keywords.length||traits.length||blocks.length||(!setPage&&sets.length)||query)&&<div className="filter-status"><button onClick={()=>{setQuery('');setColor('All colors');setSelectedColors([]);setTypes([]);setRarities([]);setAttributes([]);setCounters([]);setKeywords([]);setTraits([]);setBlocks([]);setSets(setPage&&initialSet?[normalizeSetCode(initialSet)]:[])}}><X size={13}/>{id?'Hapus':'Clear'}</button></div>}
        </div>
      </div>
    </section>
    <div className="card-grid" style={{'--catalog-grid-mode':gridColumns==='auto'?'auto-fit':gridColumns} as React.CSSProperties}>
      {groups.slice(0,(catalogPage+1)*240).map(variants=><CatalogTile key={variants[0].id} primary={variants[0]} variants={variants} language={language} onOpen={(card,origin)=>{setPreviewOrigin(origin);setPreview(card)}}/>)}
    </div>
    {catalogLoading&&<div className="catalog-loading" role="status"><div className="catalog-skeleton-grid">{Array.from({length:10},(_,index)=><i key={index}/>)}</div><span className="sr-only">{id?'Memuat versi cetak kartu':'Loading card printings'}</span></div>}{!filtered.length&&!catalogLoading && <div className="empty-state"><h2>{setPage?(id?'Tidak ada kartu dalam set ini yang cocok.':'No cards in this set match those filters.'):(id?'Tidak ada kartu yang cocok dengan pencarian.':'No card matches that search.')}</h2><p>{id?'Coba masukkan nomor kartu, nama yang lebih singkat, atau atur ulang filter.':'Try the card number, a shorter name, or reset the filters.'}</p><button className="button secondary" onClick={()=>{setQuery('');setColor('All colors');setSelectedColors([]);setTypes([]);setRarities([]);setAttributes([]);setCounters([]);setKeywords([]);setTraits([]);setBlocks([]);setSets(setPage&&initialSet?[normalizeSetCode(initialSet)]:[])}}>{id?'Atur ulang filter katalog':'Reset library filters'}</button></div>}
    {!catalogLoading&&groups.length>(catalogPage+1)*240&&<button className="button secondary browse-all" onClick={()=>setCatalogPage(page=>page+1)}>{id?'Muat lebih banyak kartu':'Load more catalog cards'}</button>}
    {preview&&<CardPreviewModal card={preview} origin={previewOrigin} language={language as 'EN'|'JP'} cards={groups.map(group=>group[0])} onClose={()=>{setPreview(undefined);setPreviewOrigin(undefined)}} onNavigate={setPreview}/>} 
  </main>;
}
