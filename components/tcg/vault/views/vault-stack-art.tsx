'use client';

import React from 'react';
import { CardArt } from '../card-art';
import type { EnrichedCollectionItem } from '../types';

export function VaultStackArt({items,quantity}:{items:EnrichedCollectionItem[];quantity:number}){
  const unique=[...new Map(items.map(item=>[item.printingId,item])).values()];
  const count=Math.min(3,Math.max(1,quantity,unique.length));
  const faces=Array.from({length:count},(_,index)=>unique[index]??unique[0]??items[0]).filter(Boolean);
  return <div className={`vault-stack-art${count>1?' is-stacked':''}`} aria-hidden="true">
    {faces.map((item,index)=>{
      const x=faces.length===1?0:index-(faces.length-1)/2;
      return <div key={`${item.printingId}-${index}`} className="vault-stack-art-card" style={{'--stack-index':index,'--stack-x':`${x*7}px`,'--stack-rotate':`${x*4}deg`} as React.CSSProperties}>
        <CardArt card={item.card}/>
      </div>;
    })}
  </div>;
}
