'use client';

import {useState,type ReactNode} from 'react';
import Image from 'next/image';
import {CardsIcon as Cards} from '@phosphor-icons/react';
import {cardImageUrl} from '@/components/tcg/card-art';
import {pokemonPublicReference} from '@/lib/pokemon-public-reference';

export type MarketActivityCard={printingId:string;quantity:number;card?:{name:string;code:string;imageUrl:string|null;setCode?:string;language?:string;printingCode?:string;localCardNumber?:string;assetPath?:string|null;variant?:string}|null};

function MarketActivityCardThumb({card,printingId}:{card:NonNullable<MarketActivityCard['card']>|null|undefined;printingId:string}){
  const source=card?cardImageUrl(card):undefined;
  const [failed,setFailed]=useState(false);
  if(source&&!failed)return <Image src={source} alt="" fill sizes="42px" unoptimized onError={()=>setFailed(true)}/>;
  const label=card?.code&&(/^(?:PK-|CT-)/i.test(card.code)||/^CT-\d+$/i.test(card.printingCode??''))?pokemonPublicReference(card):card?.code;
  return <b>{label||'Card'}</b>;
}

export function MarketCardStack({cards}:{cards:MarketActivityCard[]}){
  const visible=cards.slice(0,3);
  const copyCount=cards.reduce((total,item)=>total+item.quantity,0);
  if(!cards.length)return <div className="market-card-stack is-empty" aria-hidden="true"><i/></div>;
  return <div className="market-card-stack" aria-label={`${cards.length} ${cards.length===1?'card':'card types'}, ${copyCount} ${copyCount===1?'copy':'copies'}`}>
    {visible.map((item,index)=><span key={item.printingId} style={{'--stack-index':index} as React.CSSProperties} title={item.card?.name??'Card'}>
      <MarketActivityCardThumb key={item.card?.imageUrl??item.printingId} card={item.card} printingId={item.printingId}/>
    </span>)}
    {cards.length>visible.length?<small>+{cards.length-visible.length}</small>:copyCount>1?<small>×{copyCount}</small>:null}
  </div>;
}

export function MarketActivityLoading({label,kind}:{label:string;kind:'listings'|'offers'|'orders'}){
  return <section className={`market-activity-loading is-${kind}`} aria-busy="true" aria-label={label}>
    <span className="sr-only" role="status">{label}</span>
    <div className="market-activity-skeleton-list" aria-hidden="true">
      {Array.from({length:3},(_,index)=><div className="market-activity-skeleton-row" key={index}>
        {kind==='offers'&&<i className="market-activity-skeleton-art"/>}
        <div className="market-activity-skeleton-copy"><i/><i/><i/></div>
        <i className="market-activity-skeleton-price"/>
        {kind!=='orders'&&<i className="market-activity-skeleton-action"/>}
      </div>)}
    </div>
  </section>;
}

export function MarketActivityEmpty({title,description,action,icon}:{title:string;description:string;action?:ReactNode;icon?:ReactNode}){
  return <div className="market-activity-empty"><span className="market-activity-empty-mark" aria-hidden="true">{icon??<Cards size={19}/>}</span><strong>{title}</strong><p>{description}</p>{action}</div>;
}
