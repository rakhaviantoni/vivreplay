'use client';

import {useEffect, useState, type ReactNode} from 'react';
import {BlockValue} from './block-value';
import {SetInformation} from './set-information';
import {colors} from '@/packages/card-data/catalog';

export function cardIdentityBackground(color?: string | null): string {
  if (!color) return '#657180';
  const cardColours = color.split(/\s*(?:\/|&|,|·)\s*|\s+/).map(c => c.trim()).filter(c => Boolean(colors[c]));
  const identityColours = cardColours.map(c => colors[c]);
  if (identityColours.length > 1) {
    return `linear-gradient(135deg,${identityColours.map((c, i) => `${c} ${(i / identityColours.length) * 100}% ${((i + 1) / identityColours.length) * 100}%`).join(',')})`;
  }
  return identityColours[0] ?? '#657180';
}

type CardDetailContentProps={
  code:string;
  color?:string|null;
  title:string;
  titleId?:string;
  heading:'h1'|'h2';
  type:string;
  rarity?:string|null;
  attribute?:string|null;
  cost:number;
  power:number|null;
  life?:number|null;
  block:string;
  setCode?:string|null;
  setName?:string|null;
  effect?:ReactNode;
  hasEffect?:boolean;
  afterEffect?:ReactNode;
};

export function CardDetailContent({code,color,title,titleId,heading,type,rarity,attribute,cost,power,life,block,setCode,setName,effect,hasEffect=true,afterEffect}:CardDetailContentProps) {
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  useEffect(()=>{
    const syncLocale=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail);
    syncLocale();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);
  const id=locale==='ID';
  const Heading=heading;
  const identityBackground = cardIdentityBackground(color);
  const displayType = id && type === 'Character' ? 'Karakter' : type;
  return <>
    <p className="eyebrow">
      <i className="filter-colour identity-colour" title={color || undefined} aria-label={color ? `${color} color` : undefined} style={{ background: identityBackground }} />
      <span>{code}</span>
    </p>
    <Heading id={titleId} className="card-detail-title">{title}</Heading>
    <p className="viewer-kind">{displayType} <span>·</span> {rarity||(id?'Versi cetak':'Printing')} {attribute&&<><span>·</span>{attribute}</>}</p>
    <dl className="viewer-stats">
      {type!=='Leader'&&<div className="viewer-stat-cost"><dt>{id?'Biaya':'Cost'}</dt><dd>{cost}</dd></div>}
      {(type==='Character'||type==='Leader')&&<div><dt>{id?'Kekuatan':'Power'}</dt><dd>{power??0}</dd></div>}
      {life!==null&&life!==undefined&&<div><dt>{id?'Nyawa':'Life'}</dt><dd>{life}</dd></div>}
      <div><dt>{id?'Blok':'Block'}</dt><dd><BlockValue value={block}/></dd></div>
      <SetInformation compact setCode={setCode} fallbackName={setName}/>
    </dl>
    {hasEffect&&<section className="card-detail-effect viewer-effect"><h3>{id?'Efek':'Effect'}</h3>{effect}</section>}
    {afterEffect}
  </>;
}
