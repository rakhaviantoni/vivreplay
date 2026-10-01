'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowLeftIcon as ArrowLeft, StackIcon as Layers3, StorefrontIcon as Store, QuestionIcon as Question, ArrowSquareOutIcon as ArrowSquareOut, BugIcon as Bug} from '@phosphor-icons/react';
import {CardArt} from './card-art';
import {EffectText} from './card-preview-modal';
import {displayCardName} from './card-name';
import {CardMarketPanel} from './card-market-panel';
import {CardPrintingSelector,orderPrintings,uniquePrintings,type CardPrinting} from './card-printing-selector';
import {CardDetailContent} from './card-detail-content';
import type {Card} from '@/packages/card-data/catalog';

type Identity={id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string};
type Printing=CardPrinting & {rarity:string|null;set_code:string|null;set_name:string|null;counter_amount:number|null;attribute:string|null;life:number|null;sub_types:string[]|null;source_payload?:{block?:string|number;block_value?:string|number}|null;tcg_card_assets?:Array<{kind:string;object_key:string}>};
type Ruling={id:string;printing_id:string|null;language:string;question:string;answer:string;source_url:string;source_reference:string|null;published_at:string|null};
function blockForSet(code:string,payload?:{block?:string|number;block_value?:string|number}|null){const direct=payload?.block_value??payload?.block;if(direct!==undefined&&direct!==null&&String(direct).trim())return String(direct).toUpperCase();const match=code.toUpperCase().match(/^(OP|EB|ST|PRB)[-_ ]?0*(\d+)/);if(!match)return 'X';const number=Number(match[2]);if(match[1]==='OP')return String(Math.min(5,Math.max(1,Math.ceil(number/4))));if(match[1]==='EB')return String(Math.min(5,Math.max(1,Math.ceil((number+1)/2)+1)));if(match[1]==='ST')return number>=28?'5':number>=20?'4':number>=11?'3':number>=5?'2':'1';return number>=2?'5':'4'}

export function LiveCardDetail({code,initialLanguage}:{code:string;initialLanguage:string}){
 const [identity,setIdentity]=useState<Identity>(); const [printings,setPrintings]=useState<Printing[]>([]); const [rulings,setRulings]=useState<Ruling[]>([]); const [language,setLanguage]=useState(initialLanguage==='JP'?'JP':'EN');
 const [loadState,setLoadState]=useState<'loading'|'ready'|'missing'|'error'>('loading');
 const [locale,setLocale]=useState<'EN'|'ID'>('EN');
 useEffect(()=>{
   const syncLocale=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
   const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail);
   syncLocale();
   window.addEventListener('vivreplay:locale',onLocale);
   return()=>window.removeEventListener('vivreplay:locale',onLocale);
 },[]);
 const id=locale==='ID';
 const loadCard=useCallback(async(signal?:AbortSignal)=>{
   try{
     const response=await fetch(`/api/cards/${encodeURIComponent(code)}`,{signal,cache:'no-store'});
     if(response.status===404){setIdentity(undefined);setPrintings([]);setRulings([]);setLoadState('missing');return;}
     if(!response.ok)throw new Error('Card details could not be loaded.');
     const payload=await response.json() as {identity:Identity;printings:Printing[];rulings:Ruling[]};
     const rows=payload.printings??[];
     if(!rows.length){setIdentity(payload.identity);setPrintings([]);setRulings(payload.rulings??[]);setLoadState('missing');return;}
     setIdentity(payload.identity);setPrintings(rows);setRulings(payload.rulings??[]);
     const preferred=initialLanguage==='JP'?'JP':'EN';
     if(!rows.some(row=>row.language===preferred))setLanguage(rows[0].language==='JP'?'JP':'EN');
     setLoadState('ready');
   }catch(error){if(error instanceof Error&&error.name==='AbortError')return;setLoadState('error');}
 },[code,initialLanguage]);
 useEffect(()=>{
   const controller=new AbortController();let active=true;
   fetch(`/api/cards/${encodeURIComponent(code)}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{
     if(!active)return;
     if(response.status===404){setIdentity(undefined);setPrintings([]);setRulings([]);setLoadState('missing');return;}
     if(!response.ok)throw new Error('Card details could not be loaded.');
     const payload=await response.json() as {identity:Identity;printings:Printing[];rulings:Ruling[]};
     if(!active)return;
     const rows=payload.printings??[];
     if(!rows.length){setIdentity(payload.identity);setPrintings([]);setRulings(payload.rulings??[]);setLoadState('missing');return;}
     setIdentity(payload.identity);setPrintings(rows);setRulings(payload.rulings??[]);
     const preferred=initialLanguage==='JP'?'JP':'EN';
     if(!rows.some(row=>row.language===preferred))setLanguage(rows[0].language==='JP'?'JP':'EN');
     setLoadState('ready');
   }).catch(error=>{if(active&&!(error instanceof Error&&error.name==='AbortError'))setLoadState('error')});
   return()=>{active=false;controller.abort()};
 },[code,initialLanguage]);
 const available=useMemo(()=>uniquePrintings(orderPrintings(printings.filter(p=>p.language===language))),[printings,language]); const [selected,setSelected]=useState<string>();
 const printing=available.find(p=>p.id===selected)??available[0];
 const card=identity&&printing?{id:printing.id,code:identity.code,name:displayCardName(identity.name,identity.code),color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:printing.rarity??'',art:0,effect:identity.effect_text,imageUrl:printing.card_image_url??undefined,imageSource:'external' as const,setCode:printing.set_code??undefined,language:printing.language,printingCode:printing.printing_code??undefined,assetPath:printing.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key}:undefined;
 if(!identity||!card){
   const title=loadState==='missing'?(id?'Kartu tidak ditemukan':'Card not found'):loadState==='error'?(id?'Rincian kartu tidak tersedia':'Card details are unavailable'):'';
   const message=loadState==='missing'?(id?'Kode ini belum ada di katalog kartu.':'This code is not in the card catalog yet.'):loadState==='error'?(id?'Koneksi ke katalog kartu gagal. Coba lagi.':'The card catalog could not be reached. Try again.'):'';
   return <main className={`page live-card-detail ${loadState==='loading'?'is-loading':''}`}><Link className="back-link" href="/cards"><ArrowLeft size={16}/>{id?'Kembali ke katalog kartu':'Back to card library'}</Link>{loadState==='loading'?<div className="live-detail-layout is-resolving"><section className="live-detail-art viewer-primary-art" aria-busy="true"><div className="viewer-art-stack" style={{minHeight:'380px',position:'relative'}}><div className="viewer-art-skeleton" aria-hidden="true" style={{opacity:1,display:'block'}}/></div><p><b>{id?'Versi cetak':'Printing'}</b>- · {language}</p></section><section className="live-detail-copy viewer-details" aria-busy="true"><div className="viewer-detail-skeleton" aria-hidden="true"><i/><i/><span/><span/><span/><b/><b/><b/></div><span className="sr-only" role="status">{id?'Memuat rincian kartu':'Loading card details'}</span></section></div>:<section className="empty-state card-detail-load-error" role="status"><h1>{title}</h1><p>{message}</p>{loadState==='error'&&<button className="button" type="button" onClick={()=>{setLoadState('loading');void loadCard()}}>{id?'Coba lagi':'Try again'}</button>}<Link className="button secondary" href="/cards">{id?'Buka katalog kartu':'Open card library'}</Link></section>}</main>;
 }
 const block=blockForSet(printing?.set_code??identity.code,printing?.source_payload);
 const visibleRulings=rulings.filter(item=>item.language===language&&(item.printing_id===null||item.printing_id===printing?.id));
 const artStack=available.filter(item=>item.id!==printing?.id&&item.card_image_url).slice(0,2);
 const marketPrinting=printing?.language==='JP'?printing:undefined;
  return <main className="page live-card-detail"><Link className="back-link" href="/cards"><ArrowLeft size={16}/>{id?'Kembali ke katalog kartu':'Back to card library'}</Link><div className="live-detail-layout"><section className="live-detail-art viewer-primary-art"><div className="viewer-art-stack">{artStack.map((item,index)=><div key={item.id} className={`viewer-art-underlay viewer-art-underlay-${index}`} aria-hidden="true"><CardArt card={{...card,id:item.id,imageUrl:item.card_image_url??undefined,setCode:item.set_code??undefined,language:item.language,printingCode:item.printing_code??undefined,assetPath:item.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key}}/></div>)}<div key={printing?.id} className="viewer-art-current"><CardArt card={card}/></div></div><p><b>{id?'Versi cetak':'Printing'}</b>{printing?.set_code||(id?'Set belum ditentukan':'Unassigned set')} · {language}</p></section><section className="live-detail-copy"><CardDetailContent code={identity.code} color={identity.color} title={displayCardName(identity.name,identity.code)} heading="h1" type={identity.card_type} rarity={printing?.rarity} attribute={printing?.attribute} cost={identity.cost} power={identity.power} life={printing?.life} block={block} setCode={printing?.set_code} setName={printing?.set_name} effect={<p>{identity.effect_text?<EffectText text={identity.effect_text}/>:(id?'Belum ada teks efek untuk versi cetak ini.':'No effect text is available for this printing yet.')}</p>} afterEffect={visibleRulings.length>0&&<section className="card-rulings" aria-labelledby="card-rulings-title"><header><Question size={18}/><div><h3 id="card-rulings-title">{id?'Tanya Jawab Resmi':'Official Q&A'}</h3><span>{id?'Aturan resmi yang diterbitkan untuk kartu ini.':'Published rulings for this card.'}</span></div></header>{visibleRulings.map(ruling=><article key={ruling.id}><p><b>Q</b>{ruling.question}</p><p><b>A</b>{ruling.answer}</p><a href={ruling.source_url} target="_blank" rel="noreferrer">{ruling.source_reference||(id?'Sumber aturan resmi':'Official ruling source')}<ArrowSquareOut size={14}/></a></article>)}</section>}/><CardPrintingSelector printings={printings} language={language} selectedId={printing?.id} onLanguageChange={setLanguage} onSelect={setSelected} vaultCard={card} renderCard={item=>{const pcard:Card={...card,id:item.id,rarity:item.rarity??'',imageUrl:item.card_image_url??undefined,setCode:item.set_code??undefined,language:item.language,printingCode:item.printing_code??undefined,assetPath:item.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key};return <CardArt card={pcard}/>}}/>{marketPrinting&&<CardMarketPanel printingId={marketPrinting.id}/>}<div className="live-detail-actions viewer-actions"><Link className="button" href={`/market?card=${identity.code}`}><Store size={16}/>{id?'Cari di Market':'Find listings'}</Link><Link className="button secondary" href={`/decks/builder?card=${printing?.id??identity.id}`}><Layers3 size={16}/>{id?'Susun dengan kartu ini':'Build with card'}</Link><Link className="button secondary" href={`/market?sell=${printing?.id??identity.id}`}><Store size={16}/>{id?'Jual kartu ini':'Sell a copy'}</Link><Link className="button secondary" href={`${id?'/id':''}/feedback?type=missing-printing&card=${encodeURIComponent(identity.code)}&printing=${encodeURIComponent(printing?.id??'')}&from=${encodeURIComponent(`${id?'/id':''}/cards/${identity.code}`)}`}><Bug size={16}/>{id?'Laporkan data kartu':'Report card data'}</Link></div></section></div></main>;
}
