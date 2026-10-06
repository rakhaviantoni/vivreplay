'use client';

import {useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import Link from 'next/link';
import {WishlistButton} from './market-saved';
import {CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, ArrowSquareOutIcon as ExternalLink, PlusIcon as Plus, StorefrontIcon as Store, XIcon as X} from '@phosphor-icons/react';
import type {Card} from '@/packages/card-data/catalog';
import {CardArt} from './card-art';
import {createClient} from '@/utils/supabase/client';
import {CardMarketPanel} from './card-market-panel';
import {CardPrintingSelector,orderPrintings,type CardPrinting} from './card-printing-selector';
import {CardDetailContent, cardIdentityBackground} from './card-detail-content';

type Printing = CardPrinting & {rarity:string|null;set_code:string|null;set_name:string|null;counter_amount:number|null;life:number|null;attribute:string|null;source_payload?:{block?:string|number;block_value?:string|number}|null;tcg_card_assets?:Array<{kind:string;object_key:string}>};
type IdentityRecord={id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string|null};
type PrintingLookup={identity_id:string;tcg_card_identities:IdentityRecord|IdentityRecord[]|null};


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

const ruleWindows=new Set(['rush','blocker','when-attacking','on-play','on-k-o','on-your-opponent-s-attack','activate-main','main','once-per-turn','trigger','your-turn','opponent-s-turn','end-of-your-turn','counter','don']);

function effectWindow(value:string) {
  if (/^don!!\s*x\s*\d+/i.test(value)) return 'don';
  const normalized=value.toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
  // A compound prompt such as "Rush: Character" is still the Rush keyword.
  return normalized.startsWith('rush-') ? 'rush' : normalized;
}

function startsRuleLine(previous:string) {
  return /[.)]\s*(?:\*+)?\s*$/.test(previous);
}

function staysInModifierChain(previous:string, keyword:string) {
  if (keyword!=='once-per-turn'||!/^\[[^\]]+\]$/.test(previous)) return false;
  return ['activate-main','main','don','on-play','when-attacking','on-k-o','on-your-opponent-s-attack','your-turn','opponent-s-turn','end-of-your-turn'].includes(effectWindow(previous.slice(1,-1)));
}

export function EffectText({text}:{text:string}) {
  const parts=text.split(/(\[[^\]]+\]|\([^)]*\))/g);
  return <>{parts.map((part,index)=>{
    const prior=parts[index-1]??'';
    if (index>0&&/^\[[^\]]+\]$/.test(prior)&&ruleWindows.has(effectWindow(prior.slice(1,-1)))&&!/^\[[^\]]+\]$|^\([^)]*\)$/.test(part)) return null;
    if (/^\[[^\]]+\]$/.test(part)) {
      const keyword=effectWindow(part.slice(1,-1));
      if (!ruleWindows.has(keyword)) return <span key={index} className="effect-reference">{part}</span>;
      const previous=parts.slice(0,index).reverse().find(value=>value.trim().length>0)??'';
      // Modifier chains stay together; a new bracketed ability begins a new clause.
      // Text following a prompt stays on its line, e.g. "[Rush: Character] This character...".
      const followsRule=/^\[[^\]]+\]$/.test(previous)&&ruleWindows.has(effectWindow(previous.slice(1,-1)));
      const beginsRuleLine=!staysInModifierChain(previous,keyword)&&startsRuleLine(previous);
      const instruction=parts[index+1]&&!/^\[[^\]]+\]$|^\([^)]*\)$/.test(parts[index+1])?parts[index+1].replace(/^\s+/, ' '):'';
      const colon=instruction.indexOf(':');
      return <span key={index} className="effect-rule-line">{beginsRuleLine&&<br/>}<span className="effect-rule-intro"><span className={`effect-keyword effect-keyword-${keyword}`}>{part.slice(1,-1).replace(/^\*+|\*+$/g,'')}</span>{colon>=0?<strong className="effect-clause">{instruction.slice(0,colon+1)}</strong>:instruction}</span>{colon>=0&&instruction.slice(colon+1)}</span>;
    }
    if (/^\([^)]*\)$/.test(part)) return <span key={index}>{/\.\s*$/.test(parts[index-1]??'')&&<br/>}<em className="effect-reminder">{part}</em></span>;
    if (/^\[[^\]]+\]$/.test(parts[index-1]??'') && ruleWindows.has(effectWindow((parts[index-1]??'').slice(1,-1)))) {
      const instruction=part.replace(/^\s+/, ' ');
      const colon=instruction.indexOf(':');
      if (colon>=0) return <span key={index}><strong className="effect-clause">{instruction.slice(0,colon+1)}</strong>{instruction.slice(colon+1)}</span>;
      return <span key={index}>{instruction}</span>;
    }
    return part;
  })}</>;
}

function splitDisclaimer(text:string) {
  const match=text.match(/(?:\r?\n){1,}\s*(Disclaimer:\s*[\s\S]+)$/i);
  return match ? {effect:text.slice(0,match.index).trim(),disclaimer:match[1].trim()} : {effect:text,disclaimer:null};
}

function cardFromPrinting(card:Card,printing:Printing):Card {
  return {...card,id:printing.id,rarity:printing.rarity??card.rarity,imageUrl:printing.card_image_url??undefined,imageSource:'external',setCode:printing.set_code??card.setCode,language:printing.language,printingCode:printing.printing_code??card.printingCode,assetPath:printing.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key};
}

export function CardPreviewModal({card, origin, language, cards, context='catalog', onClose, onNavigate}:{card:Card;origin?:DOMRect;language:'EN'|'JP';cards:Card[];context?:'catalog'|'builder';onClose:()=>void;onNavigate:(card:Card)=>void}) {
  const [printings,setPrintings]=useState<Printing[]>([]); const [selected,setSelected]=useState(card.id);
  const [resolvedCard,setResolvedCard]=useState<Card>(card);
  const [detailsLoading,setDetailsLoading]=useState(true); const [artLoading,setArtLoading]=useState(false);
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  useEffect(()=>{
    const syncLocale=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail);
    syncLocale();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);
  const id=locale==='ID';
  const hasFlown=useRef(false);const [phase,setPhase]=useState<'flight'|'landed'|'shell'>(origin&&origin.width>=60?'flight':'shell');const [flightStyle,setFlightStyle]=useState<CSSProperties>();const [landingStyle,setLandingStyle]=useState<CSSProperties>();
  useEffect(()=>{setSelected(card.id);setPrintings([]);setResolvedCard(card);setDetailsLoading(true);let active=true;const client=createClient();void (async()=>{try{
    // Market fixtures and imported listings may only retain a printing code. The
    // library supplies a printing UUID, so support both inputs in this shared viewer.
    let {data:lookup}=await client.from('tcg_card_printings').select('identity_id,tcg_card_identities(id,code,name,color,card_type,cost,power,effect_text)').eq('id',card.id).maybeSingle<PrintingLookup>();
    if(!lookup){const code=card.printingCode??card.code;const result=await client.from('tcg_card_printings').select('identity_id,tcg_card_identities(id,code,name,color,card_type,cost,power,effect_text)').eq('language',card.language??language).ilike('printing_code',code).limit(1).maybeSingle<PrintingLookup>();lookup=result.data;}
    if(!lookup||!active)return;
    const identity=Array.isArray(lookup.tcg_card_identities)?lookup.tcg_card_identities[0]:lookup.tcg_card_identities;
    if(identity) setResolvedCard(current=>({...current,id:identity.id,code:identity.code,name:identity.name,color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,effect:identity.effect_text??''}));
    const {data:rows}=await client.from('tcg_card_printings').select('id,language,variant,rarity,set_code,set_name,printing_code,card_image_url,counter_amount,life,attribute,source_payload,tcg_card_assets(kind,object_key)').eq('identity_id',lookup.identity_id).order('language').order('variant');if(active)setPrintings((rows??[]) as Printing[]);
  }finally{if(active)setDetailsLoading(false)}})();return()=>{active=false};},[card,language]);
  const orderedPrintings=useMemo(()=>orderPrintings(printings),[printings]);
  const availablePrintings=useMemo<Printing[]>(()=>orderedPrintings.length?orderedPrintings:[{id:card.id,language:card.language??language,variant:'Standard',printing_code:card.printingCode??card.code,card_image_url:card.imageUrl??null,rarity:card.rarity,set_code:card.setCode??null,set_name:null,counter_amount:null,life:null,attribute:null}], [card,language,orderedPrintings]);
  const active=availablePrintings.find(item=>item.id===selected)??availablePrintings.find(item=>item.language===language)??availablePrintings[0];
  const current:Card=active?cardFromPrinting(resolvedCard,active):resolvedCard;
  // The viewer content belongs to the card identity. Printing choices only replace its artwork.
  const detailPrinting=active??availablePrintings.find(item=>item.language===language);
  const artStack=active?availablePrintings.filter(item=>item.language===active.language&&item.id!==active.id&&item.card_image_url).slice(0,2):[];
  useEffect(()=>{const url=active?.card_image_url;if(!url){setArtLoading(false);return}let mounted=true;setArtLoading(true);const image=new Image();image.onload=image.onerror=()=>{if(mounted)setArtLoading(false)};image.src=url;return()=>{mounted=false}},[active?.id,active?.card_image_url]);
  const effect=splitDisclaimer(resolvedCard.effect||'');
  const languages=useMemo(()=>[...new Set(availablePrintings.map(item=>item.language))],[availablePrintings]); const index=cards.findIndex(item=>item.id===card.id);
  function navigate(amount:number){if(!cards.length)return;onNavigate(cards[(index+amount+cards.length)%cards.length]);}
  useEffect(()=>{function keys(event:KeyboardEvent){if(event.key==='Escape')onClose();if(event.key==='ArrowLeft')navigate(-1);if(event.key==='ArrowRight')navigate(1);}window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys);});
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
  return <div className={`card-viewer-backdrop ${phase==='flight'?'is-flying':''}`} role="presentation" onMouseDown={onClose}>
    {phase==='flight'&&flightStyle&&<div className="viewer-flight-card" aria-hidden="true" style={flightStyle}><CardArt card={current}/></div>}
    {phase==='landed'&&landingStyle&&<div className="viewer-landing-card" aria-hidden="true" style={landingStyle}><CardArt card={current}/></div>}
    {phase!=='flight'&&<>
    <button className="viewer-nav viewer-prev" aria-label={id?'Kartu sebelumnya':'Previous card'} onMouseDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();navigate(-1)}}><ChevronLeft/></button>
    <section className="card-viewer" role="dialog" aria-modal="true" aria-labelledby="card-preview-title" onMouseDown={event=>event.stopPropagation()}>
      <header><div><i className="filter-colour identity-colour" title={resolvedCard.color || undefined} aria-label={resolvedCard.color ? `${resolvedCard.color} color` : undefined} style={{background:cardIdentityBackground(resolvedCard.color)}}/><span>{resolvedCard.code}</span></div><button onClick={onClose} aria-label={id?'Tutup peninjau kartu':'Close card viewer'}><X size={20}/></button></header>
      <div className={`card-viewer-body ${detailsLoading?'is-resolving':''}`}><aside className="viewer-primary-art" aria-busy={detailsLoading||artLoading}><div className={`viewer-art-stack ${artStack.length===0?'is-single':''}`}>{artStack.map((printing,index)=><div key={printing.id} className={`viewer-art-underlay viewer-art-underlay-${index}`} aria-hidden="true"><CardArt card={cardFromPrinting(resolvedCard,printing)} priority/></div>)}<div key={current.id} className="viewer-art-current"><CardArt card={current} priority/></div><div className="viewer-art-skeleton" aria-hidden="true"/></div><p><b>{id?'Versi cetak':'Printing'}</b>{active?.set_code||'-'} · {active?.language||language}</p></aside>
      <div className="viewer-details" aria-busy={detailsLoading}><div className="viewer-detail-skeleton" aria-hidden="true"><i/><i/><span/><span/><span/><b/><b/><b/></div><CardDetailContent code={resolvedCard.code} color={resolvedCard.color} title={resolvedCard.name} titleId="card-preview-title" heading="h2" type={resolvedCard.type} rarity={detailPrinting?.rarity||resolvedCard.rarity} attribute={detailPrinting?.attribute} cost={resolvedCard.cost} power={resolvedCard.power} life={detailPrinting?.life} block={block} setCode={detailPrinting?.set_code} setName={detailPrinting?.set_name} hasEffect={Boolean(effect.effect.trim())} effect={<>{effect.effect&&<p><EffectText text={effect.effect}/></p>}{effect.disclaimer&&<p className="effect-disclaimer">{effect.disclaimer}</p>}</>}/><CardPrintingSelector printings={availablePrintings} language={active?.language??language} selectedId={active?.id} onLanguageChange={nextLanguage=>setSelected(availablePrintings.find(printing=>printing.language===nextLanguage&&printing.card_image_url)?.id??selected)} onSelect={setSelected} vaultCard={resolvedCard} renderCard={item=><CardArt card={cardFromPrinting(resolvedCard,item)}/>}/>{active?.language==='JP'&&<CardMarketPanel printingId={active.id}/> }<div className="viewer-actions"><WishlistButton printingId={active?.id??''} language={id?'ID':'EN'}/>{context!=='builder'&&<Link className="button" href={`/decks/builder?card=${active?.id??card.id}`}><Plus size={16}/>{id?'Susun dengan kartu ini':'Build with card'}</Link>}<Link className={context==='builder'?'button':'button secondary'} href={`/cards/${resolvedCard.code}?lang=${active?.language??language}`}><ExternalLink size={16}/>{id?'Buka halaman kartu':'Open card page'}</Link><Link className="button secondary" href={`/market?card=${resolvedCard.code}`}><Store size={16}/>{id?'Cari di Market':'Find listings'}</Link><Link className="button secondary" href={`/market?sell=${active?.id??card.id}`}><Store size={16}/>{id?'Jual kartu ini':'Sell a copy'}</Link></div><span className="sr-only" role="status">{detailsLoading||artLoading?(id?'Memuat rincian kartu':'Loading card details'):''}</span></div></div>
    </section>
    <button className="viewer-nav viewer-next" aria-label={id?'Kartu berikutnya':'Next card'} onMouseDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();navigate(1)}}><ChevronRight/></button>
    </>}
  </div>;
}
