'use client';

import {cards as catalogCards} from '@/packages/card-data/catalog';
import {CardArt} from './card-art';

export function IntroCardRail({className=''}:{className?:string}){
  const cards=catalogCards.filter(card=>card.imageUrl).slice(0,3);

  return <div className={`library-intro-rail intro-card-rail ${className}`} aria-hidden="true">
    <div className="library-intro-rail-cards">
      {cards.map((card,index)=><div className={`library-intro-rail-card rail-card-${index}`} key={card.id}><CardArt card={card}/></div>)}
    </div>
  </div>;
}
