'use client';

import {useEffect, useRef, useState} from 'react';
import {Card, colors} from '@/packages/card-data/catalog';
import {isPreviewCard} from '@/packages/domain/release-availability';

export function cardImageUrl(card:Card){
  if(!card.imageUrl)return undefined;
  if(!card.imageUrl.startsWith('http'))return card.imageUrl;
  if(card.assetPath)return `/${card.assetPath.replace(/^one-piece\/([^/]+)\//,(_,setCode)=>`${setCode.replaceAll('-','')}/`)}`;
  // Every public card image goes through the set route, which reads the private
  // Supabase tcg-card-images bucket. Avoid a printing-id API URL in page markup.
  if(card.setCode)return `/${encodeURIComponent(card.setCode.replaceAll('-',''))}/${encodeURIComponent((card.language??'EN').toLowerCase())}/${encodeURIComponent(card.printingCode??card.code)}.webp`;
  return undefined;
}

export function CardArt({card,small=false,priority=false}:{card:Card;small?:boolean;priority?:boolean}) {
  const preview=isPreviewCard(card.code,card.setCode,card.variant);
  const storedImage=cardImageUrl(card);
  const [loaded,setLoaded]=useState(false);
  const imageRef=useRef<HTMLImageElement>(null);
  useEffect(()=>{
    setLoaded(false);
    const image=imageRef.current;
    if(!image)return;
    const finish=()=>setLoaded(true);
    image.addEventListener('load',finish);
    image.addEventListener('error',finish);
    if(image.complete)finish();
    return()=>{image.removeEventListener('load',finish);image.removeEventListener('error',finish);};
  },[storedImage]);
  if (storedImage) return <div className={`tcg-card printing-image ${small?'small':''} ${loaded?'is-loaded':'is-loading'} ${preview?'is-preview-card':''}`} aria-label={preview?"Preview of a set that hasn’t launched yet. You can play it in Casual, New Cards, and Extended, but not Ranked. Its image and text may still change.":undefined}>
    {preview&&<span className="preview-card-badge" aria-hidden="true">Preview</span>}<span className="card-image-skeleton" aria-hidden="true"/>
    <img ref={imageRef} src={storedImage} alt={`${card.name} card printing`} draggable={false} loading={priority?"eager":"lazy"} fetchPriority={priority?"high":undefined} decoding="async" width="420" height="580" onLoad={()=>setLoaded(true)} onError={()=>setLoaded(true)}/>
  </div>;
  return <div className={`tcg-card missing-printing ${small?'small':''} ${preview?'is-preview-card':''}`} style={{'--card-color':colors[card.color]} as React.CSSProperties} aria-label={`${card.name} artwork unavailable`}>
    {preview&&<span className="preview-card-badge" aria-hidden="true">Preview</span>}
    <div className="card-top"><b>{card.type==='Leader'?'L':card.cost}</b><strong>{card.power>0?card.power.toLocaleString():card.type.toUpperCase()}</strong></div>
    <div className="card-caption"><span>{card.type.toUpperCase()}</span><strong>{card.name}</strong><div>{card.code} <span>Artwork pending</span></div></div>
  </div>;
}
