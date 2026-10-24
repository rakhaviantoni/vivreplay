'use client';

import LocalizedAnchor from '@/components/ui/localized-link';
import {useRouteLocale} from '@/components/locale-provider';
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import Link from '@/components/ui/localized-link';
import {ArrowUpRightIcon, MagnifyingGlassIcon as Search, CheckIcon as Check, XIcon as X, CaretDownIcon as ChevronDown, SquaresFourIcon as Grid3X3, SlidersHorizontalIcon as SlidersHorizontal} from '@phosphor-icons/react';
import {useCatalogTools} from './catalog-tools';
import {colors, type Card} from '@/packages/card-data/catalog';
import {CardArt} from './card-art';
import {displayCardName} from './card-name';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {CardPreviewModal} from './card-preview-modal';
import {isPlayableSet, PREVIEW_CARD_CODES} from '@/packages/domain/release-availability';
import {splitArchetypeTraits} from './library-directory';
import {versionedCardCatalogUrl} from '@/lib/card-catalog-cache';
import {cardMatchesSearch,parseCardSearch} from '@/lib/card-search';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {CardScanButton} from './card-scan-button';

type LibraryCard = Card & {setCode:string;setName:string;attribute:string;counter:number;block:string;keywords:string[];traits:string[];variant:string;printingCode:string};
type FilterOption = string | {value:string;label:string;image?:string;group?:string};
export type CatalogSetInfo={name?:string;set_kind?:string;release_date?:string|null;description?:string|null;official_url?:string|null;product_image_url?:string|null};

export function normalizeSetCode(code:string){return code.trim().toUpperCase().replace(/[-_\s]/g,'')}

function canonicalSetCode(code:string){
  const normalized=normalizeSetCode(code);
  return normalized==='OP15'?'OP15-EB04':code.trim().toUpperCase();
}

function canonicalSetName(code:string,name:string){
  return normalizeSetCode(code)==='OP15'?'Adventure on Kami\'s Island':name;
}

function cardBelongsToSet(card:Pick<LibraryCard,'setCode'|'code'>,selectedSet:string){
  const selected=normalizeSetCode(canonicalSetCode(selectedSet));
  const cardSet=normalizeSetCode(canonicalSetCode(card.setCode));
  return Boolean(selected)&&(cardSet===selected||(selected==='OP15EB04'&&normalizeSetCode(card.code).startsWith('OP15')));
}

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
export function Picker({value,onChange,options,label,leadingIcon,filterStyle=false,searchPlaceholder='Search…',emptyLabel='No matches'}:{value:string;onChange:(v:string)=>void;options:FilterOption[];label:string;leadingIcon?:ReactNode;filterStyle?:boolean;searchPlaceholder?:string;emptyLabel?:string}) {
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const selectedOption=options.map(item=>typeof item==='string'?{value:item,label:item}:item).find(item=>item.value===value);
  if(filterStyle){
    const filtered=options.map(item=>typeof item==='string'?{value:item,label:item}:item).filter(item=>item.label.toLowerCase().includes(query.trim().toLowerCase()));
    return <Popover open={open} onOpenChange={next=>{setOpen(next);if(!next)setQuery('')}}>
      <PopoverTrigger asChild><button type="button" aria-label={label} aria-expanded={open} className={[leadingIcon?'picker-trigger-with-icon':'','vault-filter-picker-trigger'].filter(Boolean).join(' ')}>{leadingIcon&&<span className="picker-leading-icon" aria-hidden="true">{leadingIcon}</span>}<span className="vault-filter-picker-value">{selectedOption?.label??value}</span><ChevronDown size={14}/></button></PopoverTrigger>
      <PopoverContent align="start" sideOffset={5} collisionPadding={10} className="vault-filter-picker-content">
        <label className="vault-filter-picker-search"><Search size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={`${searchPlaceholder} ${label.toLowerCase()}`} autoFocus/></label>
        <div className="vault-filter-picker-options" role="listbox" aria-label={label}>{filtered.map(option=><button type="button" role="option" aria-selected={option.value===value} key={option.value} onClick={()=>{onChange(option.value);setOpen(false);setQuery('')}}>{option.label}{option.value===value&&<Check size={14}/>}</button>)}{filtered.length===0&&<p className="vault-filter-picker-empty">{emptyLabel}</p>}</div>
      </PopoverContent>
    </Popover>;
  }
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className={[leadingIcon?'picker-trigger-with-icon':''].filter(Boolean).join(' ')}>{leadingIcon&&<span className="picker-leading-icon" aria-hidden="true">{leadingIcon}</span>}<SelectValue/></SelectTrigger><SelectContent>{options.map(item=>{const option=typeof item==='string'?{value:item,label:item}:item;return <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>})}</SelectContent></Select>;
}

export function MultiFilter({label,values,selected,onToggle,searchPlaceholder,portal=false,portalClassName}:{label:string;values:FilterOption[];selected:string[];onToggle:(value:string)=>void;searchPlaceholder?:string;portal?:boolean;portalClassName?:string}) {
  const [open,setOpen]=useState(false); const [query,setQuery]=useState(''); const ref=useRef<HTMLDivElement>(null); const colour=label==='Colour'||label==='Warna'; const searchable=['Set','Language','Bahasa','Source','Grader','Rarity','Kelangkaan','Filter by rarity','Filter berdasarkan kelangkaan','Filter by grading provider','Filter berdasarkan grading','Archetype','Arketipe','Illustrator','Ilustrator','Type','Tipe','Stage','Tahap','Attack energy','Energi serangan','Weakness','Kelemahan','Resistance','Resistansi'].includes(label);
  const matches=values.filter(item=>{const option=typeof item==='string'?{value:item,label:item}:item;return option.label.toLowerCase().includes(query.toLowerCase())||option.value.toLowerCase().includes(query.toLowerCase())});
  const hasGroups=values.some(item=>typeof item!=='string'&&Boolean(item.group));
  const matchGroups=new Map<string,FilterOption[]>();matches.forEach(item=>{const option=typeof item==='string'?{value:item,label:item}:item;const group=option.group??'';matchGroups.set(group,[...(matchGroups.get(group)??[]),item])});
  const renderOption=(item:FilterOption)=>{const option=typeof item==='string'?{value:item,label:item}:item;return <button type="button" key={option.value} onClick={()=>onToggle(option.value)} aria-pressed={selected.includes(option.value)}>{option.image&&<img className="filter-option-image" src={option.image} alt="" loading="lazy" onError={event=>{event.currentTarget.hidden=true}}/>}{!colour&&selected.includes(option.value)&&<Check size={14}/>} {colour&&<i className="filter-colour" style={{background:colors[option.value]}}/>}<span>{option.label}</span></button>};
  useEffect(()=>{if(portal)return;const close=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))setOpen(false)};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape)}},[portal]);
  const options=<>{searchable&&<label className="filter-option-search"><Search size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={searchPlaceholder??`Find an ${label.toLowerCase()}`} autoFocus/></label>}{hasGroups?[...matchGroups].map(([group,items])=><div className="filter-option-group" key={group||'ungrouped'}>{group&&<strong>{group}</strong>}{items.map(renderOption)}</div>):matches.map(renderOption)}</>;
  const trigger=<button type="button" className="filter-trigger" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{label}{selected.length>0&&<b>{selected.length}</b>}<ChevronDown size={14}/></button>;
  return <div ref={ref} className={`filter-menu ${open?'is-open':''} ${selected.length?'has-selection':''} ${colour?'colour-menu':''} ${label==='Set'?'set-menu':''}`}>
    {portal?<Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>{trigger}</PopoverTrigger><PopoverContent align="start" sideOffset={5} collisionPadding={12} className={`filter-options market-filter-popover${colour?' colour-menu':''}${label==='Set'?' set-menu':''}${portalClassName?` ${portalClassName}`:''}`}>{options}</PopoverContent></Popover>:<>{trigger}{open&&<div className="filter-options">{options}</div>}</>}
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
    <div className="card-meta"><span>{primary.code} · {primary.language??language}</span><span className={`rarity rarity-${primary.rarity}`}>{primary.rarity}</span></div>
    <div className="card-title"><i className="filter-colour identity-colour" title={primary.color || undefined} aria-label={primary.color ? `${primary.color} color` : undefined} style={{background:identityBackground}}/><h3>{primary.name}</h3><span className="card-bottom" aria-label={`${primary.color} ${primary.type}`}>{primary.type}</span></div>
  </button>
}

function printingPriority(card:LibraryCard) {
  const variant=card.variant.toLowerCase();
  if (variant==='standard'||variant==='base'||!variant) return 0;
  if (/parallel|alternate|alt art|_p\d+/i.test(variant)) return 2;
  return 1;
}

export function Catalog({home=false,initialSet,initialArchetype,initialCard,initialPrinting,initialLanguage,setPage=false,setInfo}:{home?:boolean;initialSet?:string;initialArchetype?:string;initialCard?:string;initialPrinting?:string;initialLanguage?:string;setPage?:boolean;setInfo?:CatalogSetInfo}) {
  const [query,setQuery] = useState('');
  const [color,setColor] = useState('All colors');
  const [types,setTypes] = useState<string[]>([]);
  const [selectedColors,setSelectedColors] = useState<string[]>([]);
  const [rarities,setRarities] = useState<string[]>([]);
  const requestedLanguage=initialLanguage?.toUpperCase();
  const hasExplicitLanguage=Boolean(requestedLanguage);
  const [language,setLanguage] = useState(requestedLanguage==='JP'?'JP':requestedLanguage==='EN'?'EN':requestedLanguage?'ALL':'EN');
  const [languageReady,setLanguageReady]=useState(hasExplicitLanguage);
  const [locale,setLocale] = useState<'EN'|'ID'>(useRouteLocale());
  const [gridColumns,setGridColumns] = useState('5');
  const [sortOrder,setSortOrder] = useState<SortOrder>('leaders-latest');
  const [mobileFiltersOpen,setMobileFiltersOpen] = useState(false);
  const [preview,setPreview] = useState<Card>();
  const [previewOrigin,setPreviewOrigin] = useState<DOMRect>();
  const openedCardQuery = useRef('');
  const [liveCards,setLiveCards] = useState<LibraryCard[]>([]);
  const [catalogPage,setCatalogPage] = useState(0);
  const [catalogLoading,setCatalogLoading] = useState(true);

  useEffect(()=>{
    const syncLocale=()=>{
      const preferred=window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN';
      setLocale(preferred);
      if(!hasExplicitLanguage)setLanguage(preferred==='ID'?'ALL':'EN');
      setLanguageReady(true);
    };
    const onLocale=(event:Event)=>{
      const preferred=(event as CustomEvent<'EN'|'ID'>).detail;
      setLocale(preferred);
      if(!hasExplicitLanguage)setLanguage(preferred==='ID'?'ALL':'EN');
    };
    syncLocale();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[hasExplicitLanguage]);
  const id=locale==='ID';

  useEffect(()=>{
    if(!languageReady)return;
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
      const response=await fetch(versionedCardCatalogUrl(`/api/cards/catalog?language=${encodeURIComponent(language)}`),{signal:controller.signal});
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
  },[language,languageReady]);
  useEffect(()=>{
    if(catalogLoading||(!initialCard&&!initialPrinting))return;
    const queryKey=`${initialCard??''}:${initialPrinting??''}:${language}`;
    if(openedCardQuery.current===queryKey)return;
    openedCardQuery.current=queryKey;
    const match=liveCards.find(card=>(initialPrinting&&card.id===initialPrinting)||(initialCard&&card.code.toUpperCase()===initialCard.toUpperCase()));
    if(match){setPreviewOrigin(undefined);setPreview(match);return;}
    const controller=new AbortController();
    const params=new URLSearchParams({language});
    if(initialPrinting)params.set('ids',initialPrinting);
    else if(initialCard)params.set('code',initialCard);
    void fetch(versionedCardCatalogUrl(`/api/cards/catalog?${params}`),{signal:controller.signal})
      .then(async response=>response.ok?response.json() as Promise<{cards?:Record<string,unknown>[]} >:{cards:[]})
      .then(payload=>{
        const row=payload.cards?.[0];
        const identity=row?.tcg_card_identities as {code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string}|undefined;
        if(!row||!identity||controller.signal.aborted)return;
        const setCode=String(row.set_code??'');
        const assets=(row.tcg_card_assets??[]) as Array<{kind:string;object_key:string}>;
        const fallback:LibraryCard={id:String(row.id),code:identity.code,name:displayCardName(identity.name,identity.code),color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:String(row.rarity??''),art:0,effect:identity.effect_text,imageUrl:String(row.card_image_url||'')||undefined,imageSource:'external',setCode,setName:String(row.set_name??setCode),language:String(row.language??language),attribute:String(row.attribute??''),counter:Number(row.counter_amount??0),block:blockForSet(setCode,row.source_payload as {block?:string|number;block_value?:string|number}|null),keywords:cardKeywords(identity.effect_text),traits:splitArchetypeTraits(row.sub_types as string[]|string|null),variant:String(row.variant??''),printingCode:String(row.printing_code??identity.code),assetPath:assets.find(asset=>asset.kind==='small')?.object_key};
        setPreviewOrigin(undefined);
        setPreview(fallback);
      })
      .catch(()=>{});
    return()=>controller.abort();
  },[catalogLoading,initialCard,initialPrinting,language,liveCards]);
  useCatalogTools(setQuery,setColor,value=>setTypes(value==='All types'?[]:[value]));
  const [attributes,setAttributes] = useState<string[]>([]); const [counters,setCounters] = useState<string[]>([]); const [keywords,setKeywords] = useState<string[]>([]); const [traits,setTraits] = useState<string[]>(initialArchetype?[initialArchetype]:[]); const [sets,setSets] = useState<string[]>(initialSet?[normalizeSetCode(initialSet)]:[]);
  const [blocks,setBlocks] = useState<string[]>([]);
  const cardSearch=useMemo(()=>parseCardSearch(query),[query]);
  const filtered = [...liveCards].sort((a,b)=>{
    const latestSet=setRank(b.setCode)-setRank(a.setCode);
    const leaderFirst=(a.type==='Leader'?0:1)-(b.type==='Leader'?0:1);
    if(sortOrder==='name') return a.name.localeCompare(b.name)||a.code.localeCompare(b.code);
    if(sortOrder==='leaders-latest') return leaderFirst||latestSet||a.code.localeCompare(b.code);
    if(sortOrder==='latest') return latestSet||a.code.localeCompare(b.code);
    return latestSet||leaderFirst||a.code.localeCompare(b.code);
  }).filter(card => cardMatchesSearch(card,cardSearch) && (!selectedColors.length || selectedColors.some(value=>card.color.includes(value))) && (!types.length || types.includes(card.type)) && (!rarities.length || rarities.includes(card.rarity)) && (!attributes.length || attributes.includes(card.attribute)) && (!counters.length || counters.includes(card.counter>0?`+${card.counter}`:(id?'Tanpa counter':'No counter'))) && (!keywords.length || keywords.some(value=>card.keywords.includes(value))) && (!traits.length || traits.some(value=>card.traits.includes(value))) && (!sets.length || sets.some(value=>cardBelongsToSet(card,value))) && (!blocks.length || blocks.includes(card.block)));
  const groups = Array.from(filtered.reduce((map,card)=>{const group=map.get(card.code)??[];group.push(card);map.set(card.code,group);return map},new Map<string,LibraryCard[]>()).values()).map(group=>[...new Map(group.sort((a,b)=>printingPriority(a)-printingPriority(b)||a.printingCode.localeCompare(b.printingCode)).map(card=>[card.printingCode,card])).values()]);
  const headerCards=useMemo(()=>{const scoped=setPage&&initialSet?liveCards.filter(card=>cardBelongsToSet(card,initialSet)):liveCards;const unique=Array.from(new Map(scoped.map(card=>[card.code,card])).values());return [...unique].sort((a,b)=>cardRailRank(a.code)-cardRailRank(b.code)).slice(0,6)},[liveCards,setPage,initialSet]);
  const activeFilterCount=types.length+selectedColors.length+rarities.length+attributes.length+counters.length+keywords.length+traits.length+blocks.length+(!setPage?sets.length:0)+(color!=='All colors'?1:0);

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
        {setPage&&<div className="set-library-meta"><span>{initialSet}{setInfo?.set_kind&&<> · {setInfo.set_kind}</>}</span>{setInfo?.release_date&&<span>{new Intl.DateTimeFormat(id?'id-ID':'en',{year:'numeric',month:'long',day:'numeric'}).format(new Date(`${setInfo.release_date}T00:00:00`))}</span>}{setInfo?.official_url&&<LocalizedAnchor href={setInfo.official_url} target="_blank" rel="noreferrer">{id?'Halaman resmi set':'Official set page'} <ArrowUpRightIcon aria-hidden="true" size={14}/></LocalizedAnchor>}<span>{groups.length} {id?'kartu':'cards'}</span></div>}
      </div>
      <div className="library-intro-rail library-intro-random-rail library-intro-browse-rail"><div className="library-intro-rail-cards" aria-hidden="true">{headerCards.map((card,index)=><div className={`library-intro-rail-card rail-card-${index}`} key={card.id}><CardArt card={card}/></div>)}{!headerCards.length&&Array.from({length:6},(_,index)=><i className={`library-intro-rail-skeleton rail-card-${index}`} key={index}/>)}</div>{!setPage&&<Link className="library-intro-browse" href="/sets">{id?'Jelajahi set':'Browse sets'} <ArrowUpRightIcon size={15}/></Link>}</div>
    </section>
    <section className={`library-controls${mobileFiltersOpen?' mobile-filters-open':''}`} aria-label={id?'Kontrol katalog kartu':'Card library controls'}>
      <div className="filter-workbench">
        <label className="search-box">
          <Search size={16}/>
          <input placeholder={id?'Nama, kode, set, warna, tipe, biaya…':'Name, code, set, color, type, cost…'} value={query} onChange={e=>setQuery(e.target.value)}/>
          <CardScanButton game="one-piece" locale={locale}/>
          {query&&<button type="button" className="search-clear" onClick={()=>setQuery('')} aria-label={id?'Hapus pencarian':'Clear search'}><X size={12}/></button>}
        </label>
        <button type="button" className={`library-mobile-filter-toggle${mobileFiltersOpen?' is-open':''}`} aria-expanded={mobileFiltersOpen} aria-controls="opcg-library-facets" onClick={()=>setMobileFiltersOpen(value=>!value)}><SlidersHorizontal size={15}/><span>{id?'Filter':'Filters'}</span>{activeFilterCount>0&&<b>{activeFilterCount}</b>}<ChevronDown size={14}/></button>
        <div className="filter-primary" id="opcg-library-facets">
          <MultiFilter label={id?'Tipe':'Type'} values={typeOptions} selected={types} onToggle={value=>setTypes(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <MultiFilter label={id?'Warna':'Colour'} values={Object.keys(colors)} selected={selectedColors} onToggle={value=>setSelectedColors(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <MultiFilter label={id?'Arketipe':'Archetype'} searchPlaceholder={id?'Cari arketipe':'Find an archetype'} values={[...new Set(liveCards.flatMap(card=>card.traits))].sort()} selected={traits} onToggle={value=>setTraits(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <MultiFilter label={id?'Atribut':'Attribute'} values={[...new Set(liveCards.map(card=>card.attribute).filter(Boolean))].sort()} selected={attributes} onToggle={value=>setAttributes(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <MultiFilter label={id?'Kelangkaan':'Rarity'} values={[...new Set(liveCards.map(card=>card.rarity).filter(Boolean))].sort()} selected={rarities} onToggle={value=>setRarities(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <span className="filter-row-break" aria-hidden="true"/>
          <MultiFilter label="Counter" values={[...new Set(liveCards.map(card=>card.counter>0?`+${card.counter}`:(id?'Tanpa counter':'No counter')))].sort()} selected={counters} onToggle={value=>setCounters(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <MultiFilter label={id?'Kata Kunci':'Keyword'} values={[...new Set(liveCards.flatMap(card=>card.keywords))].sort()} selected={keywords} onToggle={value=>setKeywords(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          <MultiFilter label={id?'Blok':'Block'} values={['1','2','3','4','5','X']} selected={blocks} onToggle={value=>setBlocks(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/>
          {!setPage&&<MultiFilter label={id?'Set':'Set'} searchPlaceholder={id?'Cari set':'Find a set'} values={[...new Map(liveCards.map(card=>{const code=canonicalSetCode(card.setCode);return [code,{value:code,label:`${code} · ${canonicalSetName(card.setCode,card.setName)}`}] as const})).values()]} selected={sets.map(canonicalSetCode)} onToggle={value=>setSets(current=>{const canonical=canonicalSetCode(value);return current.some(item=>canonicalSetCode(item)===canonical)?current.filter(item=>canonicalSetCode(item)!==canonical):[...current,canonical]})}/>}
        </div>
        <div className="filter-secondary">
          <SortOrderPicker value={sortOrder} onChange={setSortOrder} locale={locale}/>
          <GridDensity value={gridColumns} onChange={setGridColumns} locale={locale}/>
          <div className="language-switch" aria-label="Printing language"><button aria-pressed={language==='EN'} onClick={()=>{setLanguage('EN');setCatalogPage(0);setCatalogLoading(true)}}>EN</button><button aria-pressed={language==='JP'} onClick={()=>{setLanguage('JP');setCatalogPage(0);setCatalogLoading(true)}}>JP</button><button aria-pressed={language==='ALL'} onClick={()=>{setLanguage('ALL');setCatalogPage(0);setCatalogLoading(true)}}>{id?'Semua':'All'}</button></div>
          {(selectedColors.length||types.length||rarities.length||attributes.length||counters.length||keywords.length||traits.length||blocks.length||(!setPage&&sets.length)||query)&&<div className="filter-status"><button onClick={()=>{setQuery('');setColor('All colors');setSelectedColors([]);setTypes([]);setRarities([]);setAttributes([]);setCounters([]);setKeywords([]);setTraits([]);setBlocks([]);setSets(setPage&&initialSet?[normalizeSetCode(initialSet)]:[])}}><X size={13}/>{id?'Hapus':'Clear'}</button></div>}
        </div>
      </div>
    </section>
    {sets.length>0&&<p className="catalog-result-count" role="status">{groups.length} {id?'kartu':'cards'}</p>}
    <div className="card-grid" style={{'--catalog-grid-mode':gridColumns==='auto'?'auto-fit':gridColumns} as React.CSSProperties}>
      {groups.slice(0,(catalogPage+1)*240).map(variants=><CatalogTile key={variants[0].id} primary={variants[0]} variants={variants} language={language} onOpen={(card,origin)=>{setPreviewOrigin(origin);setPreview(card)}}/>)}
    </div>
    {catalogLoading&&<div className="catalog-loading" role="status"><div className="catalog-skeleton-grid">{Array.from({length:10},(_,index)=><i key={index}/>)}</div><span className="sr-only">{id?'Memuat versi cetak kartu':'Loading card printings'}</span></div>}{!filtered.length&&!catalogLoading && <div className="empty-state"><h2>{setPage?(id?'Tidak ada kartu dalam set ini yang cocok':'No cards in this set match those filters'):(id?'Tidak ada kartu yang cocok dengan pencarian':'No card matches that search')}</h2><p>{id?'Coba masukkan nomor kartu, nama yang lebih singkat, atau atur ulang filter.':'Try the card number, a shorter name, or reset the filters.'}</p><button className="button secondary" onClick={()=>{setQuery('');setColor('All colors');setSelectedColors([]);setTypes([]);setRarities([]);setAttributes([]);setCounters([]);setKeywords([]);setTraits([]);setBlocks([]);setSets(setPage&&initialSet?[normalizeSetCode(initialSet)]:[])}}>{id?'Atur ulang filter katalog':'Reset library filters'}</button></div>}
    {!catalogLoading&&groups.length>(catalogPage+1)*240&&<div className="browse-all-wrap"><button className="button secondary browse-all" onClick={()=>setCatalogPage(page=>page+1)}>{id?'Muat lebih banyak kartu':'Load more catalog cards'}</button></div>}
    {preview&&<CardPreviewModal card={preview} origin={previewOrigin} language={preview.language==='JP'?'JP':'EN'} cards={groups.map(group=>group[0])} onClose={()=>{setPreview(undefined);setPreviewOrigin(undefined)}} onNavigate={setPreview}/>}
  </main>;
}
