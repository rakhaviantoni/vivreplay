'use client';

import {useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {Card, colors} from '@/packages/card-data/catalog';
import {isPreviewCard} from '@/packages/domain/release-availability';
import {pokemonArtRoute} from '@/lib/pokemon-art-route';

export function cardPrintingImageUrl(printing:{id?:string|null;assetPath?:string|null;imageUrl?:string|null;setCode?:string|null;language?:string|null;printingCode?:string|null;localCardNumber?:string|null;code?:string|null;gameSlug?:string|null}){
  if(printing.assetPath){
    const asset=printing.assetPath.replace(/^\/+/, '').match(/^one-piece\/([^/]+)\/([^/]+)\/(?:small\/|thumb\/|large\/)?(.+)$/);
    if(asset)return `/${encodeURIComponent(asset[1].replaceAll('-',''))}/${encodeURIComponent(asset[2].toLowerCase())}/${asset[3].split('/').map(encodeURIComponent).join('/')}`;
    if(!printing.assetPath.startsWith('//'))return `/${printing.assetPath.replace(/^\/+/, '')}`;
  }
  const imageUrl=printing.imageUrl??undefined;
  if(imageUrl?.startsWith('/')&&!imageUrl.startsWith('//')&&!imageUrl.startsWith('/api/card-assets/'))return imageUrl;
  if(printing.gameSlug==='pokemon'&&printing.setCode){
    const cardCode=printing.localCardNumber??printing.printingCode??printing.code??undefined;
    if(cardCode)return pokemonArtRoute(printing.language??'EN',printing.setCode,cardCode,/^[a-f0-9-]{36}$/i.test(printing.id??'')?printing.id??undefined:undefined);
  }
  if(!imageUrl)return undefined;
  if(!imageUrl.startsWith('http'))return undefined;
  // Preserve the exact filename when the catalog has a source URL. The app
  // route resolves that filename from VivrePlay storage.
  try {
    const source=new URL(imageUrl);
    if(source.hostname==='cards.oplaytcg.com'){
      const [,folder,language,...pathParts]=source.pathname.split('/');
      const imageName=pathParts.at(-1);
      if(folder&&language&&imageName&&folder.toLowerCase()!=='tcg'&&!imageName.toLowerCase().startsWith('tcg-')){
        // The source filename can carry the exact alt-art suffix (for example
        // OP09-119_p3). printingCode is often only the shared card number, so
        // rebuilding the filename from it silently selects the standard art.
        return `/${encodeURIComponent(folder)}/${encodeURIComponent(language.toLowerCase())}/${encodeURIComponent(imageName)}`;
      }
    }
  } catch { /* Invalid source URLs fall through to the existing fallback. */ }
  // Fall back to the selected printing's internal image route.
  if(printing.setCode)return `/${encodeURIComponent(printing.setCode.replaceAll('-',''))}/${encodeURIComponent((printing.language??'EN').toLowerCase())}/${encodeURIComponent(printing.printingCode??printing.code??'')}.webp`;
  return undefined;
}

export function cardImageUrl(card:Omit<Partial<Card>,'imageUrl'|'assetPath'>&{imageUrl?:string|null;assetPath?:string|null;gameSlug?:string|null}){return cardPrintingImageUrl(card)}

export function CardArt({card,small=false,priority=false,imageWidth,onImageMissing,onImageLoaded,missingImageAction}:{card:Card&{gameSlug?:string};small?:boolean;priority?:boolean;imageWidth?:160|220|280|360;onImageMissing?:()=>void;onImageLoaded?:()=>void;missingImageAction?:ReactNode}) {
  const preview=isPreviewCard(card.code,card.setCode,card.variant);
  const baseImage=cardImageUrl(card);
  const resolvedImage=baseImage&&imageWidth?`${baseImage}${baseImage.includes('?')?'&':'?'}width=${imageWidth}`:baseImage;
  const [imageResult,setImageResult]=useState<{url:string;status:'loaded'|'failed'}|null>(null);
  const loaded=Boolean(resolvedImage&&imageResult?.url===resolvedImage&&imageResult.status==='loaded');
  const imageFailed=Boolean(resolvedImage&&imageResult?.url===resolvedImage&&imageResult.status==='failed');
  const onImageMissingRef=useRef(onImageMissing);
  const onImageLoadedRef=useRef(onImageLoaded);
  useEffect(()=>{onImageMissingRef.current=onImageMissing},[onImageMissing]);
  useEffect(()=>{onImageLoadedRef.current=onImageLoaded},[onImageLoaded]);
  useEffect(()=>{
    if(!resolvedImage)onImageMissingRef.current?.();
  },[resolvedImage]);
  if(card.sealedProduct)return <div className="market-sealed-art" style={{width:'100%',aspectRatio:'3 / 4',display:'grid',placeItems:'center'}}><img src={card.imageUrl} alt={card.name} style={{width:'100%',height:'100%',objectFit:'contain'}} loading={priority?'eager':'lazy'}/></div>;
  if (resolvedImage&&!imageFailed) return <div className={`tcg-card printing-image ${small?'small':''} ${loaded?'is-loaded':'is-loading'} ${preview?'is-preview-card':''}`} aria-label={preview?"Preview of a set that hasn’t launched yet. You can play it in Casual, New Cards, and Extended, but not Ranked. Its image and text may still change.":undefined}>
    {preview&&<span className="preview-card-badge" aria-hidden="true">Preview</span>}<span className="card-image-skeleton" aria-hidden="true"/>
    <img src={resolvedImage} alt={`${card.name} card printing`} draggable={false} loading={priority?"eager":"lazy"} fetchPriority={priority?"high":undefined} decoding="async" width={imageWidth??420} height={imageWidth?Math.round(imageWidth*580/420):580} onLoad={()=>{setImageResult({url:resolvedImage,status:'loaded'});onImageLoadedRef.current?.();}} onError={()=>{setImageResult({url:resolvedImage,status:'failed'});onImageMissingRef.current?.();}}/>
  </div>;
  if(card.gameSlug==='pokemon')return <div className={`tcg-card missing-printing pokemon-missing-printing ${small?'small':''}`} aria-label={`Card is missing: ${card.name}`}><strong>Card is missing</strong>{missingImageAction}</div>;
  return <div className={`tcg-card missing-printing ${small?'small':''} ${preview?'is-preview-card':''}`} style={{'--card-color':colors[card.color]} as React.CSSProperties} aria-label={`${card.name} artwork unavailable`}>
    {preview&&<span className="preview-card-badge" aria-hidden="true">Preview</span>}
    <div className="card-top"><b>{card.type==='Leader'?'L':card.cost}</b><strong>{card.power>0?card.power.toLocaleString():card.type.toUpperCase()}</strong></div>
    <div className="card-caption"><span>{card.type.toUpperCase()}</span><strong>{card.name}</strong><div>{card.code} <span>Image unavailable</span></div></div>
  </div>;
}
