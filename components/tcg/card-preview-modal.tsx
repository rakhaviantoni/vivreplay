'use client';

import {useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import Link from 'next/link';
import {CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, ArrowSquareOutIcon as ExternalLink, PlusIcon as Plus, StorefrontIcon as Store, XIcon as X} from '@phosphor-icons/react';
import type {Card} from '@/packages/card-data/catalog';
import {CardArt} from './card-art';
import {BlockValue} from './block-value';
import {SetInformation} from './set-information';
import {createClient} from '@/utils/supabase/client';

type Printing = {id:string;language:string;variant:string|null;rarity:string|null;set_code:string|null;set_name:string|null;printing_code:string|null;card_image_url:string|null;counter_amount:number|null;life:number|null;attribute:string|null;source_payload?:{block?:string|number;block_value?:string|number}|null;tcg_card_assets?:Array<{kind:string;object_key:string}>};


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

function printingLabel(variant:string|null) {
  if (!variant) return 'Standard';
  const cleaned=variant.replace(/(?:^|[\s·,/_-])p\d+(?=$|[\s·,/_-])/ig,'').replace(/[·,/_-]+\s*$/,'').trim();
  return cleaned || 'Alt art';
}

function printingOrder(variant:string|null) {
  const label=printingLabel(variant).toLowerCase();
  if (label==='standard' || label==='base') return 0;
  return 1;
}

function cardFromPrinting(card:Card,printing:Printing):Card {
  return {...card,id:printing.id,rarity:printing.rarity??card.rarity,imageUrl:printing.card_image_url??undefined,imageSource:'external',setCode:printing.set_code??card.setCode,language:printing.language,printingCode:printing.printing_code??card.printingCode,assetPath:printing.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key};
}

export function CardPreviewModal({card, origin, language, cards, onClose, onNavigate}:{card:Card;origin?:DOMRect;language:'EN'|'JP';cards:Card[];onClose:()=>void;onNavigate:(card:Card)=>void}) {
  const [printings,setPrintings]=useState<Printing[]>([]); const [selected,setSelected]=useState(card.id);
  const [detailsLoading,setDetailsLoading]=useState(true); const [artLoading,setArtLoading]=useState(false);
  const [previousArt,setPreviousArt]=useState<Card|null>(null); const artRef=useRef<Card|null>(null);
  const hasFlown=useRef(false);const [phase,setPhase]=useState<'flight'|'landed'|'shell'>(origin?'flight':'shell');const [flightStyle,setFlightStyle]=useState<CSSProperties>();const [landingStyle,setLandingStyle]=useState<CSSProperties>();
  useEffect(()=>{setSelected(card.id);setPrintings([]);setDetailsLoading(true);let active=true;const client=createClient();void (async()=>{try{const {data}=await client.from('tcg_card_printings').select('identity_id').eq('id',card.id).maybeSingle();if(!data||!active)return;const {data:rows}=await client.from('tcg_card_printings').select('id,language,variant,rarity,set_code,set_name,printing_code,card_image_url,counter_amount,life,attribute,source_payload,tcg_card_assets(kind,object_key)').eq('identity_id',data.identity_id).order('language').order('variant');if(active)setPrintings((rows??[]) as Printing[]);}finally{if(active)setDetailsLoading(false)}})();return()=>{active=false};},[card.id]);
  const orderedPrintings=useMemo(()=>[...printings].sort((a,b)=>printingOrder(a.variant)-printingOrder(b.variant)||printingLabel(a.variant).localeCompare(printingLabel(b.variant))),[printings]);
  const active=orderedPrintings.find(item=>item.id===selected)??orderedPrintings.find(item=>item.language===language)??orderedPrintings[0];
  const current:Card=active?cardFromPrinting(card,active):card;
  const artStack=active?orderedPrintings.filter(item=>item.language===active.language&&item.id!==active.id&&item.card_image_url).slice(0,2):[];
  useEffect(()=>{
    const prior=artRef.current;
    if(prior&&prior.id!==current.id){
      setPreviousArt(prior);
      const clear=window.setTimeout(()=>setPreviousArt(null),420);
      artRef.current=current;
      return()=>window.clearTimeout(clear);
    }
    artRef.current=current;
  },[current.id]);
  useEffect(()=>{const url=active?.card_image_url;if(!url){setArtLoading(false);return}let mounted=true;setArtLoading(true);const image=new Image();image.onload=image.onerror=()=>{if(mounted)setArtLoading(false)};image.src=url;return()=>{mounted=false}},[active?.id,active?.card_image_url]);
  const effect=splitDisclaimer(card.effect||'');
  const languages=useMemo(()=>[...new Set(orderedPrintings.map(item=>item.language))],[orderedPrintings]); const index=cards.findIndex(item=>item.id===card.id);
  function navigate(amount:number){if(!cards.length)return;onNavigate(cards[(index+amount+cards.length)%cards.length]);}
  useEffect(()=>{function keys(event:KeyboardEvent){if(event.key==='Escape')onClose();if(event.key==='ArrowLeft')navigate(-1);if(event.key==='ArrowRight')navigate(1);}window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys);});
  useLayoutEffect(()=>{
    if(!origin||hasFlown.current){setPhase('shell');return}
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){hasFlown.current=true;setPhase('shell');return}
    const modalWidth=Math.min(1180,window.innerWidth-176);
    const targetWidth=Math.min(360,Math.max(230,modalWidth*.305));
    const targetLeft=(window.innerWidth-modalWidth)/2+30;
    const shellHeight=Math.min(820,window.innerHeight-64);
    const targetTop=(window.innerHeight-shellHeight)/2+88;
    hasFlown.current=true;
    const scale=targetWidth/origin.width;
    setFlightStyle({left:origin.left,top:origin.top,width:origin.width,height:origin.height,'--flight-x':`${targetLeft-origin.left}px`,'--flight-y':`${targetTop-origin.top}px`,'--flight-scale':String(scale)} as CSSProperties);
    setLandingStyle({left:targetLeft,top:targetTop,width:targetWidth,height:origin.height*scale} as CSSProperties);
    const landed=window.setTimeout(()=>{setPhase('landed');setFlightStyle(undefined)},470);
    const complete=window.setTimeout(()=>{setPhase('shell');setLandingStyle(undefined)},870);
    return()=>{window.clearTimeout(landed);window.clearTimeout(complete)}
  },[origin]);
  const block=blockForSet(active?.set_code??card.code,active?.source_payload);
  return <div className={`card-viewer-backdrop ${phase==='flight'?'is-flying':''}`} role="presentation" onMouseDown={onClose}>
    {phase==='flight'&&flightStyle&&<div className="viewer-flight-card" aria-hidden="true" style={flightStyle}><CardArt card={current}/></div>}
    {phase==='landed'&&landingStyle&&<div className="viewer-landing-card" aria-hidden="true" style={landingStyle}><CardArt card={current}/></div>}
    {phase!=='flight'&&<>
    <button className="viewer-nav viewer-prev" aria-label="Previous card" onMouseDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();navigate(-1)}}><ChevronLeft/></button>
    <section className="card-viewer" role="dialog" aria-modal="true" aria-labelledby="card-preview-title" onMouseDown={event=>event.stopPropagation()}>
      <header><div><span>{card.code}</span></div><button onClick={onClose} aria-label="Close card viewer"><X size={20}/></button></header>
      <div className={`card-viewer-body ${detailsLoading?'is-resolving':''}`}><aside className="viewer-primary-art" aria-busy={detailsLoading||artLoading}><div className="viewer-art-stack">{artStack.map((printing,index)=><div key={printing.id} className={`viewer-art-underlay viewer-art-underlay-${index}`} aria-hidden="true"><CardArt card={cardFromPrinting(card,printing)}/></div>)}{previousArt&&<div className="viewer-art-previous" aria-hidden="true"><CardArt card={previousArt}/></div>}<div key={current.id} className="viewer-art-current"><CardArt card={current}/></div></div><div className="viewer-art-skeleton" aria-hidden="true"/><p><b>Printing</b>{active?.set_code||'—'} · {active?.language||language}</p></aside>
      <div className="viewer-details" aria-busy={detailsLoading}><div className="viewer-detail-skeleton" aria-hidden="true"><i/><i/><span/><span/><span/><b/><b/><b/></div><h2 id="card-preview-title">{card.name}</h2><p className="viewer-kind">{card.type} <span>·</span> {active?.rarity||card.rarity} {active?.attribute&&<><span>·</span>{active.attribute}</>}</p><div className="viewer-stats">{card.type!=='Leader'&&<div><dt>Cost</dt><dd>{card.cost}</dd></div>}<div><dt>Power</dt><dd>{card.power?card.power.toLocaleString():'—'}</dd></div>{active?.life!==null&&active?.life!==undefined&&<div><dt>Life</dt><dd>{active.life}</dd></div>}<div><dt>Block</dt><dd><BlockValue value={block}/></dd></div><SetInformation compact setCode={active?.set_code} fallbackName={active?.set_name}/></div><section className="viewer-effect"><h3>Effect</h3><p>{effect.effect?<EffectText text={effect.effect}/>: 'No effect text is available for this identity.'}</p>{effect.disclaimer&&<p className="effect-disclaimer">{effect.disclaimer}</p>}</section><section className="viewer-printings"><div className="printing-title"><h3>Printings</h3><div>{languages.map(item=><button key={item} className={active?.language===item?'active':''} onClick={()=>setSelected(orderedPrintings.find(printing=>printing.language===item&&printing.card_image_url)?.id??selected)}>{item}</button>)}</div></div><div className="printing-strip">{[...new Map(orderedPrintings.filter(item=>(!active||item.language===active.language)&&item.card_image_url).map(item=>[item.printing_code??item.id,item])).values()].map(item=>{const thumbnail:Card={...card,id:item.id,rarity:item.rarity??'',imageUrl:item.card_image_url??undefined,imageSource:'external',setCode:item.set_code??card.setCode,language:item.language,printingCode:item.printing_code??card.printingCode,assetPath:item.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key};return <button key={item.id} className={item.id===active?.id?'selected':''} onClick={()=>setSelected(item.id)}><CardArt card={thumbnail}/><span>{printingLabel(item.variant)}</span></button>})}</div></section><div className="viewer-actions"><Link className="button" href={`/decks/builder?card=${card.id}`}><Plus size={16}/>Add to deck</Link><Link className="button secondary" href={`/market?sell=${active?.id??card.id}`}><Store size={16}/>Sell this card</Link><Link className="button secondary" href={`/cards/${card.code}?lang=${active?.language??language}`}><ExternalLink size={16}/>Open card page</Link></div><span className="sr-only" role="status">{detailsLoading||artLoading?'Loading card details':''}</span></div></div>
    </section>
    <button className="viewer-nav viewer-next" aria-label="Next card" onMouseDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();navigate(1)}}><ChevronRight/></button>
    </>}
  </div>;
}
