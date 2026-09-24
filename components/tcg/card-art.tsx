'use client';

import {useEffect, useRef, useState} from 'react';
import {Card, colors} from '@/packages/card-data/catalog';

function localCardImage(card:Card,size:'thumb'|'small'){
  if(!card.imageUrl)return undefined;
  if(!card.imageUrl.startsWith('http'))return card.imageUrl;
  if(card.assetPath)return `/${card.assetPath.replace(/^one-piece\/([^/]+)\//,(_,setCode)=>`${setCode.replaceAll('-','')}/`)}`;
  if(card.setCode&&card.language&&card.printingCode)return `/${encodeURIComponent(card.setCode)}/${encodeURIComponent(card.language.toLowerCase())}/${size}/${encodeURIComponent(card.printingCode)}.webp`;
  return `/api/card-assets/${card.id}?kind=${size}`;
}

export function CardArt({card,small=false}:{card:Card;small?:boolean}) {
  const size=small?'thumb':'small';
  const storedImage=localCardImage(card,size);
  const [loaded,setLoaded]=useState(false);
  const imageRef=useRef<HTMLImageElement>(null);
  useEffect(()=>{setLoaded(Boolean(imageRef.current?.complete));},[storedImage]);
  if (storedImage) return <div className={`tcg-card printing-image ${small?'small':''} ${loaded?'is-loaded':'is-loading'}`}>
    <span className="card-image-skeleton" aria-hidden="true"/>
    <img ref={imageRef} src={storedImage} alt={`${card.name} card printing`} loading="lazy" decoding="async" width="420" height="580" onLoad={()=>setLoaded(true)} onError={()=>setLoaded(true)}/>
  </div>;
  return <div className={`tcg-card missing-printing ${small?'small':''}`} style={{'--card-color':colors[card.color]} as React.CSSProperties} aria-label={`${card.name} artwork unavailable`}>
    <div className="card-top"><b>{card.type==='Leader'?'L':card.cost}</b><strong>{card.power>0?card.power.toLocaleString():card.type.toUpperCase()}</strong></div>
    <div className="card-caption"><span>{card.type.toUpperCase()}</span><strong>{card.name}</strong><div>{card.code} <span>Artwork pending</span></div></div>
  </div>;
}
