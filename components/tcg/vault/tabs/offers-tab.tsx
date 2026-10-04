'use client';

import {useCallback,useEffect,useState} from 'react';
import {ArrowCounterClockwiseIcon as Refresh,ChatCircleDotsIcon as Conversation} from '@phosphor-icons/react';
import {OfferConversation} from '@/components/tcg/vault/offer-conversation';
import {MarketActivityEmpty,MarketActivityLoading,MarketCardStack} from '@/components/tcg/vault/tabs/market-activity-state';

type Offer={id:string;threadId:string;listingId:string;listingTitle:string;direction:'received'|'sent';counterparty:string|null;status:string;amount:number;currency:string;createdAt:string;items:Array<{printingId:string;quantity:number;card?:{name:string;code:string;imageUrl:string|null}}>};
const money=(amount:number,currency:string)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:currency||'IDR',maximumFractionDigits:0}).format(amount);

export function OffersTab({language}:{language:'EN'|'ID'}){
  const id=language==='ID';
  const [offers,setOffers]=useState<Offer[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [conversationId,setConversationId]=useState<string|null>(null);
  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const response=await fetch('/api/listings/offers/mine',{cache:'no-store'});
      const data=await response.json() as {offers?:Offer[];error?:string};
      if(!response.ok)throw new Error(data.error||(id?'Penawaran tidak dapat dimuat.':'Offers could not be loaded.'));
      const latest=new Map<string,Offer>();
      for(const offer of data.offers??[]){const previous=latest.get(offer.threadId);if(!previous||new Date(offer.createdAt).getTime()>new Date(previous.createdAt).getTime())latest.set(offer.threadId,offer)}
      setOffers([...latest.values()].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()));
    }catch(reason){setError(reason instanceof Error?reason.message:(id?'Penawaran tidak dapat dimuat.':'Offers could not be loaded.'))}
    finally{setLoading(false)}
  },[id]);
  // Initial loading is represented by the initial state; manual refreshes toggle it later.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void refresh()},[refresh]);
  if(loading)return <MarketActivityLoading kind="offers" label={id?'Memuat penawaran…':'Loading your offers…'}/>;
  return <section className="market-activity-panel" aria-label={id?'Penawaran Market':'Market offers'}>
    <div className="market-activity-toolbar"><p>{id?'Penawaran untuk listing Anda dan penawaran yang Anda kirim.':'Offers on your listings and offers you have sent.'}</p><button type="button" className="market-activity-refresh" onClick={()=>void refresh()}><Refresh size={15}/>{id?'Muat ulang':'Refresh'}</button></div>
    {error&&<div className="market-activity-error" role="alert"><span>{error}</span><button type="button" onClick={()=>void refresh()}>{id?'Coba lagi':'Try again'}</button></div>}
    {!offers.length?<MarketActivityEmpty title={id?'Belum ada penawaran':'No offers yet'} description={id?'Penawaran masuk dan terkirim akan muncul di sini.':'Incoming and sent offers will appear here.'}/>:<div className="market-activity-list">{offers.map(offer=><article className="market-activity-row market-offer-row" key={offer.threadId}>
      <MarketCardStack cards={offer.items}/>
      <div className="market-activity-row-main"><div className="market-activity-row-title"><span className={`market-offer-direction is-${offer.direction}`}>{offer.direction==='received'?(id?'Diterima':'Received'):(id?'Terkirim':'Sent')}</span><span className={`vault-listing-status is-${offer.status.toLowerCase()}`}>{offer.status.replaceAll('_',' ')}</span></div><h3>{offer.listingTitle}</h3><p>{offer.counterparty|| (id?'Kolektor':'Collector')}<span>·</span>{offer.items.map(item=>`${item.quantity}× ${item.card?.name||item.card?.code||item.printingId}`).join(', ')}</p><small>{new Date(`${offer.createdAt.replace(' ','T')}Z`).toLocaleString(id?'id-ID':'en-US',{dateStyle:'medium',timeStyle:'short'})}</small></div>
      <strong className="market-activity-price">{money(offer.amount,offer.currency)}</strong>
      <button type="button" className="market-activity-primary" onClick={()=>setConversationId(offer.id)}><Conversation size={16}/><span>{id?'Buka percakapan':'Open conversation'}</span></button>
    </article>)}</div>}
    {conversationId&&<OfferConversation offerId={conversationId} language={language} open onOpenChange={open=>{if(!open)setConversationId(null)}} onChanged={()=>void refresh()}/>}
  </section>;
}
