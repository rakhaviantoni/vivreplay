'use client';

import type {ReactNode} from 'react';
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
  power:number;
  life?:number|null;
  block:string;
  setCode?:string|null;
  setName?:string|null;
  effect:ReactNode;
  afterEffect?:ReactNode;
};

export function CardDetailContent({code,color,title,titleId,heading,type,rarity,attribute,cost,power,life,block,setCode,setName,effect,afterEffect}:CardDetailContentProps) {
  const Heading=heading;
  const identityBackground = cardIdentityBackground(color);
  return <>
    <p className="eyebrow">
      <i className="filter-colour identity-colour" aria-hidden="true" style={{ background: identityBackground }} />
      <span>{code}</span>
    </p>
    <Heading id={titleId} className="card-detail-title">{title}</Heading>
    <p className="viewer-kind">{type} <span>·</span> {rarity||'Printing'} {attribute&&<><span>·</span>{attribute}</>}</p>
    <dl className="viewer-stats">
      {type!=='Leader'&&<div><dt>Cost</dt><dd>{cost}</dd></div>}
      <div><dt>Power</dt><dd>{power?power.toLocaleString():'—'}</dd></div>
      {life!==null&&life!==undefined&&<div><dt>Life</dt><dd>{life}</dd></div>}
      <div><dt>Block</dt><dd><BlockValue value={block}/></dd></div>
      <SetInformation compact setCode={setCode} fallbackName={setName}/>
    </dl>
    <section className="card-detail-effect viewer-effect"><h3>Effect</h3>{effect}</section>
    {afterEffect}
  </>;
}
