'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {InfoIcon as Info,MinusIcon as Minus,PlusIcon as Plus} from '@phosphor-icons/react';
import type {Card} from '@/packages/card-data/catalog';
import {formatMoney} from '@/packages/domain';
import {CardArt} from './card-art';
import {CardPreviewModal} from './card-preview-modal';
import {ShareButton} from './share';
import {authClient} from '@/lib/auth-client';
import {toast} from 'sonner';

export type MarketListingCard={
  id:string;
  card:Card;
  quantity:number;
  condition:string;
  unitAmount:number;
  language:string;
};

export function ListingArtRotator({items}:{items:MarketListingCard[]}){
  const [activeIndex,setActiveIndex]=useState(0);
  useEffect(()=>{
    if(items.length<2)return;
    const timer=window.setInterval(()=>setActiveIndex(index=>(index+1)%items.length),3600);
    return()=>window.clearInterval(timer);
  },[items.length]);
  const active=items[activeIndex]??items[0];
  const underlays=[1,2].map(offset=>items[(activeIndex+offset)%items.length]).filter((item,index,self)=>items.length>1&&self.findIndex(candidate=>candidate.id===item.id)===index);
  if(!active)return null;

  return <div className="viewer-art-stack market-listing-art-rotator" aria-label={`Featured card: ${active.card.name}`}>
    {underlays.map((item,index)=><div key={item.id} className={`viewer-art-underlay viewer-art-underlay-${index}`} aria-hidden="true"><CardArt card={item.card}/></div>)}
    <div className="viewer-art-current market-listing-art-current" key={active.id}><CardArt card={active.card} priority/></div>
  </div>;
}

export function MarketListingItems({items,currency,listingType,listingId,listingTitle,listingAmount}:{items:MarketListingCard[];currency:string;listingType:'WTS'|'WTB';listingId:string;listingTitle?:string;listingAmount?:string;}){
  const [selected,setSelected]=useState<Record<string,number>>({});
  const [preview,setPreview]=useState<Card>();
  const {data:session}=authClient.useSession();
  const [submitting,setSubmitting]=useState(false); const [submitted,setSubmitted]=useState(false);
  const selectedCount=useMemo(()=>Object.values(selected).reduce((total,amount)=>total+amount,0),[selected]);
  const selectedTotal=useMemo(()=>items.reduce((total,item)=>total+(selected[item.id]??0)*item.unitAmount,0),[items,selected]);
  const change=(id:string,delta:number,maximum:number)=>setSelected(current=>{
    const next=Math.max(0,Math.min(maximum,(current[id]??0)+delta));
    return {...current,[id]:next};
  });
  const isBuying=listingType==='WTS';
  const actionLabel=isBuying?'Make offer':'Offer cards';
  const continueOffer=async()=>{
    if(!session){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return;}
    setSubmitting(true);try{const response=await fetch(`/api/listings/${encodeURIComponent(listingId)}/offers`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:isBuying?'BUY':'SELL',items:items.flatMap(item=>{const quantity=selected[item.id]??0;return quantity?[{printingId:item.id,quantity}]:[]}),amount:selectedTotal,currency})});const payload=await response.json() as {error?:string};if(!response.ok)throw new Error(payload.error??'We could not send your offer.');setSubmitted(true);toast.success(isBuying?'Offer sent to the seller.':'Your cards were offered to the buyer.');}catch(error){toast.error(error instanceof Error?error.message:'We could not send your offer.')}finally{setSubmitting(false)}
  };

  return <section className="market-listing-cards" aria-labelledby="listing-cards-heading">
    <header><h2 id="listing-cards-heading">Cards in this listing</h2></header>
    <div className="market-listing-card-grid">
      {items.map(item=>{
        const amount=selected[item.id]??0;
        return <article className={`deck-card-stack market-listing-card ${item.quantity>1?'has-printing-stack':''} ${amount?'is-selected':''}`} key={item.id}>
          <div className="card-stage printing-stack deck-printing-stack market-listing-card-stage">
            {Array.from({length:Math.min(item.quantity,4)},(_,index)=>(
              <div className="stacked-printing" style={{'--stack-index':index} as React.CSSProperties} key={index}>
                {index===0 ? (
                  <div
                    className="deck-stack-art"
                    title={item.card.name}
                    onClick={()=>setPreview(item.card)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setPreview(item.card);}}}
                  >
                    <CardArt card={item.card}/>
                  </div>
                ) : (
                  <CardArt card={item.card}/>
                )}
              </div>
            ))}
            {item.quantity>1 && <b>×{item.quantity}</b>}
            <button type="button" className="deck-info-action market-listing-info" onClick={()=>setPreview(item.card)} aria-label={`View ${item.card.name} details`}><Info size={13}/></button>
            <span className="deck-stack-actions market-listing-quantity" aria-label={`Select ${item.card.name}`}>
              <button type="button" onClick={()=>change(item.id,-1,item.quantity)} disabled={!amount} aria-label={`Remove one ${item.card.name}`}><Minus size={13}/></button>
              <button type="button" onClick={()=>change(item.id,1,item.quantity)} disabled={amount===item.quantity} aria-label={`Add one ${item.card.name}`}><Plus size={13}/></button>
            </span>
          </div>
          <div className="market-listing-card-copy">
            <strong>{item.card.name}</strong>
            <small>{item.card.code} · {item.card.rarity} · {item.language}</small>
            <p><span>{item.condition}</span><em>{amount}/{item.quantity} selected</em></p>
            <b>{formatMoney(item.unitAmount,currency)} each</b>
          </div>
        </article>;
      })}
    </div>
    {preview&&<CardPreviewModal card={preview} language={preview.language==='JP'?'JP':'EN'} cards={items.map(item=>item.card)} onClose={()=>setPreview(undefined)} onNavigate={setPreview}/>}
    <footer className="market-listing-selection" aria-live="polite">
      <div className="market-listing-selection-info">
        <span>{submitted?'Offer sent - awaiting a response.':selectedCount?`${selectedCount} ${selectedCount===1?'card':'cards'} selected`:'Select cards to calculate a total'}</span>
        <strong>{formatMoney(selectedTotal,currency)}</strong>
      </div>
      <div className="market-listing-selection-actions">
        <button type="button" className="button" disabled={!selectedCount||submitting||submitted} onClick={continueOffer}>{submitted?'Offer sent':submitting?'Sending…':session?actionLabel:`Sign in to ${actionLabel.toLowerCase()}`}</button>
        <ShareButton
          title={listingTitle ?? 'Card listing'}
          path={`/market/${listingId}`}
          cards={items.map(item => ({
            card: item.card,
            quantity: item.quantity,
            condition: item.condition,
            unitAmount: item.unitAmount,
          }))}
          price={listingAmount ?? formatMoney(selectedTotal || items[0]?.unitAmount, currency)}
          subtitle={`${items.reduce((acc, it) => acc + it.quantity, 0)} ${items.reduce((acc, it) => acc + it.quantity, 0) === 1 ? 'card' : 'cards'} · ${items.length} ${items.length === 1 ? 'item' : 'items'}`}
        />
      </div>
    </footer>
  </section>;
}
