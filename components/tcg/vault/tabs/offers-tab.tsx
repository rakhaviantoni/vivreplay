'use client';

import {useCallback,useEffect,useState} from 'react';
import {ArrowCounterClockwiseIcon as Refresh,ChatCircleDotsIcon as Conversation} from '@phosphor-icons/react';
import {OfferConversation} from '@/components/tcg/vault/offer-conversation';
import {MarketActivityEmpty,MarketActivityLoading,MarketCardStack} from '@/components/tcg/vault/tabs/market-activity-state';
import {PushNotificationPrompt} from '@/components/tcg/push-notification-settings';

type Offer={id:string;threadId:string;listingId:string;listingTitle:string;listingExpiresAt:string|null;offerExpiresAt:string|null;direction:'received'|'sent';counterparty:string|null;status:string;amount:number;currency:string;createdAt:string;items:Array<{printingId:string;quantity:number;card?:{name:string;code:string;imageUrl:string|null}}>};
const money=(amount:number,currency:string)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:currency||'IDR',maximumFractionDigits:0}).format(amount);
const dateLabel=(value:string,id:boolean)=>{const time=expiryTime(value);return time===null?(id?'Tanggal tidak tersedia':'Date unavailable'):new Intl.DateTimeFormat(id?'id-ID':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(time)};
const expiryTime=(value:string)=>{const raw=value.trim();const iso=/^\d{4}-\d{2}-\d{2}$/.test(raw)?`${raw}T23:59:59Z`:raw.includes('T')?raw:raw.replace(' ','T');const zoned=/([zZ]|[+-]\d{2}(?::?\d{2})?)$/.test(iso)?iso:`${iso}Z`;const parsed=Date.parse(zoned);return Number.isFinite(parsed)?parsed:null};
const countdown=(value:string,now:number,id:boolean)=>{const time=expiryTime(value);if(time===null)return id?'Tanggal akhir tidak tersedia':'Expiry date unavailable';const minutes=Math.ceil(Math.max(0,time-now)/60_000);if(minutes<60)return id?`${minutes} mnt lagi`:`${minutes}m left`;const hours=Math.floor(minutes/60);if(hours<24)return id?`${hours} jam ${minutes%60} mnt lagi`:`${hours}h ${minutes%60}m left`;const days=Math.floor(hours/24);return id?`${days} hari ${hours%24} jam lagi`:`${days}d ${hours%24}h left`};

export function OffersTab({language,initialConversationId}:{language:'EN'|'ID';initialConversationId?:string|null}){
  const id=language==='ID';
  const [offers,setOffers]=useState<Offer[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [conversationId,setConversationId]=useState<string|null>(initialConversationId??null);
  const [now,setNow]=useState(0);
  const refresh=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true);if(!silent)setError('');
    try{
      const response=await fetch('/api/listings/offers/mine',{cache:'no-store'});
      const data=await response.json() as {offers?:Offer[];error?:string};
      if(!response.ok)throw new Error(data.error||(id?'Penawaran tidak dapat dimuat.':'Offers could not be loaded.'));
      setNow(Date.now());
      const latest=new Map<string,Offer>();
      for(const offer of data.offers??[]){const previous=latest.get(offer.threadId);if(!previous||new Date(offer.createdAt).getTime()>new Date(previous.createdAt).getTime())latest.set(offer.threadId,offer)}
      setOffers([...latest.values()].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()));
    }catch(reason){setError(reason instanceof Error?reason.message:(id?'Penawaran tidak dapat dimuat.':'Offers could not be loaded.'))}
    finally{if(!silent)setLoading(false)}
  },[id]);
  // Initial loading is represented by the initial state; manual refreshes toggle it later.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void refresh()},[refresh]);
  useEffect(()=>{const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh(true)},30_000);return()=>window.clearInterval(timer)},[refresh]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),60_000);return()=>window.clearInterval(timer)},[]);
  if(conversationId)return <section className="market-activity-panel"><OfferConversation offerId={conversationId} language={language} open onOpenChange={open=>{if(!open)setConversationId(null)}} onChanged={()=>void refresh()} presentation="panel"/></section>;
  if(loading)return <MarketActivityLoading kind="offers" label={id?'Memuat penawaran…':'Loading your offers…'}/>;
  return <section className="market-activity-panel" aria-label={id?'Penawaran Market':'Market offers'}>
    <div className="market-activity-toolbar"><p>{id?'Penawaran untuk listing Anda dan penawaran yang Anda kirim.':'Offers on your listings and offers you have sent.'}</p><button type="button" className="market-activity-refresh market-activity-icon-action" aria-label={id?'Muat ulang penawaran':'Refresh offers'} title={id?'Muat ulang':'Refresh'} onClick={()=>void refresh()}><Refresh size={15}/></button></div>
    <PushNotificationPrompt language={language} message="activity"/>
    {error&&<div className="market-activity-error" role="alert"><span>{error}</span><button type="button" onClick={()=>void refresh()}>{id?'Coba lagi':'Try again'}</button></div>}
    {!offers.length?<MarketActivityEmpty title={id?'Belum ada penawaran':'No offers yet'} description={id?'Penawaran masuk dan terkirim akan muncul di sini.':'Incoming and sent offers will appear here.'}/>:<div className="market-activity-list">{offers.map(offer=>{
      const expiryCandidates=[offer.offerExpiresAt,offer.listingExpiresAt].filter((value):value is string=>Boolean(value)).map(expiryTime).filter((value):value is number=>value!==null);
      const expiresAt=expiryCandidates.length?new Date(Math.min(...expiryCandidates)).toISOString():null;
      const expired=offer.status==='PENDING'&&expiresAt!==null&&new Date(expiresAt).getTime()<=now;
      const status=expired?'EXPIRED':offer.status;
      const statusLabel:Record<string,string>=id?{PENDING:'Menunggu',ACCEPTED:'Diterima',DECLINED:'Ditolak',COUNTERED:'Dibalas',EXPIRED:'Kedaluwarsa',UNAVAILABLE:'Kartu terjual'}:{PENDING:'Pending',ACCEPTED:'Accepted',DECLINED:'Declined',COUNTERED:'Countered',EXPIRED:'Expired',UNAVAILABLE:'Cards sold'};
      return <article className="market-activity-row market-offer-row" key={offer.threadId}>
      <MarketCardStack cards={offer.items}/>
      <div className="market-activity-row-main"><div className="market-activity-row-title"><span className={`market-offer-direction is-${offer.direction}`}>{offer.direction==='received'?(id?'Diterima':'Received'):(id?'Terkirim':'Sent')}</span><span className={`vault-listing-status is-${status.toLowerCase()}`}>{statusLabel[status]??status}</span></div><h3>{offer.listingTitle}</h3><p>{offer.counterparty|| (id?'Kolektor':'Collector')}<span>|</span>{offer.items.map(item=>`${item.quantity}× ${item.card?.name||item.card?.code||item.printingId}`).join(', ')}</p><small>{id?'Dibuat ':'Created '}{dateLabel(offer.createdAt,id)}</small>{expiresAt&&offer.status==='PENDING'&&!expired&&<small>{id?'Berakhir dalam ':'Ends in '}{countdown(expiresAt,now,id)}</small>}{expired&&<small>{id?'Penawaran ini sudah kedaluwarsa':'This offer has expired'}</small>}</div>
      <strong className="market-activity-price">{money(offer.amount,offer.currency)}</strong>
      <button type="button" className="market-activity-primary" onClick={()=>setConversationId(offer.id)}><Conversation size={16}/><span>{id?'Buka percakapan':'Open conversation'}</span></button>
    </article>})}</div>}
  </section>;
}
