'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {WarningIcon as AlertTriangle, ArrowsDownUpIcon as ArrowsDownUp, ChartBarIcon as BarChart3, CaretDownIcon as ChevronDown, CaretUpIcon as ChevronUp, DownloadSimpleIcon as Download, FunnelIcon as Filter, StackIcon as Layers3, CircleNotchIcon as LoaderCircle, SignInIcon as LogIn, MinusIcon as Minus, PlusIcon as Plus, ArrowCounterClockwiseIcon as RotateCcw, RowsIcon as Rows, FloppyDiskIcon as Save, MagnifyingGlassIcon as Search, PaperPlaneTiltIcon as Send, ShareNetworkIcon as Share2, SparkleIcon as Sparkles, SquaresFourIcon as SquaresFour, InfoIcon as Info, UploadSimpleIcon as Upload, XIcon as X} from '@phosphor-icons/react';
import {CardArt} from './card-art';
import {useAccount} from '@/lib/client';
import {CardPreviewModal} from './card-preview-modal';
import {displayCardName} from './card-name';
import {makeLocalDeckId, readLocalDecks, readLocalDraft, upsertLocalDeck, writeLocalDraft, type LocalDeck} from './local-decks';
import {parseSharedDeck, sharedDeckSearch} from '@/lib/deck-share';
import {splitCardSubtypes} from '@/lib/card-subtypes';
import {TurnstileField,turnstileEnabled} from './turnstile-field';
import {cardFor, type Card} from '@/packages/card-data/catalog';
import {isPlayableSet, PREVIEW_CARD_CODES} from '@/packages/domain/release-availability';
import {versionedCardCatalogUrl} from '@/lib/card-catalog-cache';

type Row={id:string;rarity:string|null;variant:string|null;set_code:string|null;card_image_url:string|null;counter_amount:number|null;sub_types:string[]|string|null;tcg_card_assets?:Array<{kind:string;object_key:string}>;tcg_card_identities:{id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string}};
type CardType='All'|'Character'|'Event'|'Stage';
const typeOrder:CardType[]=['All','Character','Event','Stage'];
const deckKinds=['Character','Event','Stage'] as const;
const metaLeaderOrder=['OP09-062','ST30-001','OP14-020','OP17-079','OP17-020','OP12-020'];
type DeckCard=Card&{identityId:string;counter:number;archetypes:string[]};
type CoachMessage={role:'assistant'|'user';content:string};

function matchesCost(card:Card,value:string,mode:string){if(value==='Any cost'||mode==='Any')return true;const target=Number(value);return mode==='At least'?card.cost>=target:mode==='At most'?card.cost<=target:card.cost===target;}
function makeCard(row:Row):DeckCard {const identity=row.tcg_card_identities;return {id:row.id,code:identity.code,name:displayCardName(identity.name,identity.code),color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:row.rarity??'',art:0,effect:identity.effect_text,imageUrl:row.card_image_url??undefined,imageSource:'external',setCode:row.set_code??undefined,assetPath:row.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key,identityId:identity.id,counter:row.counter_amount??0,archetypes:splitCardSubtypes(row.sub_types)};}
function colourWords(card?:Card){return card?.color.split(/\s+/).filter(Boolean)??[];}
function printingRank(variant?:string|null){const value=(variant??'standard').toLowerCase();return value==='standard'||value==='base'||value==='normal'?0:value.includes('parallel')||value.includes('alternate')||value.includes('alt')?2:1;}
function setRank(code?:string){const match=code?.match(/(?:OP|EB|ST)(\d+)/i);return match?Number(match[1]):0;}
function newestFirst(a:Card,b:Card){return setRank(b.setCode)-setRank(a.setCode)||b.code.localeCompare(a.code,undefined,{numeric:true});}

type DeckSortOption='cost-asc'|'cost-desc'|'name-asc'|'power-desc'|'counter-desc';
function sortDeckCards(a:DeckCard,b:DeckCard,sort:DeckSortOption){
  const costA=Number(a.cost)||0;
  const costB=Number(b.cost)||0;
  const powerA=Number(a.power)||0;
  const powerB=Number(b.power)||0;
  const counterA=Number(a.counter)||0;
  const counterB=Number(b.counter)||0;
  const nameA=a.name||'';
  const nameB=b.name||'';
  const codeA=a.code||'';
  const codeB=b.code||'';

  if(sort==='cost-desc')return costB-costA||nameA.localeCompare(nameB)||codeA.localeCompare(codeB);
  if(sort==='cost-asc')return costA-costB||nameA.localeCompare(nameB)||codeA.localeCompare(codeB);
  if(sort==='name-asc')return nameA.localeCompare(nameB)||costA-costB||codeA.localeCompare(codeB);
  if(sort==='power-desc')return powerB-powerA||costA-costB||nameA.localeCompare(nameB);
  if(sort==='counter-desc')return counterB-counterA||costA-costB||nameA.localeCompare(nameB);
  return costA-costB||nameA.localeCompare(nameB);
}

export function LiveDeckBuilder({initialCardId,localDeckId}:{initialCardId?:string;localDeckId?:string}){
  const {data:account}=useAccount();
  const [cards,setCards]=useState<DeckCard[]>([]);
  const [allPrintings,setAllPrintings]=useState<DeckCard[]>([]);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState('');
  const [deck,setDeck]=useState<Record<string,number>>({});
  const [leader,setLeader]=useState<string>();
  const [type,setType]=useState<CardType>('All');
  const [cost,setCost]=useState('Any cost');
  const [costMode,setCostMode]=useState('Any');
  const [counterFilter,setCounterFilter]=useState('Any counter');
  const [subtypeFilter,setSubtypeFilter]=useState('Any trait');
  const [compatibility,setCompatibility]=useState<'legal'|'all'>('legal');
  const [catalogColour,setCatalogColour]=useState('All');
  const [title,setTitle]=useState('Untitled deck');
  const [leaderQuery,setLeaderQuery]=useState('');
  const [leaderColours,setLeaderColours]=useState<string[]>([]);
  const [leaderPickerOpen,setLeaderPickerOpen]=useState(false);
  const [mobileDeckOpen,setMobileDeckOpen]=useState(false);
  const [artByIdentity,setArtByIdentity]=useState<Record<string,DeckCard>>({});
  const [artPicker,setArtPicker]=useState<DeckCard>();
  const [preview,setPreview]=useState<DeckCard>();
  const [previewOrigin,setPreviewOrigin]=useState<DOMRect>();
  const [compactDeck,setCompactDeck]=useState(true);
  const [hoveredCard,setHoveredCard]=useState<{card:DeckCard;left:number;top:number}>();
  const [notice,setNotice]=useState('');
  const [highlight,setHighlight]=useState<{kind:'cost'|'color'|'type'|'counter'|'archetype';value:string}>();
  const [savedLocalId,setSavedLocalId]=useState<string|undefined>(localDeckId);
  const [deckSearch,setDeckSearch]=useState('');
  const [deckTypeFilter,setDeckTypeFilter]=useState<CardType>('All');
  const [deckStatFilter,setDeckStatFilter]=useState<{kind:'cost'|'color'|'type'|'counter'|'archetype';value:string}>();
  const [deckSort,setDeckSort]=useState<DeckSortOption>('cost-asc');
  const [coachOpen,setCoachOpen]=useState(false);
  const [coachInput,setCoachInput]=useState('');
  const [coachMessages,setCoachMessages]=useState<CoachMessage[]>([]);
  const [coachLoading,setCoachLoading]=useState(false);
  const [coachTurnstileToken,setCoachTurnstileToken]=useState('');
  const [coachTurnstileResetKey,setCoachTurnstileResetKey]=useState(0);
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');
  const importRef=useRef<HTMLInputElement>(null);
  const sortSelectRef=useRef<HTMLSelectElement>(null);
  const restoredRef=useRef(false);

  useEffect(()=>{
    if(!mobileDeckOpen)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobileDeckOpen(false);};
    document.addEventListener('keydown',closeOnEscape);
    return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',closeOnEscape);};
  },[mobileDeckOpen]);

  useEffect(()=>{const sync=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');sync();window.addEventListener('vivreplay:locale',onLocale);return()=>window.removeEventListener('vivreplay:locale',onLocale);},[]);
  const t=(en:string,id:string)=>language==='ID'?id:en;

  useEffect(()=>{const closeMenus=(event:PointerEvent)=>{document.querySelectorAll<HTMLDetailsElement>('.deck-command-menu[open]').forEach(menu=>{if(!menu.contains(event.target as Node))menu.open=false;});};const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')document.querySelectorAll<HTMLDetailsElement>('.deck-command-menu[open]').forEach(menu=>menu.open=false);};document.addEventListener('pointerdown',closeMenus);document.addEventListener('keydown',closeOnEscape);return()=>{document.removeEventListener('pointerdown',closeMenus);document.removeEventListener('keydown',closeOnEscape);};},[]);

  useEffect(()=>{let active=true;const controller=new AbortController();void(async()=>{const response=await fetch(versionedCardCatalogUrl('/api/cards/catalog'),{signal:controller.signal});if(!response.ok)throw new Error('Catalog is unavailable.');const payload=await response.json() as {cards?:Row[]};const rows=(payload.cards??[]).filter(row=>isPlayableSet(row.set_code) || PREVIEW_CARD_CODES.has(row.tcg_card_identities.code.toUpperCase()));if(!active)return;const primaryByIdentity=new Map<string,Row>();for(const row of rows.sort((a,b)=>printingRank(a.variant)-printingRank(b.variant)||a.id.localeCompare(b.id))){if(!primaryByIdentity.has(row.tcg_card_identities.id))primaryByIdentity.set(row.tcg_card_identities.id,row);}const mapped=[...primaryByIdentity.values()].map(makeCard).sort(newestFirst);const all=rows.map(makeCard);setCards(mapped);setAllPrintings(all);const shared=parseSharedDeck(new URLSearchParams(window.location.search));if(shared&&!restoredRef.current){restoredRef.current=true;const sharedLeader=shared.leaderCode?mapped.find(card=>card.type==='Leader'&&card.code===shared.leaderCode):undefined;const sharedDeck=Object.fromEntries(shared.entries.map(({code,quantity})=>{const card=mapped.find(candidate=>candidate.type!=='Leader'&&candidate.code===code);return card?[card.id,quantity]:undefined;}).filter((entry):entry is [string,number]=>Boolean(entry)));setLeader(sharedLeader?.id);setDeck(sharedDeck);if(shared.title)setTitle(shared.title);setNotice('Shared deck loaded.');}else{const stored=localDeckId?readLocalDecks().find(deck=>deck.id===localDeckId):readLocalDraft();if(stored&&!restoredRef.current){restoredRef.current=true;setSavedLocalId(stored.id);setTitle(stored.title||'Untitled deck');const restoredLeader=mapped.find(card=>card.id===stored.leaderPrintingId||card.code===stored.leaderCode);if(restoredLeader?.type==='Leader')setLeader(restoredLeader.id);const restoredEntries=Object.fromEntries(Object.entries(stored.entries).filter(([id,count])=>mapped.some(card=>card.id===id)&&count>0).map(([id,count])=>[id,Math.min(4,count)]));setDeck(restoredEntries);const restoredArt:Record<string,DeckCard>={};Object.entries(stored.artworkIds??{}).forEach(([identityId,printingId])=>{const printing=all.find(card=>card.id===printingId);if(printing)restoredArt[identityId]=printing;});setArtByIdentity(restoredArt);}else if(initialCardId){const chosen=all.find(card=>card.id===initialCardId);const match=chosen?mapped.find(card=>card.identityId===chosen.identityId):mapped.find(card=>card.id===initialCardId);if(match&&match.type!=='Leader'){setDeck({[match.id]:1});if(chosen)setArtByIdentity({[match.identityId]:chosen});}}}setLoading(false);})().catch(error=>{if(active&&!(error instanceof DOMException&&error.name==='AbortError'))setLoading(false);});return()=>{active=false;controller.abort();};},[initialCardId,localDeckId]);

  const variantsByIdentity=useMemo(()=>allPrintings.reduce<Record<string,DeckCard[]>>((result,card)=>{(result[card.identityId]??=[]).push(card);return result;},{}),[allPrintings]);
  const vaultCountByIdentity=useMemo(()=>{
    const counts:Record<string,number>={};
    for(const item of account?.collection??[]){
      if(item.type!=='RAW')continue;
      const identityId=cardFor(item.printingId)?.id;
      const available=Math.max(0,item.quantity-(item.listedQuantity??0));
      if(identityId)counts[identityId]=(counts[identityId]??0)+available;
    }
    return counts;
  },[account?.collection]);
  const displayArt=(card:DeckCard)=>artByIdentity[card.identityId]??card;
  const leaderCard=cards.find(card=>card.id===leader);
  const leaders=useMemo(()=>cards.filter(card=>card.type==='Leader').sort((a,b)=>{const ai=metaLeaderOrder.indexOf(a.code),bi=metaLeaderOrder.indexOf(b.code);return (ai<0?99:ai)-(bi<0?99:bi)||newestFirst(a,b);}),[cards]);
  const visibleLeaders=useMemo(()=>leaders.filter(card=>(!leaderColours.length||leaderColours.some(colour=>colourWords(card).includes(colour)))&&(`${card.name} ${card.code}`).toLowerCase().includes(leaderQuery.toLowerCase())),[leaders,leaderColours,leaderQuery]);
  const leaderColors=colourWords(leaderCard);
  useEffect(()=>{if(catalogColour!=='All'&&!leaderColors.includes(catalogColour))setCatalogColour('All');},[catalogColour,leaderColors.join('|')]);
  const total=Object.values(deck).reduce((sum,count)=>sum+count,0);
  const deckCards=cards.filter(card=>deck[card.id]);
  const catalog=useMemo(()=>cards.filter(card=>card.type!=='Leader'&&(`${card.name} ${card.code}`).toLowerCase().includes(query.toLowerCase())&&matchesCost(card,cost,costMode)&&(type==='All'||card.type===type)&&(counterFilter==='Any counter'||(counterFilter==='No counter'?card.counter===0:card.counter>=Number(counterFilter)))&&(subtypeFilter==='Any trait'||card.archetypes.includes(subtypeFilter))&&(compatibility==='all'||!leaderColors.length||colourWords(card).some(value=>leaderColors.includes(value)))&&(catalogColour==='All'||colourWords(card).includes(catalogColour))),[cards,query,type,cost,costMode,counterFilter,subtypeFilter,compatibility,catalogColour,leaderColors.join('|')]);
  const subtypeOptions=useMemo(()=>[...new Set(cards.flatMap(card=>card.archetypes))].sort((a,b)=>a.localeCompare(b)),[cards]);
  const grouped=useMemo(()=>deckKinds.map(kind=>({kind,cards:deckCards.filter(card=>card.type===kind),total:deckCards.filter(card=>card.type===kind).reduce((sum,card)=>sum+(deck[card.id]??0),0)})).filter(group=>group.cards.length),[deckCards,deck]);
  const curve=Array.from({length:8},(_,index)=>deckCards.filter(card=>Math.min(card.cost,7)===index).reduce((sum,card)=>sum+(deck[card.id]??0),0));
  const curvePeak=Math.max(...curve,1);
  const colours=useMemo(()=>['Red','Green','Blue','Purple','Black','Yellow'].map(value=>({value,total:deckCards.reduce((sum,card)=>sum+(colourWords(card).includes(value)?deck[card.id]??0:0),0)})).filter(item=>item.total),[deckCards,deck]);
  const rarities=useMemo(()=>Object.entries(deckCards.reduce<Record<string,number>>((acc,card)=>{const key=card.rarity||'Standard';acc[key]=(acc[key]??0)+(deck[card.id]??0);return acc;},{})).sort((a,b)=>b[1]-a[1]).slice(0,3),[deckCards,deck]);
  const counters=useMemo(()=>Object.entries(deckCards.reduce<Record<string,number>>((acc,card)=>{const key=card.counter?`+${card.counter}`:'No counter';acc[key]=(acc[key]??0)+(deck[card.id]??0);return acc;},{})).sort((a,b)=>b[1]-a[1]).slice(0,3),[deckCards,deck]);
  const archetypes=useMemo(()=>Object.entries(deckCards.reduce<Record<string,number>>((acc,card)=>{for(const archetype of card.archetypes){acc[archetype]=(acc[archetype]??0)+(deck[card.id]??0);}return acc;},{})).sort((a,b)=>b[1]-a[1]).slice(0,4),[deckCards,deck]);
  const mismatches=leaderColors.length?deckCards.filter(card=>!colourWords(card).some(value=>leaderColors.includes(value))):[];
  const issue=total!==50?`${Math.max(0,50-total)} cards to go`:'';
  const average=total?(deckCards.reduce((sum,card)=>sum+card.cost*(deck[card.id]??0),0)/total).toFixed(1):'-';

  function matchesStatFilter(card:DeckCard,filter:{kind:'cost'|'color'|'type'|'counter'|'archetype';value:string}){
    if(filter.kind==='cost')return String(Math.min(card.cost,7))===filter.value;
    if(filter.kind==='color')return colourWords(card).includes(filter.value);
    if(filter.kind==='type')return card.type===filter.value;
    if(filter.kind==='counter')return (card.counter?`+${card.counter}`:'No counter')===filter.value;
    return card.archetypes.includes(filter.value);
  }
  function toggleStatFilter(stat:{kind:'cost'|'color'|'type'|'counter'|'archetype';value:string}){
    if(stat.kind==='type'){
      setDeckTypeFilter(current=>current===stat.value?'All':(stat.value as CardType));
      setDeckStatFilter(undefined);
      return;
    }
    setDeckStatFilter(current=>current?.kind===stat.kind&&current.value===stat.value?undefined:stat);
  }
  function clearDeckFilters(){
    setDeckSearch('');
    setDeckTypeFilter('All');
    setDeckStatFilter(undefined);
    setDeckSort('cost-asc');
  }

  const filteredDeckCards=useMemo(()=>deckCards.filter(card=>{
    if(deckSearch.trim()){
      const q=deckSearch.trim().toLowerCase();
      const match=card.name.toLowerCase().includes(q)||card.code.toLowerCase().includes(q)||card.archetypes.some(t=>t.toLowerCase().includes(q));
      if(!match)return false;
    }
    if(deckTypeFilter!=='All'&&card.type!==deckTypeFilter)return false;
    if(deckStatFilter&&!matchesStatFilter(card,deckStatFilter))return false;
    return true;
  }),[deckCards,deckSearch,deckTypeFilter,deckStatFilter]);
  const sortedDeckCards=useMemo(()=>[...filteredDeckCards].sort((a,b)=>sortDeckCards(a,b,deckSort)),[filteredDeckCards,deckSort]);
  const sortedGrouped=useMemo(()=>deckKinds.map(kind=>{
    const cards=sortedDeckCards.filter(card=>card.type===kind);
    return {
      kind,
      cards,
      total:cards.reduce((sum,card)=>sum+(deck[card.id]??0),0)
    };
  }).filter(group=>group.cards.length),[sortedDeckCards,deck]);
  const filteredCount=useMemo(()=>filteredDeckCards.reduce((sum,card)=>sum+(deck[card.id]??0),0),[filteredDeckCards,deck]);

  function change(card:DeckCard,delta:number){if(!leader)return;setDeck(current=>{const next=(current[card.id]??0)+delta;if(next<1){const {[card.id]:_,...rest}=current;return rest;}if(next>4||total>=50&&delta>0)return current;return {...current,[card.id]:next};});}
  function addOwnedCopies(card:DeckCard,owned:number){if(!leader||owned<=0)return;setDeck(current=>{const currentCount=current[card.id]??0;const currentTotal=Object.values(current).reduce((sum,count)=>sum+count,0);const add=Math.min(owned-currentCount,4-currentCount,50-currentTotal);return add>0?{...current,[card.id]:currentCount+add}:current;});}
  function chooseLeader(id:string){const nextLeader=cards.find(card=>card.id===id);const nextColours=colourWords(nextLeader);setLeader(id);setDeck(current=>{const retained:Record<string,number>={};for(const [cardId,count] of Object.entries(current)){const card=cards.find(item=>item.id===cardId);if(card&&colourWords(card).some(value=>nextColours.includes(value)))retained[cardId]=count;}return retained;});}
  function completeMetaStyleDeck(){
    if(!leaderCard){setNotice('Choose a Leader before completing a deck.');return;}
    const leaderTraits=new Set(leaderCard.archetypes);
    const compatible=cards.filter(card=>card.type!=='Leader'&&colourWords(card).some(colour=>leaderColors.includes(colour)));
    const score=(card:DeckCard)=>{
      const traitMatches=card.archetypes.filter(trait=>leaderTraits.has(trait)).length;
      const counterScore=card.counter>=2000?18:card.counter>=1000?8:0;
      const typeScore=card.type==='Character'?8:card.type==='Event'?4:2;
      return traitMatches*100+counterScore+typeScore+Math.max(0,9-card.cost);
    };
    const ranked=[...compatible].sort((a,b)=>score(b)-score(a)||newestFirst(a,b));
    if(!ranked.length){setNotice('No compatible cards are available for this Leader.');return;}
    const targets=[[1,8],[2,12],[3,12],[4,8],[5,5],[6,5]] as const;
    const next:Record<string,number>={};
    let count=0;
    const add=(card:DeckCard)=>{if(count>=50||(next[card.id]??0)>=4)return false;next[card.id]=(next[card.id]??0)+1;count+=1;return true;};
    const preferredCopies=(card:DeckCard)=>card.type==='Event'?(card.cost>=4?2:3):(leaderTraits.size&&card.archetypes.some(trait=>leaderTraits.has(trait))?3:2);
    for(const [cost,target] of targets){
      const bucket=ranked.filter(card=>cost===6?card.cost>=6:card.cost===cost);
      let added=0;
      for(const card of bucket){
        const copies=Math.min(preferredCopies(card),target-added);
        for(let copy=0;copy<copies;copy+=1){if(!add(card))break;added+=1;}
        if(added>=target)break;
      }
    }
    for(const card of ranked){
      const copies=preferredCopies(card);
      for(let copy=0;copy<copies&&count<50;copy+=1)add(card);
      if(count>=50)break;
    }
    for(let index=0;count<50;index+=1){const card=ranked[index%ranked.length];if(!add(card)&&ranked.every(candidate=>(next[candidate.id]??0)>=4))break;}
    setDeck(next);
    setNotice(`Built a 50-card meta-style starting list for ${leaderCard.name}. Review it before saving or playing.`);
  }
  function openHover(card:DeckCard,event:React.MouseEvent<HTMLElement>){const rect=event.currentTarget.getBoundingClientRect();setHoveredCard({card:displayArt(card),left:Math.min(window.innerWidth-310,Math.max(12,rect.right+14)),top:Math.min(window.innerHeight-420,Math.max(12,rect.top-28))});}
  function openPreview(card:DeckCard,target:HTMLElement){setPreviewOrigin(target.getBoundingClientRect());setPreview(displayArt(card));}
  function matchesHighlight(card:DeckCard){
    const active=highlight??deckStatFilter;
    if(!active)return false;
    return matchesStatFilter(card,active);
  }
  function chooseArt(card:DeckCard){setArtByIdentity(current=>({...current,[card.identityId]:card}));setArtPicker(undefined);}
  function localRecord(id:string):LocalDeck{return {id,title:title.trim()||'Untitled deck',leaderPrintingId:leader,leaderCode:leaderCard?.code,entries:deck,artworkIds:Object.fromEntries(Object.entries(artByIdentity).map(([identityId,printing])=>[identityId,printing.id])),updatedAt:new Date().toISOString()};}
  function saveLocal(){const id=savedLocalId??makeLocalDeckId();const record=localRecord(id);upsertLocalDeck(record);writeLocalDraft(record);setSavedLocalId(id);window.dispatchEvent(new CustomEvent('vivreplay:decks-changed'));setNotice(t('Saved on this device. Sign in from the Save menu to sync online.','Tersimpan di perangkat ini. Masuk dari menu Save untuk sinkronkan.'));}
  useEffect(()=>{if(loading||!cards.length)return;const id=savedLocalId??'draft';writeLocalDraft(localRecord(id));window.dispatchEvent(new CustomEvent('vivreplay:decks-changed'));},[loading,cards.length,title,leader,deck,artByIdentity,savedLocalId]);
  useEffect(()=>{if(loading||!cards.length)return;const search=sharedDeckSearch({leaderCode:leaderCard?.code,title,entries:deckCards.map(card=>({code:card.code,quantity:deck[card.id]??0}))});const next=`${window.location.pathname}?${search}`;if(`${window.location.pathname}${window.location.search}`!==next)window.history.replaceState(window.history.state,'',next);},[loading,cards.length,leaderCard?.code,title,deck,deckCards]);
  function deckText(){return [`VivrePlay Deck`,`Name: ${title}`,`Leader: ${leaderCard?.code??'Unselected'}`,'',...deckCards.sort((a,b)=>a.cost-b.cost||a.name.localeCompare(b.name)).map(card=>`${deck[card.id]}x ${card.code} - ${card.name}`)].join('\n');}
  function exportDeck(){const blob=new Blob([deckText()],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`${title.trim().replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'vivreplay-deck'}.txt`;anchor.click();URL.revokeObjectURL(url);setNotice('Readable decklist exported.');}
  async function shareDeck(){const url=new URL(window.location.href);url.search=sharedDeckSearch({leaderCode:leaderCard?.code,title,entries:deckCards.map(card=>({code:card.code,quantity:deck[card.id]??0}))});try{if(navigator.share){await navigator.share({title, text:deckText(),url:url.href});setNotice('Share link opened.');}else{await navigator.clipboard.writeText(url.href);setNotice('Share link copied.');}}catch{try{await navigator.clipboard.writeText(url.href);setNotice('Share link copied.');}catch{setNotice('Sharing is unavailable in this browser.');}}}
  function coachCard(card:DeckCard){return {code:card.code,name:card.name,colour:card.color,type:card.type,cost:card.cost,power:card.power,counter:card.counter,subtypes:card.archetypes,effect:card.effect.slice(0,700)};}
  async function askCoach(question?:string){const prompt=(question??coachInput).trim();if(!prompt||coachLoading)return;if(turnstileEnabled&&!coachTurnstileToken){setCoachMessages(current=>[...current,{role:'assistant',content:t('Complete the security check first.','Selesaikan pemeriksaan keamanan terlebih dahulu.')}]);return;}const nextMessages=[...coachMessages,{role:'user' as const,content:prompt}];setCoachMessages(nextMessages);setCoachInput('');setCoachLoading(true);try{const deckSubtypes=new Set(deckCards.flatMap(card=>card.archetypes));const candidates=cards.filter(card=>card.type!=='Leader'&&(!leaderColors.length||colourWords(card).some(colour=>leaderColors.includes(colour)))).sort((a,b)=>Number(deckSubtypes.has(b.archetypes[0]??''))-Number(deckSubtypes.has(a.archetypes[0]??''))||newestFirst(a,b)).slice(0,90).map(coachCard);const response=await fetch('/api/ai/deck-coach',{method:'POST',headers:{'content-type':'application/json',...(coachTurnstileToken?{'cf-turnstile-response':coachTurnstileToken}:{})},body:JSON.stringify({question:prompt,locale:language,history:nextMessages.slice(-6),context:{leader:leaderCard?coachCard(leaderCard):null,deckSize:total,deck:deckCards.map(card=>({...coachCard(card),quantity:deck[card.id]??0})),candidates}})});const raw=await response.text();let payload:{reply?:string;error?:string}={};try{payload=JSON.parse(raw) as {reply?:string;error?:string}}catch{throw new Error(t('The coach returned an invalid response.','Deck Coach mengembalikan respons tidak valid.'));}if(!response.ok||!payload.reply)throw new Error(payload.error??t('The coach is unavailable right now.','Deck Coach tidak tersedia saat ini.'));setCoachMessages(current=>[...current,{role:'assistant',content:payload.reply!}]);}catch(error){setCoachMessages(current=>[...current,{role:'assistant',content:error instanceof Error?error.message:t('The coach is unavailable right now.','Deck Coach tidak tersedia saat ini.')}]);}finally{setCoachLoading(false);setCoachTurnstileToken('');setCoachTurnstileResetKey(value=>value+1);}}
  function importDeck(event:React.ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const raw=String(reader.result).trim();const payload=raw.startsWith('{')?JSON.parse(raw) as {title?:unknown;leaderCode?:unknown;cards?:Array<{code?:unknown;quantity?:unknown;printingId?:unknown}>}: {title:raw.match(/^Name:\s*(.+)$/mi)?.[1]??'Untitled deck',leaderCode:raw.match(/^Leader:\s*([^\s]+)/mi)?.[1],cards:[...raw.matchAll(/^\s*(\d+)x\s+([^\s]+)/gmi)].map(match=>({quantity:Number(match[1]),code:match[2]}))};const next:Record<string,number>={};const art:Record<string,DeckCard>={};for(const item of Array.isArray(payload.cards)?payload.cards:[]){const imported=item as {code?:unknown;quantity?:unknown;printingId?:unknown};const card=cards.find(candidate=>candidate.id===imported.printingId||candidate.code===imported.code);const quantity=Math.min(4,Math.max(1,Number(imported.quantity)||1));if(card&&deckKinds.includes(card.type as typeof deckKinds[number])){next[card.id]=Math.min(4,(next[card.id]??0)+quantity);const printing=allPrintings.find(candidate=>candidate.id===imported.printingId);if(printing)art[card.identityId]=printing;}}const nextLeader=typeof payload.leaderCode==='string'?cards.find(card=>card.type==='Leader'&&card.code===payload.leaderCode):undefined;setDeck(next);setArtByIdentity(art);setLeader(nextLeader?.id);if(typeof payload.title==='string')setTitle(payload.title);setNotice('Deck imported.');}catch{setNotice('That file is not a valid decklist.');}finally{event.target.value='';}};reader.readAsText(file);}


  return <main className={`page live-builder ${mobileDeckOpen?'has-mobile-deck':''}`}>
    <section className="library-intro deck-library-intro deck-builder-intro"><div className="library-intro-copy"><p className="kicker">{t('DECK BUILDER','PEMBUAT DECK')}</p><h1>{t('Build around a leader.','Bangun deck dari Leader.')}</h1><p>{t('Choose a leader. Build the fifty cards they were made to lead.','Pilih Leader. Susun lima puluh kartu yang paling cocok dipimpinnya.')}</p></div><div className="library-intro-rail deck-builder-rail" aria-hidden="true"><div className="library-intro-rail-cards">{leaders.slice(0,6).map((card,index)=><div className={`library-intro-rail-card rail-card-${index}`} key={card.id}><CardArt card={displayArt(card)}/></div>)}{!leaders.length&&Array.from({length:6},(_,index)=><i className={`library-intro-rail-skeleton rail-card-${index}`} key={index}/>)}</div></div></section>
    <div className={`builder-workspace ${loading?'is-loading':''}`}>
      <aside className="builder-catalog">
        <div className="catalog-leader"><section className={`leader-selector ${leaderPickerOpen||!leaderCard?'is-open':''}`}><button type="button" className="leader-summary" aria-expanded={leaderPickerOpen||!leaderCard} onClick={()=>setLeaderPickerOpen(current=>!current)}><span className="leader-summary-art" onMouseEnter={event=>leaderCard&&openHover(leaderCard,event)} onMouseLeave={()=>setHoveredCard(undefined)}>{leaderCard?<CardArt card={displayArt(leaderCard)}/>:<i/>}</span><span className="leader-summary-copy"><small>Deck leader</small><strong>{leaderCard?.name??'Choose your leader'}</strong><em>{leaderColors.length?leaderColors.map(colour=><span key={colour}><i className={colour.toLowerCase()}/>{colour}</span>):'Choose a leader to define colours'}</em></span><b>{visibleLeaders.length}</b><ChevronDown size={15}/></button><div className="leader-picker-body"><div className="leader-picker-content"><div className="leader-selector-controls"><label><Search size={13}/><input value={leaderQuery} onChange={event=>setLeaderQuery(event.target.value)} placeholder={t('Find a leader','Cari Leader')}/></label><div role="group" aria-label="Leader colours"><button type="button" aria-label={t('All leader colours','Semua warna Leader')} title={t('All leader colours','Semua warna Leader')} aria-pressed={!leaderColours.length} onClick={()=>setLeaderColours([])}>All</button>{['Red','Green','Blue','Purple','Black','Yellow'].map(colour=><button key={colour} type="button" aria-label={t(`Filter ${colour} leaders`,`Filter Leader ${colour}`)} title={t(`Filter ${colour} leaders`,`Filter Leader ${colour}`)} aria-pressed={leaderColours.includes(colour)} onClick={()=>setLeaderColours(current=>current.includes(colour)?current.filter(value=>value!==colour):[...current,colour])}><i className={colour.toLowerCase()}/></button>)}</div></div><div className="leader-gallery" aria-label="Choose deck leader">{visibleLeaders.map(card=><button type="button" key={card.id} className={card.id===leader?'selected':''} aria-pressed={card.id===leader} onClick={()=>chooseLeader(card.id)} onMouseEnter={event=>openHover(card,event)} onMouseLeave={()=>setHoveredCard(undefined)} title={`${card.name} · ${card.color}`}><CardArt card={displayArt(card)}/></button>)}{!visibleLeaders.length&&<p>No leaders match that filter.</p>}</div></div></div></section></div>
        <div className="builder-filters"><div className="builder-filter-primary"><label className="builder-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={t('Search name or card number','Cari nama atau nomor kartu')}/></label><div className="type-tabs" role="group" aria-label="Card type">{typeOrder.map(value=><button type="button" key={value} aria-pressed={type===value} onClick={()=>setType(value)}>{value}</button>)}</div><button type="button" className={compatibility==='legal'?'compatibility active':'compatibility'} onClick={()=>setCompatibility(current=>current==='legal'?'all':'legal')}><Filter size={14}/>{compatibility==='legal'?'Leader colours':'All colours'}</button></div><details className="builder-advanced-filters"><summary><Filter size={14}/><span>Card filters</span></summary><div className="builder-filter-row"><label>Cost<select value={costMode} onChange={event=>setCostMode(event.target.value)} aria-label="Cost comparison"><option>Any</option><option>Exact</option><option>At least</option><option>At most</option></select></label><label>Value<select value={cost} onChange={event=>setCost(event.target.value)} aria-label="Cost value" disabled={costMode==='Any'}><option>Any cost</option>{Array.from({length:10},(_,index)=><option key={index} value={index}>Cost {index}</option>)}</select></label><label>Counter<select value={counterFilter} onChange={event=>setCounterFilter(event.target.value)} aria-label="Counter"><option>Any counter</option><option value="No counter">No counter</option><option value="1000">Counter 1000+</option><option value="2000">Counter 2000+</option></select></label><label className="builder-trait-filter">Trait<select value={subtypeFilter} onChange={event=>setSubtypeFilter(event.target.value)} aria-label="Trait"><option>Any trait</option>{subtypeOptions.map(trait=><option key={trait}>{trait}</option>)}</select></label></div></details>{compatibility==='legal'&&leaderColors.length>1&&<div className="catalog-colour-filter" role="group" aria-label="Filter leader colours"><button type="button" aria-pressed={catalogColour==='All'} onClick={()=>setCatalogColour('All')}>All</button>{leaderColors.map(colour=><button type="button" key={colour} aria-pressed={catalogColour===colour} onClick={()=>setCatalogColour(colour)}><i className={colour.toLowerCase()}/>{colour}</button>)}</div>}</div>
        <div className="builder-result-bar"><span>{loading?'Loading live cards…':`${catalog.length} cards available`}</span><button type="button" onClick={()=>{setQuery('');setType('All');setCost('Any cost');setCostMode('Any');setCounterFilter('Any counter');setSubtypeFilter('Any trait');setCompatibility('legal');setCatalogColour('All');}}><X size={13}/>{t('Reset','Reset')}</button></div>
        <div className="live-builder-grid">{loading?Array.from({length:15},(_,index)=><i key={index} className="deck-card-skeleton"/>):catalog.map(card=>{const count=deck[card.id]??0;const owned=vaultCountByIdentity[card.identityId]??0;const availableOwned=Math.max(0,owned-count);return <article key={card.id} className={`${count?'in-deck':''} ${matchesHighlight(card)?'stat-active':''}`} onMouseEnter={event=>openHover(card,event)} onMouseLeave={()=>setHoveredCard(undefined)}><button className="art-button" onClick={()=>change(card,1)} disabled={!leader||count===4||total>=50} aria-label={`Add ${card.name}${owned?`, ${owned} available in Vault`:''}`}><CardArt card={displayArt(card)}/></button><button className="deck-info-action catalog-info-action" type="button" onClick={event=>openPreview(card,event.currentTarget)} aria-label={`View ${card.name} details`}><Info size={13}/></button>{owned>0&&<span className="catalog-owned-count" title={`${owned} available in Vault`}>Vault ×{owned}</span>}{count>0&&<span className="catalog-copy-count">×{count}</span>}{availableOwned>0&&<button type="button" className="catalog-add-card" onClick={()=>addOwnedCopies(card,owned)} disabled={!leader||total>=50} aria-label={`Add ${availableOwned} owned ${card.name} ${availableOwned===1?'copy':'copies'} to deck`}><Plus size={12}/>{`Add ${availableOwned} owned`}</button>}</article>;})}</div>
      </aside>
      {mobileDeckOpen&&<button type="button" className="mobile-deck-backdrop" onClick={()=>setMobileDeckOpen(false)} aria-label={t('Close deck editor','Tutup editor deck')}/>}
      <section id="mobile-deck-editor" className={`live-deck-panel ${mobileDeckOpen?'is-mobile-open':''}`} role={mobileDeckOpen?'dialog':undefined} aria-modal={mobileDeckOpen?'true':undefined} aria-label={t('Deck editor','Editor deck')}>
        <button type="button" className="mobile-deck-close" autoFocus={mobileDeckOpen} onClick={()=>setMobileDeckOpen(false)}><span>{t('Deck','Deck')} · {total}/50</span><span>{t('Close','Tutup')} <ChevronDown size={16}/></span></button>
        <div className="deck-command-bar"><input value={title} onChange={event=>setTitle(event.target.value)} aria-label="Deck name"/><strong>{total}<small>/50</small></strong><span className={leaderCard&&total===50&&!mismatches.length?'deck-valid':'deck-invalid'}>{leaderCard&&total===50&&!mismatches.length?'Ready':'Draft'}</span><details className="deck-command-menu"><summary><Download size={14}/>{t('Deck file','File deck')}<ChevronDown size={13}/></summary><div><button type="button" onClick={()=>importRef.current?.click()}><Upload size={14}/>{t('Import decklist','Impor daftar deck')}</button><button type="button" disabled={!total} onClick={exportDeck}><Download size={14}/>{t('Export decklist','Ekspor daftar deck')}</button></div></details><details className="deck-command-menu"><summary><Save size={14}/>Save<ChevronDown size={13}/></summary><div><button type="button" disabled={!leaderCard} onClick={saveLocal}><Save size={14}/>{savedLocalId?'Update this device':'Save on this device'}</button><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}><LogIn size={14}/>{t('Sign in to sync','Masuk untuk sinkronkan')}</button></div></details><button className="deck-share-action" type="button" disabled={!total} onClick={shareDeck}><Share2 size={14}/>{t('Share','Bagikan')}</button><button className="deck-coach-action" type="button" onClick={()=>setCoachOpen(true)}><Sparkles size={14}/>{t('Deck coach','Deck Coach')}</button><input ref={importRef} type="file" accept="text/plain,.txt,.deck,application/json,.json" onChange={importDeck}/></div>
        {loading&&<div className="deck-panel-skeleton" aria-label="Loading deck workspace"><i/><i/><i/><i/></div>}
        <div className="deck-warnings deck-start-warnings" aria-live="polite">{!leaderCard&&<p><AlertTriangle size={14}/><b>Choose a leader.</b> Your leader defines the deck colours.</p>}{leaderCard&&total===0&&<p><AlertTriangle size={14}/><b>Deck has 0/50 cards.</b> Add cards from the catalog.</p>}{mismatches.map(card=><p key={card.id}><AlertTriangle size={14}/><b>{card.code}</b> does not match {leaderCard?.name??'the leader'}’s colours.</p>)}{notice&&<p className="deck-command-notice">{notice}</p>}</div>
        {total>0&&<section className="deck-analysis">
          <div className="curve-panel"><header><span><BarChart3 size={15}/>Cost curve</span><small>Avg. {average}</small></header><div>{curve.map((amount,index)=><span key={index} role="button" tabIndex={0} aria-pressed={deckStatFilter?.kind==='cost'&&deckStatFilter.value===String(index)} className={deckStatFilter?.kind==='cost'&&deckStatFilter.value===String(index)?'is-selected':''} onClick={()=>toggleStatFilter({kind:'cost',value:String(index)})} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleStatFilter({kind:'cost',value:String(index)});}}} onMouseEnter={()=>setHighlight({kind:'cost',value:String(index)})} onMouseLeave={()=>setHighlight(undefined)} title={`Filter Cost ${index===7?'7+':index}`}><i style={{height:`${Math.max(4,Math.round(amount/curvePeak*46))}px`}}/><b>{index===7?'7+':index}</b></span>)}</div></div>
          <dl className="analysis-colours"><dt>Colours</dt>{colours.length?colours.map(item=><dd key={item.value} role="button" tabIndex={0} aria-pressed={deckStatFilter?.kind==='color'&&deckStatFilter.value===item.value} className={deckStatFilter?.kind==='color'&&deckStatFilter.value===item.value?'is-selected':''} onClick={()=>toggleStatFilter({kind:'color',value:item.value})} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleStatFilter({kind:'color',value:item.value});}}} onMouseEnter={()=>setHighlight({kind:'color',value:item.value})} onMouseLeave={()=>setHighlight(undefined)} title={`Filter ${item.value}`}><i className={item.value.toLowerCase()}/><span>{item.value}</span><em><b style={{width:`${Math.round(item.total/total*100)}%`}}/></em><strong>{Math.round(item.total/total*100)}%</strong></dd>):<dd className="empty">Add cards</dd>}</dl>
          <dl><dt>Types</dt>{deckKinds.map(kind=>{const group=grouped.find(item=>item.kind===kind);return <dd key={kind} role="button" tabIndex={0} aria-pressed={deckTypeFilter===kind} className={deckTypeFilter===kind?'is-selected':''} onClick={()=>toggleStatFilter({kind:'type',value:kind})} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleStatFilter({kind:'type',value:kind});}}} onMouseEnter={()=>setHighlight({kind:'type',value:kind})} onMouseLeave={()=>setHighlight(undefined)} title={`Filter ${kind}s`}><span>{kind}s</span><b>{group?.total??0}</b></dd>;})}</dl>
          <dl><dt>Counter</dt>{counters.length?counters.map(([counter,count])=><dd key={counter} role="button" tabIndex={0} aria-pressed={deckStatFilter?.kind==='counter'&&deckStatFilter.value===counter} className={deckStatFilter?.kind==='counter'&&deckStatFilter.value===counter?'is-selected':''} onClick={()=>toggleStatFilter({kind:'counter',value:counter})} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleStatFilter({kind:'counter',value:counter});}}} onMouseEnter={()=>setHighlight({kind:'counter',value:counter})} onMouseLeave={()=>setHighlight(undefined)} title={`Filter Counter ${counter}`}><span>{counter}</span><b>{count}</b></dd>):<dd className="empty">-</dd>}</dl>
          <dl className="analysis-archetypes"><dt>Archetype</dt>{archetypes.length?archetypes.map(([archetype,count])=><dd key={archetype} role="button" tabIndex={0} aria-pressed={deckStatFilter?.kind==='archetype'&&deckStatFilter.value===archetype} className={deckStatFilter?.kind==='archetype'&&deckStatFilter.value===archetype?'is-selected':''} onClick={()=>toggleStatFilter({kind:'archetype',value:archetype})} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleStatFilter({kind:'archetype',value:archetype});}}} onMouseEnter={()=>setHighlight({kind:'archetype',value:archetype})} onMouseLeave={()=>setHighlight(undefined)} title={`Filter ${archetype}`}><span>{archetype}</span><b>{count}</b></dd>):<dd className="empty">No subtype data</dd>}</dl>
        </section>}
        {total>0&&<div className="deck-board-toolbar" aria-label="Deck board filters and actions">
          <div className="deck-board-filters">
            <label className="deck-board-search" title={t('Filter cards in deck','Filter kartu di deck')}>
              <Search size={13}/>
              <input value={deckSearch} onChange={event=>setDeckSearch(event.target.value)} placeholder={t('Search…','Cari…')} aria-label="Filter cards in deck"/>
              {deckSearch&&<button type="button" onClick={()=>setDeckSearch('')} aria-label="Clear search"><X size={12}/></button>}
            </label>
            <div className="deck-board-type-tabs" role="group" aria-label="Filter by card type">
              {(['All','Character','Event','Stage'] as const).map(item=>{
                const count=item==='All'?total:deckCards.filter(c=>c.type===item).reduce((sum,c)=>sum+(deck[c.id]??0),0);
                if(item!=='All'&&count===0)return null;
                const label=item==='All'?t('All','Semua'):item==='Character'?t('Char','Karakter'):item;
                return <button key={item} type="button" className={deckTypeFilter===item?'is-active':''} aria-pressed={deckTypeFilter===item} onClick={()=>setDeckTypeFilter(item)} title={`${item}s (${count})`}><span>{label}</span><small>{count}</small></button>;
              })}
            </div>
            <div
              className="deck-board-sort"
              onClick={()=>{try{sortSelectRef.current?.showPicker?.();}catch{sortSelectRef.current?.focus();}}}
              title={t('Sort deck cards','Urutkan kartu deck')}
            >
              <ArrowsDownUp size={13}/>
              <select
                ref={sortSelectRef}
                value={deckSort}
                onChange={event=>setDeckSort(event.target.value as DeckSortOption)}
                onClick={event=>event.stopPropagation()}
                aria-label={t('Sort cards in deck','Urutkan kartu di deck')}
              >
                <option value="cost-asc">{t('Cost: Low to High','Biaya: Rendah ke Tinggi')}</option>
                <option value="cost-desc">{t('Cost: High to Low','Biaya: Tinggi ke Rendah')}</option>
                <option value="name-asc">{t('Name: A to Z','Nama: A sampai Z')}</option>
                <option value="power-desc">{t('Power: High to Low','Power: Tinggi ke Rendah')}</option>
                <option value="counter-desc">{t('Counter: High to Low','Counter: Tinggi ke Rendah')}</option>
              </select>
            </div>
            {deckStatFilter&&<span className="deck-board-active-filter"><span>{deckStatFilter.kind}: {deckStatFilter.value}</span><button type="button" onClick={()=>setDeckStatFilter(undefined)} aria-label="Remove filter"><X size={11}/></button></span>}
            {(deckSearch||deckTypeFilter!=='All'||deckStatFilter||deckSort!=='cost-asc')&&<button type="button" className="deck-board-filter-reset" onClick={clearDeckFilters} title={t('Reset all filters','Reset semua filter')}><X size={12}/><span>{t('Reset','Reset')}</span></button>}
            {(deckSearch||deckTypeFilter!=='All'||deckStatFilter)&&<span className="deck-board-filter-count">{filteredCount}/{total}</span>}
          </div>
          <div className="deck-actions">
            <div className="deck-layout-switch" role="group" aria-label="Deck layout">
              <button
                type="button"
                className={!compactDeck?'is-active':''}
                aria-pressed={!compactDeck}
                onClick={()=>setCompactDeck(false)}
                title={t('Grouped by type','Kelompokkan tipe')}
              >
                <SquaresFour size={13}/>
                <span>{t('Grouped','Grouped')}</span>
              </button>
              <button
                type="button"
                className={compactDeck?'is-active':''}
                aria-pressed={compactDeck}
                onClick={()=>setCompactDeck(true)}
                title={t('Compact layout','Tata letak ringkas')}
              >
                <Rows size={13}/>
                <span>{t('Compact','Compact')}</span>
              </button>
            </div>
            <button className="button secondary" type="button" onClick={()=>{setDeck({});clearDeckFilters();}} title="Clear all cards from deck">
              <RotateCcw size={14}/>
              <span>{t('Clear all','Hapus semua')}</span>
            </button>
          </div>
        </div>}
        <section className={`deck-board ${compactDeck?'is-compact':''}`}>{leaderCard?<div className="deck-card-group leader-group"><header><span>Leader</span></header><div className="deck-leader-art" onMouseEnter={event=>openHover(leaderCard,event)} onMouseLeave={()=>setHoveredCard(undefined)}><CardArt card={displayArt(leaderCard)}/><button type="button" className="deck-info-action leader-info-action" onClick={event=>openPreview(leaderCard,event.currentTarget)} aria-label={`View ${leaderCard.name} details`}><Info size={13}/></button><button type="button" className="deck-art-choice leader-art-choice" onClick={()=>setArtPicker(leaderCard)} aria-label={`Choose artwork for ${leaderCard.name}`}><Layers3 size={13}/></button></div></div>:<div className="deck-card-group leader-group"><header><span>Leader</span></header><button type="button" className="deck-leader-placeholder" onClick={()=>setLeaderPickerOpen(true)}>{t('Choose a leader','Pilih Leader')}</button></div>}{(compactDeck?[{kind:'Deck',cards:sortedDeckCards,total:filteredCount}]:sortedGrouped).map(group=><div className="deck-card-group" key={group.kind}><header><span>{group.kind==='Deck'?'Deck':`${group.kind}s`}</span><b>{group.total}</b></header><div className="deck-card-row">{group.cards.map(card=>{const count=deck[card.id]??0;return <div key={card.id} className={`deck-card-stack ${count>1?'has-printing-stack':''} ${matchesHighlight(card)?'stat-active':''}`} onMouseEnter={event=>openHover(card,event)} onMouseLeave={()=>setHoveredCard(undefined)}><div className="card-stage printing-stack deck-printing-stack">{Array.from({length:Math.min(count,4)},(_,index)=><div className="stacked-printing" style={{'--stack-index':index} as React.CSSProperties} key={index}>{index===0?<div className="deck-stack-art" title={card.name}><CardArt card={displayArt(card)}/></div>:<CardArt card={displayArt(card)}/>}</div>)}<b>×{count}</b></div><button type="button" className="deck-info-action" onClick={event=>openPreview(card,event.currentTarget)} aria-label={`View ${card.name} details`}><Info size={13}/></button><button type="button" className="deck-art-choice" onClick={event=>{event.stopPropagation();setArtPicker(card)}} aria-label={`Choose artwork for ${card.name}`}><Layers3 size={13}/></button><span className="deck-stack-actions"><button type="button" onClick={event=>{event.stopPropagation();change(card,-1)}} aria-label={`Remove ${card.name}`}><Minus size={13}/></button><button type="button" disabled={count===4||total>=50} onClick={event=>{event.stopPropagation();change(card,1)}} aria-label={`Add ${card.name}`}><Plus size={13}/></button></span></div>;})}</div></div>)}{total>0&&filteredDeckCards.length===0&&<div className="deck-empty-filtered"><p>{t('No cards in your deck match the active filter.','Tidak ada kartu di deck yang cocok dengan filter.')}</p><button type="button" onClick={clearDeckFilters}>{t('Clear filters','Hapus filter')}</button></div>}{!leaderCard&&!loading&&<p className="deck-empty">Choose a leader first. Their colours will shape the cards available to this deck.</p>}{leaderCard&&!grouped.length&&<section className="deck-empty-state"><span>{t('Your deck starts here','Deck kamu dimulai di sini')}</span><h2>{t(`Build ${leaderCard.name} a first list.`,`Buat daftar awal untuk ${leaderCard.name}.`)}</h2><p>{t('Browse cards that match your Leader, or create a balanced 50-card starting list and refine it from there.','Lihat kartu yang cocok dengan Leader ini, atau buat daftar awal 50 kartu yang seimbang lalu sempurnakan.')}</p><div><button type="button" className="deck-empty-browse" onClick={()=>{document.querySelector<HTMLElement>('.builder-search input')?.focus();document.querySelector<HTMLElement>('.builder-catalog')?.scrollIntoView({behavior:'smooth',block:'start'});}}>{t('Browse compatible cards','Lihat kartu yang cocok')}</button><button type="button" className="deck-empty-complete" onClick={completeMetaStyleDeck}><Sparkles size={15}/>{t('Build a starting list','Buat daftar awal')}</button></div></section>}</section>
      </section>
    </div>
    <button type="button" className="mobile-deck-dock" onClick={()=>setMobileDeckOpen(true)} aria-expanded={mobileDeckOpen} aria-controls="mobile-deck-editor"><span><strong>{t('Deck','Deck')} · {total}/50</strong><small>{leaderCard?.name??t('Choose a leader','Pilih Leader')}</small></span><span>{t('Edit deck','Edit deck')} <ChevronUp size={16}/></span></button>
    {preview&&<CardPreviewModal card={preview} origin={previewOrigin} language="EN" cards={cards} context="builder" onClose={()=>{setPreview(undefined);setPreviewOrigin(undefined)}} onNavigate={next=>setPreview(next as DeckCard)}/>} 
    {hoveredCard&&<aside className="deck-hover-preview" style={{left:hoveredCard.left,top:hoveredCard.top}} aria-hidden="true"><CardArt card={hoveredCard.card}/></aside>}
    {artPicker&&<div className="deck-art-backdrop" role="presentation" onMouseDown={()=>setArtPicker(undefined)}><section className="deck-art-picker" role="dialog" aria-modal="true" aria-label={`Choose artwork for ${artPicker.name}`} onMouseDown={event=>event.stopPropagation()}><header><div><span>Choose printing</span><h2>{artPicker.name}</h2></div><button type="button" onClick={()=>setArtPicker(undefined)} aria-label="Close artwork selector"><X size={18}/></button></header><div>{(variantsByIdentity[artPicker.identityId]??[artPicker]).sort((a,b)=>printingRank(a.rarity)-printingRank(b.rarity)||a.code.localeCompare(b.code)).map(printing=><button type="button" key={printing.id} className={displayArt(artPicker).id===printing.id?'selected':''} onClick={()=>chooseArt(printing)}><CardArt card={printing}/></button>)}</div></section></div>}
    {coachOpen&&<aside className="deck-coach-panel" aria-label={t('Deck coach','Deck Coach')}><header><div><span>{t('Deck coach','Deck Coach')}</span><strong>{leaderCard?leaderCard.name:t('Choose a leader to start','Pilih Leader untuk memulai')}</strong></div><button type="button" onClick={()=>setCoachOpen(false)} aria-label={t('Close deck coach','Tutup Deck Coach')}><X size={17}/></button></header><div className="deck-coach-thread" aria-live="polite">{!coachMessages.length&&<div className="deck-coach-empty"><p>{t('Questions review the deck. Only the action below changes it.','Pertanyaan hanya meninjau deck. Hanya aksi di bawah yang mengubahnya.')}</p>{total===0&&<button type="button" className="coach-complete-deck" disabled={!leaderCard} onClick={completeMetaStyleDeck}><Sparkles size={15}/>{t('Complete meta-style deck','Lengkapi deck gaya meta')}</button>}<div>{(language==='ID'?['Tinjau kurva biaya dan keseimbangan counter saya.','Apa yang perlu diubah agar deck ini lebih konsisten?']:['Review my curve and counter balance.','What should I change for a more consistent list?']).map(prompt=><button type="button" key={prompt} onClick={()=>void askCoach(prompt)}>{prompt}</button>)}</div></div>}{coachMessages.map((message,index)=><p className={`coach-message ${message.role}`} key={`${message.role}-${index}`}>{message.content}</p>)}{coachLoading&&<p className="coach-message assistant coach-thinking"><LoaderCircle size={15}/>{t('Reviewing the list…','Meninjau deck…')}</p>}</div><TurnstileField onToken={setCoachTurnstileToken} resetKey={coachTurnstileResetKey}/><form onSubmit={event=>{event.preventDefault();void askCoach();}}><textarea value={coachInput} onChange={event=>setCoachInput(event.target.value)} placeholder={t('Ask about this deck','Tanyakan deck ini')} rows={2}/><button type="submit" disabled={!coachInput.trim()||coachLoading} aria-label={t('Send question','Kirim pertanyaan')}><Send size={16}/></button></form></aside>}
  </main>;
}
