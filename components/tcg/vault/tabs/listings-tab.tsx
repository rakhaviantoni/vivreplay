'use client';

import {useCallback,useEffect,useState} from 'react';
import {PauseIcon as Pause,PlayIcon as Play,ArrowClockwiseIcon as Renew, XIcon as Close} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {OfferConversation} from '@/components/tcg/vault/offer-conversation';

type SellerListing={id:string;title:string;amount:number;currency:string;quantity:number;type:string;status:string;city:string;createdAt:string;expiresAt:string|null};
type Offer={id:string;threadId:string;parentOfferId:string|null;listingId:string;listingTitle:string;listingType:string;direction:'received'|'sent';counterparty:string|null;type:string;status:string;amount:number;currency:string;createdAt:string;items:Array<{printingId:string;quantity:number;unitAmount?:number;card?:{name:string;code:string;language:string;variant:string;imageUrl:string|null}}>};
const money=(amount:number,currency:string)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:currency||'IDR',maximumFractionDigits:0}).format(amount);

export function ListingsTab({language}:{language:'EN'|'ID'}){
  const id=language==='ID';
  const [listings,setListings]=useState<SellerListing[]>([]);
  const [offers,setOffers]=useState<Offer[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [busyId,setBusyId]=useState('');
  const [conversationOffer,setConversationOffer]=useState<string|null>(null);
  const refresh=useCallback(async()=>{
    setLoading(true);
    setLoadError('');
    try{
      const [listingResponse,offerResponse]=await Promise.all([fetch('/api/listings/mine',{cache:'no-store'}),fetch('/api/listings/offers/mine',{cache:'no-store'})]);
      const [listingData,offerData]=await Promise.all([listingResponse.json() as Promise<{listings?:SellerListing[];error?:string}>,offerResponse.json() as Promise<{offers?:Offer[];error?:string}>]);
      if(!listingResponse.ok)throw new Error(listingData.error||'Listings could not be loaded.');
      if(!offerResponse.ok)throw new Error(offerData.error||'Offers could not be loaded.');
      setListings(listingData.listings??[]);setOffers(offerData.offers??[]);
    }
    catch(error){const message=error instanceof Error?error.message:'Your Market activity could not be loaded.';setLoadError(message);toast.error(message);}
    finally{setLoading(false)}
  },[]);
  useEffect(()=>{void refresh()},[refresh]);
  const act=async(listing:SellerListing,action:'pause'|'resume'|'close'|'renew')=>{
    setBusyId(listing.id);
    try{
      const endpoint=action==='close'?`/api/listings/${listing.id}`:action==='renew'?`/api/listings/${listing.id}/renew`:`/api/listings/${listing.id}`;
      const response=await fetch(endpoint,{method:action==='close'?'DELETE':action==='renew'?'POST':'PATCH',...(action==='pause'||action==='resume'?{headers:{'content-type':'application/json'},body:JSON.stringify({action})}:{})});
      const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||'Listing could not be updated.');
      toast.success(action==='pause'?(id?'Listing dijeda':'Listing paused'):action==='resume'?(id?'Listing dilanjutkan':'Listing resumed'):action==='close'?(id?'Listing ditutup':'Listing closed'):(id?'Listing diperpanjang':'Listing renewed'));
      await refresh();
    }catch(error){toast.error(error instanceof Error?error.message:'Listing could not be updated.')}finally{setBusyId('')}
  };
  if(loading)return <section className="vault-listings-panel" aria-busy="true"><p>{id?'Memuat listing…':'Loading your listings…'}</p></section>;
  return <section className="vault-listings-panel">
    {loadError&&<div className="vault-listings-load-error" role="alert"><span>{loadError}</span><button type="button" className="vault-btn vault-btn-secondary" onClick={()=>void refresh()}>{id?'Coba lagi':'Try again'}</button></div>}
    <div className="vault-listings-heading"><div><h2>{id?'Listing Saya':'My listings'}</h2><p>{id?'Kelola listing Market, termasuk jeda, lanjutkan, dan tutup.':'Manage Market listings: pause, resume, renew, or close them.'}</p></div><button type="button" className="vault-btn vault-btn-secondary" onClick={()=>void refresh()}>{id?'Muat ulang':'Refresh'}</button></div>
    {!listings.length?<div className="vault-listings-empty"><strong>{id?'Belum ada listing':'No listings yet'}</strong><span>{id?'Pilih beberapa kartu di Koleksi untuk membuat satu listing bundle.':'Select cards from Collection to publish a single bundle listing.'}</span></div>:<div className="vault-listings-list">{listings.map(listing=>{
      const expired=listing.status==='ACTIVE'&&listing.expiresAt&&new Date(`${listing.expiresAt.replace(' ','T')}Z`).getTime()<=Date.now();
      const status=expired?'EXPIRED':listing.status;
      return <article className="vault-listing-row" key={listing.id}><div className="vault-listing-main"><div className="vault-listing-title-row"><h3>{listing.title}</h3><span className={`vault-listing-status is-${status.toLowerCase()}`}>{status==='ACTIVE'?(id?'Aktif':'Active'):status==='PAUSED'?(id?'Dijeda':'Paused'):status==='SOLD'?(id?'Terjual':'Sold'):status==='CLOSED'?(id?'Ditutup':'Closed'):(id?'Kedaluwarsa':'Expired')}</span></div><p>{listing.quantity} {id?'kartu':'cards'} · {listing.city} · {listing.expiresAt?(id?'Berakhir ':'Ends ')+new Date(`${listing.expiresAt.replace(' ','T')}Z`).toLocaleDateString(id?'id-ID':'en-US'):id?'Tanpa batas':'No expiry'}</p></div><strong className="vault-listing-price">{money(listing.amount,listing.currency)}</strong><div className="vault-listing-actions">
        {listing.status==='ACTIVE'&&!expired&&<button type="button" disabled={busyId===listing.id} onClick={()=>void act(listing,'pause')} aria-label={id?'Jeda listing':'Pause listing'} title={id?'Jeda':'Pause'}><Pause size={16}/><span>{id?'Jeda':'Pause'}</span></button>}
        {(listing.status==='PAUSED'||listing.status==='CLOSED')&&<button type="button" disabled={busyId===listing.id} onClick={()=>void act(listing,'resume')} aria-label={id?'Lanjutkan listing':'Resume listing'} title={id?'Lanjutkan':'Resume'}><Play size={16}/><span>{id?'Lanjutkan':'Resume'}</span></button>}
        {expired&&<button type="button" disabled={busyId===listing.id} onClick={()=>void act(listing,'renew')} aria-label={id?'Perpanjang listing':'Renew listing'} title={id?'Perpanjang':'Renew'}><Renew size={16}/><span>{id?'Perpanjang':'Renew'}</span></button>}
        {listing.status!=='SOLD'&&listing.status!=='CLOSED'&&<button type="button" className="is-danger" disabled={busyId===listing.id} onClick={()=>void act(listing,'close')} aria-label={id?'Tutup listing':'Close listing'} title={id?'Tutup':'Close'}><Close size={16}/><span>{id?'Tutup':'Close'}</span></button>}
      </div></article>})}</div>}
    <section className="vault-offers-panel" aria-labelledby="vault-offers-title"><div className="vault-listings-heading"><div><h2 id="vault-offers-title">{id?'Penawaran':'Offers'}</h2><p>{id?'Penawaran masuk pada listing Anda dan penawaran yang Anda kirim.':'Offers on your listings and offers you have sent.'}</p></div></div>
      {!offers.length?<div className="vault-listings-empty"><strong>{id?'Belum ada penawaran':'No offers yet'}</strong><span>{id?'Penawaran masuk dan terkirim akan muncul di sini.':'Incoming and sent Market offers will appear here.'}</span></div>:<div className="vault-listings-list">{offers.filter((offer,index)=>offers.findIndex(item=>item.threadId===offer.threadId)===index).map(offer=><article className="vault-offer-row" key={offer.threadId}><div className="vault-offer-cards">{offer.items.slice(0,3).map(item=><span key={item.printingId}>{item.card?.imageUrl?<img src={item.card.imageUrl} alt=""/>:null}</span>)}</div><div className="vault-listing-main"><div className="vault-listing-title-row"><h3>{offer.listingTitle}</h3><span className={`vault-listing-status is-${offer.status.toLowerCase()}`}>{offer.status}</span></div><p><b className={`vault-offer-direction is-${offer.direction}`}>{offer.direction==='received'?(id?'Diterima':'Received'):(id?'Terkirim':'Sent')}</b> · {offer.counterparty|| (id?'Kolektor':'Collector')} · {offer.items.map(item=>`${item.quantity}× ${item.card?.name||item.card?.code||item.printingId}`).join(', ')}</p><small>{new Date(`${offer.createdAt.replace(' ','T')}Z`).toLocaleString(id?'id-ID':'en-US')}</small></div><strong className="vault-listing-price">{money(offer.amount,offer.currency)}</strong><button type="button" className="vault-btn vault-btn-secondary vault-offer-open" onClick={()=>setConversationOffer(offer.id)}>{id?'Buka percakapan':'Open conversation'}</button></article>)}</div>}
    </section>
    {conversationOffer&&<OfferConversation offerId={conversationOffer} language={language} open onOpenChange={open=>{if(!open)setConversationOffer(null)}} onChanged={()=>void refresh()}/>}
  </section>;
}
