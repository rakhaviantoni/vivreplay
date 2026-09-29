'use client';

import {useEffect, useState, type ReactNode} from 'react';

export type CardPrinting={id:string;language:string;variant:string|null;printing_code:string|null;card_image_url:string|null};

export function printingLabel(variant:string|null) {
  if(!variant)return 'Standard';
  const label=variant.replace(/(?:^|[\s·,/_-])p\d+(?=$|[\s·,/_-])/ig,'').replace(/[·,/_-]+\s*$/,'').trim();
  return label||'Alt art';
}

export function printingPriority(variant:string|null) { return /^(standard|base)$/i.test(variant??'')?0:1; }

export function orderPrintings<T extends CardPrinting>(printings:T[]) { return [...printings].sort((a,b)=>printingPriority(a.variant)-printingPriority(b.variant)||printingLabel(a.variant).localeCompare(printingLabel(b.variant))); }

export function uniquePrintings<T extends CardPrinting>(printings:T[]) { return [...new Map(printings.map(item=>[item.printing_code??item.id,item])).values()]; }

export function CardPrintingSelector<T extends CardPrinting>({printings,language,selectedId,onLanguageChange,onSelect,renderCard}:{printings:T[];language:string;selectedId?:string;onLanguageChange:(language:string)=>void;onSelect:(id:string)=>void;renderCard:(printing:T)=>ReactNode}) {
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  useEffect(()=>{
    const syncLocale=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail);
    syncLocale();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);
  const id=locale==='ID';
  const languages=[...new Set(printings.map(item=>item.language))];
  const visible=uniquePrintings(orderPrintings(printings.filter(item=>item.language===language&&item.card_image_url)));
  return <section className="viewer-printings"><div className="printing-title"><h3>{id?'Versi Cetak':'Printings'}</h3><div>{languages.map(item=><button type="button" key={item} className={language===item?'active':''} onClick={()=>onLanguageChange(item)}>{item}</button>)}</div></div><div className="printing-strip">{visible.map(item=>{const label=printingLabel(item.variant);return <button type="button" className={item.id===selectedId?'selected':''} key={item.id} onClick={()=>onSelect(item.id)}>{renderCard(item)}<span>{id&&label==='Standard'?'Standar':label}</span></button>})}</div></section>;
}
