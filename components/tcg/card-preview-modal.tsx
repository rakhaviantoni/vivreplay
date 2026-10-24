'use client';

import {useRouteLocale} from '@/components/locale-provider';
import {useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import Link from '@/components/ui/localized-link';
import {WishlistButton} from './market-saved';
import {ShareButton} from './share';
import {CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, ArrowSquareOutIcon as ExternalLink, PlusIcon as Plus, StorefrontIcon as Store, XIcon as X} from '@phosphor-icons/react';
import type {Card} from '@/packages/card-data/catalog';
import {CardArt} from './card-art';
import {CardMarketPanel} from './card-market-panel';
import {CardPrintingSelector,orderPrintings,type CardPrinting} from './card-printing-selector';
import {CardDetailContent, cardIdentityBackground} from './card-detail-content';
import {EffectText} from './effect-text';
import {MarketSellAction} from './market-sell-action';
export {EffectText} from './effect-text';

type Printing = CardPrinting & {rarity:string|null;set_code:string|null;set_name:string|null;counter_amount:number|null;life:number|null;attribute:string|null;source_payload?:{block?:string|number;block_value?:string|number}|null;tcg_card_assets?:Array<{kind:string;object_key:string}>};
type IdentityRecord={id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string|null};


function blockForSet(code:string,payload?:{block?:string|number;block_value?:string|number}|null){
  const direct=payload?.block_value??payload?.block;
  if(direct!==undefined&&direct!==null&&String(direct).trim()) return String(direct).toUpperCase();
  const match=code.toUpperCase().match(/^(OP|EB|ST|PRB)[-_ ]?0*(\d+)/);
  if(!match) return 'X';
  const number=Number(match[2]);
  if(match[1]==='OP') return String(Math.min(5,Math.max(1,Math.ceil(number/4))));
  if(match[1]==='EB') return String(Math.min(5,Math.max(1,Math.ceil((number+1)/2)+1)));
  if(match[1]==='ST') return number>=28?'5':number>=20?'4':number>=11?'3':number>=5?'2':'1';
  return number>=2?'5':'4';
}

function splitDisclaimer(text:string) {
  const match=text.match(/(?:\r?\n){1,}\s*(Disclaimer:\s*[\s\S]+)$/i);
  return match ? {effect:text.slice(0,match.index).trim(),disclaimer:match[1].trim()} : {effect:text,disclaimer:null};
}

function cardFromPrinting(card:Card,printing:Printing):Card {
  return {...card,id:printing.id,rarity:printing.rarity??card.rarity,imageUrl:printing.card_image_url??undefined,imageSource:'external',setCode:printing.set_code??card.setCode,language:printing.language,printingCode:printing.printing_code??card.printingCode,assetPath:printing.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key};
}

export function CardPreviewModal({card, origin, language, cards, printingIds, initialPrintingId, context='catalog', marketActions=true, onClose, onNavigate}:{card:Card;origin?:DOMRect;language:'EN'|'JP';cards:Card[];printingIds?:string[];initialPrintingId?:string;context?:'catalog'|'builder';marketActions?:boolean;onClose:()=>void;onNavigate:(card:Card,index:number)=>void}) {
  const [printings,setPrintings]=useState<Printing[]>([]); const [selected,setSelected]=useState(initialPrintingId??card.id);
  const [resolvedCard,setResolvedCard]=useState<Card>(card);
  const [detailsLoading,setDetailsLoading]=useState(true); const [artLoading,setArtLoading]=useState(false);
  const [locale,setLocale]=useState<'EN'|'ID'>(useRouteLocale());
  useEffect(()=>{
    const previousHtmlOverflow=document.documentElement.style.overflow;
    const previousBodyOverflow=document.body.style.overflow;
    document.documentElement.style.overflow='hidden';
    document.body.style.overflow='hidden';
    return()=>{document.documentElement.style.overflow=previousHtmlOverflow;document.body.style.overflow=previousBodyOverflow};
  },[]);
  useEffect(()=>{
    const syncLocale=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail);
    syncLocale();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);
  const id=locale==='ID';
  const hasFlown=useRef(false);const [phase,setPhase]=useState<'flight'|'landed'|'shell'>(origin&&origin.width>=60?'flight':'shell');const [flightStyle,setFlightStyle]=useState<CSSProperties>();const [landingStyle,setLandingStyle]=useState<CSSProperties>();
  useEffect(()=>{setSelected(initialPrintingId??card.id);setPrintings([]);setResolvedCard(card);setDetailsLoading(true);let active=true;void fetch(`/api/cards/${encodeURIComponent(card.code)}`,{cache:'force-cache'}).then(async response=>{if(!response.ok)throw new Error('Card details unavailable');return response.json() as Promise<{identity:IdentityRecord;printings:Printing[]}>}).then(payload=>{if(!active)return;const identity=payload.identity;if(identity)setResolvedCard(current=>({...current,id:identity.id,code:identity.code,name:identity.name,color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,effect:identity.effect_text??''}));setPrintings(payload.printings??[])}).catch(()=>{if(active)setPrintings([])}).finally(()=>{if(active)setDetailsLoading(false)});return()=>{active=false}},[card,initialPrintingId]);
  const orderedPrintings=useMemo(()=>orderPrintings(printings),[printings]);
  const availablePrintings=useMemo<Printing[]>(()=>orderedPrintings.length?orderedPrintings:[{id:card.id,language:card.language??language,variant:'Standard',printing_code:card.printingCode??card.code,card_image_url:card.imageUrl??null,rarity:card.rarity,set_code:card.setCode??null,set_name:null,counter_amount:null,life:null,attribute:null}], [card,language,orderedPrintings]);
  const exactCode=card.printingCode?.toLowerCase();
  const active=availablePrintings.find(item=>item.id===selected)??(exactCode?availablePrintings.find(item=>item.printing_code?.toLowerCase()===exactCode):undefined)??availablePrintings.find(item=>item.language===language)??availablePrintings[0];
  const current:Card=active?cardFromPrinting(resolvedCard,active):resolvedCard;
  // The viewer content belongs to the card identity. Printing choices only replace its artwork.
  const detailPrinting=active??availablePrintings.find(item=>item.language===language);
  const artStack=active?availablePrintings.filter(item=>item.language===active.language&&item.id!==active.id&&item.card_image_url).slice(0,2):[];
  useEffect(()=>{const url=active?.card_image_url;if(!url){setArtLoading(false);return}let mounted=true;setArtLoading(true);const image=new Image();image.onload=image.onerror=()=>{if(mounted)setArtLoading(false)};image.src=url;return()=>{mounted=false}},[active?.id,active?.card_image_url]);
  const effect=splitDisclaimer(resolvedCard.effect||'');
  const languages=useMemo(()=>[...new Set(availablePrintings.map(item=>item.language))],[availablePrintings]); const printingIndex=printingIds?.findIndex(id=>id===selected)??-1; const index=printingIndex>=0?printingIndex:cards.findIndex(item=>item.id===card.id);
  function navigate(amount:number){if(cards.length<2)return;const nextIndex=(Math.max(0,index)+amount+cards.length)%cards.length;onNavigate(cards[nextIndex],nextIndex);}
  useEffect(()=>{function keys(event:KeyboardEvent){if(event.key==='Escape')onClose();if(cards.length>1&&event.key==='ArrowLeft')navigate(-1);if(cards.length>1&&event.key==='ArrowRight')navigate(1);}window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys);});
  useLayoutEffect(()=>{
    if(!origin||origin.width<60||hasFlown.current){setPhase('shell');return}
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){hasFlown.current=true;setPhase('shell');return}
    const modalWidth=Math.min(1180,window.innerWidth-176);
    const targetWidth=Math.min(360,Math.max(230,modalWidth*.305));
    const targetLeft=(window.innerWidth-modalWidth)/2+30;
    const shellHeight=Math.min(820,window.innerHeight-64);
    const targetTop=(window.innerHeight-shellHeight)/2+88;
    hasFlown.current=true;
    const sourceWidth=Math.max(42,origin.width);
    const sourceHeight=sourceWidth*580/420;
    const sourceLeft=origin.left+origin.width/2-sourceWidth/2;
    const sourceTop=origin.top+origin.height/2-sourceHeight/2;
    const scale=targetWidth/sourceWidth;
    setFlightStyle({left:sourceLeft,top:sourceTop,width:sourceWidth,height:sourceHeight,'--flight-x':`${targetLeft-sourceLeft}px`,'--flight-y':`${targetTop-sourceTop}px`,'--flight-scale':String(scale)} as CSSProperties);
    setLandingStyle({left:targetLeft,top:targetTop,width:targetWidth,height:targetWidth*580/420} as CSSProperties);
    const landed=window.setTimeout(()=>{setPhase('landed');setFlightStyle(undefined)},470);
    const complete=window.setTimeout(()=>{setPhase('shell');setLandingStyle(undefined)},870);
    return()=>{window.clearTimeout(landed);window.clearTimeout(complete)}
  },[origin]);
  const block=blockForSet(active?.set_code??resolvedCard.code,active?.source_payload);
  const viewer=<div className={`card-viewer-backdrop ${phase==='flight'?'is-flying':''}`} role="presentation" onMouseDown={onClose}>
    {phase==='flight'&&flightStyle&&<div className="viewer-flight-card" aria-hidden="true" style={flightStyle}><CardArt card={current}/></div>}
    {phase==='landed'&&landingStyle&&<div className="viewer-landing-card" aria-hidden="true" style={landingStyle}><CardArt card={current}/></div>}
    {phase!=='flight'&&<>
    {cards.length>1&&<button className="viewer-nav viewer-prev" aria-label={id?'Kartu sebelumnya':'Previous card'} onMouseDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();navigate(-1)}}><ChevronLeft/></button>}
    <section className="card-viewer" role="dialog" aria-modal="true" aria-labelledby="card-preview-title" onMouseDown={event=>event.stopPropagation()}>
      <header><div><i className="filter-colour identity-colour" title={resolvedCard.color || undefined} aria-label={resolvedCard.color ? `${resolvedCard.color} color` : undefined} style={{background:cardIdentityBackground(resolvedCard.color)}}/><span>{resolvedCard.code}</span></div><button onClick={onClose} aria-label={id?'Tutup peninjau kartu':'Close card viewer'}><X size={20}/></button></header>
      <div className={`card-viewer-body ${detailsLoading?'is-resolving':''}`}><aside className="viewer-primary-art" aria-busy={detailsLoading||artLoading}><div className={`viewer-art-stack ${artStack.length===0?'is-single':''}`}>{artStack.map((printing,index)=><div key={printing.id} className={`viewer-art-underlay viewer-art-underlay-${index}`} aria-hidden="true"><CardArt card={cardFromPrinting(resolvedCard,printing)} priority/></div>)}<div key={current.id} className="viewer-art-current"><CardArt card={current} priority/></div><div className="viewer-art-skeleton" aria-hidden="true"/></div><p><b>{id?'Versi cetak':'Printing'}</b><span>{active?.set_code||'-'}</span><span>{active?.language||language}</span></p></aside>
      <div className="viewer-details" aria-busy={detailsLoading}><div className="viewer-detail-skeleton" aria-hidden="true"><i/><i/><span/><span/><span/><b/><b/><b/></div><CardDetailContent code={resolvedCard.code} color={resolvedCard.color} title={resolvedCard.name} titleId="card-preview-title" heading="h2" type={resolvedCard.type} rarity={detailPrinting?.rarity||resolvedCard.rarity} attribute={detailPrinting?.attribute} cost={resolvedCard.cost} power={resolvedCard.power} life={detailPrinting?.life} block={block} setCode={detailPrinting?.set_code} setName={detailPrinting?.set_name} hasEffect={Boolean(effect.effect.trim())} effect={<>{effect.effect&&<p><EffectText text={effect.effect}/></p>}{effect.disclaimer&&<p className="effect-disclaimer">{effect.disclaimer}</p>}</>}/><CardPrintingSelector printings={availablePrintings} language={active?.language??language} selectedId={active?.id} onLanguageChange={nextLanguage=>setSelected(availablePrintings.find(printing=>printing.language===nextLanguage&&printing.card_image_url)?.id??selected)} onSelect={setSelected} vaultCard={resolvedCard} renderCard={item=><CardArt card={cardFromPrinting(resolvedCard,item)}/>}/>{active&&<CardMarketPanel printingId={active.id} printing={{language:active.language,setCode:active.set_code??undefined,printingCode:active.printing_code??undefined,variant:active.variant??undefined}}/>}<div className="viewer-actions">{marketActions&&<WishlistButton printingId={active?.id??''} language={id?'ID':'EN'}/>}{marketActions&&<ShareButton title={resolvedCard.name} path={`/cards?card=${encodeURIComponent(resolvedCard.code)}&printing=${encodeURIComponent(active?.id??card.id)}&lang=${active?.language??language}`} card={detailPrinting?cardFromPrinting(resolvedCard,detailPrinting):resolvedCard} cardDetails={{gameLabel:'ONE PIECE CARD GAME',language:active?.language??language,setName:detailPrinting?.set_name??undefined,setCode:detailPrinting?.set_code??undefined,number:detailPrinting?.printing_code??resolvedCard.code,rarity:detailPrinting?.rarity??undefined}} entityType="card"/>}{context!=='builder'&&<Link className="button" href={`/decks/builder?card=${active?.id??card.id}`}><Plus size={16}/>{id?'Susun dengan kartu ini':'Build with card'}</Link>}<Link className={`${context==='builder'?'button':'button secondary'}`} href={`/cards/${resolvedCard.code}?lang=${active?.language??language}`}><ExternalLink size={16}/>{id?'Buka halaman kartu':'Open card page'}</Link>{marketActions&&<div className="viewer-market-actions"><Link className="button secondary" href={`/market?card=${resolvedCard.code}`}><Store size={16}/>{id?'Beli kartu':'Buy a copy'}</Link><MarketSellAction className="button secondary" printingId={active?.id??card.id}><Store size={16}/>{id?'Jual kartu ini':'Sell a copy'}</MarketSellAction></div>}</div><span className="sr-only" role="status">{detailsLoading||artLoading?(id?'Memuat rincian kartu':'Loading card details'):''}</span></div></div>
    </section>
    {cards.length>1&&<button className="viewer-nav viewer-next" aria-label={id?'Kartu berikutnya':'Next card'} onMouseDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();navigate(1)}}><ChevronRight/></button>}
    </>}
  </div>;
  return typeof document==='undefined'?null:createPortal(viewer,document.body);
}
