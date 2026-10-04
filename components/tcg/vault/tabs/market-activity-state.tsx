'use client';

import type {ReactNode} from 'react';
import Image from 'next/image';

export type MarketActivityCard={printingId:string;quantity:number;card?:{name:string;code:string;imageUrl:string|null}|null};

export function MarketCardStack({cards}:{cards:MarketActivityCard[]}){
  const visible=cards.slice(0,3);
  const copyCount=cards.reduce((total,item)=>total+item.quantity,0);
  if(!cards.length)return <div className="market-card-stack is-empty" aria-hidden="true"><i/></div>;
  return <div className="market-card-stack" aria-label={`${cards.length} ${cards.length===1?'card':'card types'}, ${copyCount} ${copyCount===1?'copy':'copies'}`}>
    {visible.map((item,index)=><span key={item.printingId} style={{'--stack-index':index} as React.CSSProperties} title={item.card?.name??item.card?.code??item.printingId}>
      {item.card?.imageUrl?<Image src={item.card.imageUrl} alt="" fill sizes="42px" unoptimized/>:<b>{item.card?.code??item.printingId.slice(0,8)}</b>}
    </span>)}
    {cards.length>visible.length?<small>+{cards.length-visible.length}</small>:copyCount>1?<small>×{copyCount}</small>:null}
  </div>;
}

export function MarketActivityLoading({label,kind}:{label:string;kind:'listings'|'offers'|'orders'}){
  return <section className={`market-activity-loading is-${kind}`} aria-busy="true" aria-label={label}>
    <p>{label}</p>
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

export function MarketActivityEmpty({title,description,action}:{title:string;description:string;action?:ReactNode}){
  return <div className="market-activity-empty"><span className="market-activity-empty-mark" aria-hidden="true">—</span><strong>{title}</strong><p>{description}</p>{action}</div>;
}
