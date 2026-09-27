'use client';

import type {ReactNode} from 'react';
import {BlockValue} from './block-value';
import {SetInformation} from './set-information';

type CardDetailContentProps={
  code:string;
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

export function CardDetailContent({code,title,titleId,heading,type,rarity,attribute,cost,power,life,block,setCode,setName,effect,afterEffect}:CardDetailContentProps) {
  const Heading=heading;
  return <>
    <p className="eyebrow">{code}</p>
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
