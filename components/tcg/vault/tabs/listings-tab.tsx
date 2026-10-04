'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {PauseIcon as Pause,PlayIcon as Play,ArrowClockwiseIcon as Renew,ArrowSquareOutIcon as Open,XIcon as Close,ArrowCounterClockwiseIcon as Refresh} from '@phosphor-icons/react';
import {MarketActivityEmpty,MarketActivityLoading,MarketCardStack,type MarketActivityCard} from '@/components/tcg/vault/tabs/market-activity-state';

type SellerListing={id:string;title:string;amount:number;currency:string;quantity:number;type:string;status:string;city:string;createdAt:string;expiresAt:string|null;cards:MarketActivityCard[]};
const money=(amount:number,currency:string)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:currency||'IDR',maximumFractionDigits:0}).format(amount);
const shortDate=(value:string,id:boolean)=>new Intl.DateTimeFormat(id?'id-ID':'en-US',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${value.replace(' ','T')}Z`));

export function ListingsTab({language}:{language:'EN'|'ID'}){
  const id=language==='ID';
  const [listings,setListings]=useState<SellerListing[]>([]);
  const [loading,setLoading]=useState(true);
  const [now,setNow]=useState(0);
  const [loadError,setLoadError]=useState('');
  const [busyId,setBusyId]=useState('');
  const refresh=useCallback(async()=>{
    setLoading(true);setLoadError('');
    try{
      const response=await fetch('/api/listings/mine',{cache:'no-store'});
      const data=await response.json() as {listings?:SellerListing[];error?:string};
      if(!response.ok)throw new Error(data.error||'Your listings could not be loaded.');
      setListings(data.listings??[]);
      setNow(Date.now());
    }catch(error){setLoadError(error instanceof Error?error.message:'Your listings could not be loaded.');}
    finally{setLoading(false)}
  },[]);
  // Initial loading is represented by the initial state; manual refreshes toggle it later.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void refresh()},[refresh]);

  const act=async(listing:SellerListing,action:'pause'|'resume'|'close'|'renew')=>{
    setBusyId(listing.id);
    try{
      const endpoint=action==='close'?`/api/listings/${listing.id}`:action==='renew'?`/api/listings/${listing.id}/renew`:`/api/listings/${listing.id}`;
      const response=await fetch(endpoint,{method:action==='close'?'DELETE':action==='renew'?'POST':'PATCH',...(action==='pause'||action==='resume'?{headers:{'content-type':'application/json'},body:JSON.stringify({action})}:{})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error||'Listing could not be updated.');
      await refresh();
    }catch(error){setLoadError(error instanceof Error?error.message:'Listing could not be updated.');}
    finally{setBusyId('')}
  };

  if(loading)return <MarketActivityLoading kind="listings" label={id?'Memuat listing Anda…':'Loading your listings…'}/>;
  return <section className="market-activity-panel" aria-label={id?'Listing Anda':'Your listings'}>
    <div className="market-activity-toolbar"><p>{id?'Kelola ketersediaan dan masa aktif listing Anda.':'Manage listing availability and renewals.'}</p><button type="button" className="market-activity-refresh" onClick={()=>void refresh()}><Refresh size={15}/>{id?'Muat ulang':'Refresh'}</button></div>
    {loadError&&<div className="market-activity-error" role="alert"><span>{loadError}</span><button type="button" onClick={()=>void refresh()}>{id?'Coba lagi':'Try again'}</button></div>}
    {!listings.length?<MarketActivityEmpty title={id?'Belum ada listing':'No listings yet'} description={id?'Listing yang Anda buat dari Vault akan muncul di sini.':'Listings you publish from your Vault will appear here.'} action={<Link className="market-activity-empty-action" href="/vault">{id?'Buka Vault':'Open Vault'}<Open size={14}/></Link>}/>:<div className="market-activity-list">{listings.map(listing=>{
      const expired=listing.status==='ACTIVE'&&listing.expiresAt&&now>0&&new Date(`${listing.expiresAt.replace(' ','T')}Z`).getTime()<=now;
      const status=expired?'EXPIRED':listing.status;
      const statusLabel=status==='ACTIVE'?(id?'Aktif':'Active'):status==='PAUSED'?(id?'Dijeda':'Paused'):status==='SOLD'?(id?'Terjual':'Sold'):status==='CLOSED'?(id?'Ditutup':'Closed'):(id?'Kedaluwarsa':'Expired');
      return <article className="market-activity-row market-listing-row" key={listing.id}>
        <MarketCardStack cards={listing.cards??[]}/>
        <div className="market-activity-row-main"><div className="market-activity-row-title"><span className={`vault-listing-status is-${status.toLowerCase()}`}>{statusLabel}</span><h3>{listing.title}</h3></div><p>{listing.quantity} {id?'kartu':'cards'}<span>·</span>{listing.city}<span>·</span>{listing.expiresAt?(id?'Berakhir ':'Ends ')+shortDate(listing.expiresAt,id):id?'Tanpa batas':'No expiry'}</p></div>
        <strong className="market-activity-price">{money(listing.amount,listing.currency)}</strong>
        <div className="market-activity-actions">
          {listing.status==='ACTIVE'&&!expired&&<button type="button" disabled={busyId===listing.id} onClick={()=>void act(listing,'pause')} aria-label={id?'Jeda listing':'Pause listing'}><Pause size={15}/><span>{id?'Jeda':'Pause'}</span></button>}
          {(listing.status==='PAUSED'||listing.status==='CLOSED')&&<button type="button" disabled={busyId===listing.id} onClick={()=>void act(listing,'resume')} aria-label={id?'Lanjutkan listing':'Resume listing'}><Play size={15}/><span>{id?'Lanjutkan':'Resume'}</span></button>}
          {expired&&<button type="button" disabled={busyId===listing.id} onClick={()=>void act(listing,'renew')} aria-label={id?'Perpanjang listing':'Renew listing'}><Renew size={15}/><span>{id?'Perpanjang':'Renew'}</span></button>}
          {listing.status!=='SOLD'&&listing.status!=='CLOSED'&&<button type="button" className="is-danger" disabled={busyId===listing.id} onClick={()=>void act(listing,'close')} aria-label={id?'Tutup listing':'Close listing'}><Close size={15}/><span>{id?'Tutup':'Close'}</span></button>}
        </div>
      </article>;
    })}</div>}
  </section>;
}
