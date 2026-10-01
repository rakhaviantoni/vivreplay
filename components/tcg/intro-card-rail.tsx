'use client';

import {useEffect,useState} from 'react';
import type {Card} from '@/packages/card-data/catalog';
import {CardArt} from './card-art';

type CatalogRow={
  id:string;
  rarity:string|null;
  variant:string|null;
  set_code:string|null;
  card_image_url:string|null;
  tcg_card_identities:{code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string}|null;
};

function chooseCards(rows:CatalogRow[]):Card[]{
  const unique=new Map<string,CatalogRow>();
  for(const row of rows){
    const identity=row.tcg_card_identities;
    if(!identity||!row.card_image_url||unique.has(identity.code))continue;
    unique.set(identity.code,row);
  }
  return [...unique.values()]
    .sort(()=>Math.random()-.5)
    .slice(0,3)
    .map((row,index)=>{
      const identity=row.tcg_card_identities!;
      return {id:row.id,code:identity.code,name:identity.name,color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:row.rarity??'',art:index,effect:identity.effect_text,imageUrl:row.card_image_url??undefined,imageSource:'external',setCode:row.set_code??undefined,variant:row.variant??undefined};
    });
}

export function IntroCardRail({className=''}:{className?:string}){
  const [cards,setCards]=useState<Card[]>([]);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch('/api/cards/catalog',{signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw new Error('Card catalog unavailable');
        return await response.json() as {cards?:CatalogRow[]};
      })
      .then(payload=>setCards(chooseCards(payload.cards??[])))
      .catch(()=>{});
    return()=>controller.abort();
  },[]);

  return <div className={`library-intro-rail intro-card-rail ${className}`} aria-hidden="true">
    <div className="library-intro-rail-cards">
      {cards.map((card,index)=><div className={`library-intro-rail-card rail-card-${index}`} key={card.id}><CardArt card={card}/></div>)}
      {!cards.length&&Array.from({length:3},(_,index)=><i className={`library-intro-rail-skeleton rail-card-${index}`} key={index}/>)}
    </div>
  </div>;
}
