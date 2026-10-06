'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {PauseIcon as Pause,PlayIcon as Play,ArrowClockwiseIcon as Renew,ArrowSquareOutIcon as Open,XIcon as Close,ArrowCounterClockwiseIcon as Refresh,MagnifyingGlassIcon as Search,PlusIcon as Plus} from '@phosphor-icons/react';
import {MarketActivityEmpty,MarketActivityLoading,MarketCardStack,type MarketActivityCard} from '@/components/tcg/vault/tabs/market-activity-state';

type SellerListing={id:string;title:string;amount:number;currency:string;quantity:number;type:string;status:string;city:string;createdAt:string;expiresAt:string|null;cards:(MarketActivityCard&{unitAmount?:number})[]};
const money=(amount:number,currency:string)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:currency||'IDR',maximumFractionDigits:0}).format(amount);
const shortDate=(value:string,id:boolean)=>new Intl.DateTimeFormat(id?'id-ID':'en-US',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${value.replace(' ','T')}Z`));

export function ListingsTab({language,onCreateListing}:{language:'EN'|'ID';onCreateListing?:()=>void}){
  const id=language==='ID';
  const [listings,setListings]=useState<SellerListing[]>([]);
  const [loading,setLoading]=useState(true);
  const [now,setNow]=useState(0);
  const [loadError,setLoadError]=useState('');
  const [busyId,setBusyId]=useState('');
  const [priceListing,setPriceListing]=useState('');
  const [prices,setPrices]=useState<string[]>([]);
  const refresh=useCallback(async(silent=false)=>{
    if(!silent){setLoading(true);setLoadError('')}
    try{
      const response=await fetch('/api/listings/mine',{cache:'no-store'});
      const data=await response.json() as {listings?:SellerListing[];error?:string};
      if(!response.ok)throw new Error(data.error||'Your listings could not be loaded.');
      setListings(data.listings??[]);
      setNow(Date.now());
    }catch(error){if(!silent)setLoadError(error instanceof Error?error.message:'Your listings could not be loaded.');}
    finally{if(!silent)setLoading(false)}
  },[]);
  // Initial loading is represented by the initial state; manual refreshes toggle it later.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void refresh()},[refresh]);
  useEffect(()=>{const timer=window.setInterval(()=>void refresh(true),10_000);return()=>window.clearInterval(timer)},[refresh]);

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

  const savePrices=async(e:React.FormEvent,listing:SellerListing)=>{e.preventDefault();setBusyId(listing.id);setLoadError('');try{const response=await fetch(`/api/listings/${listing.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'price',prices:prices.map(Number),amount:Number(prices[0])*listing.quantity})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error|| (id?'Harga gagal disimpan':'Could not save prices'));setPriceListing('');await refresh()}catch(reason){setLoadError(reason instanceof Error?reason.message:'Could not save prices')}finally{setBusyId('')}};
  if(loading)return <MarketActivityLoading kind="listings" label={id?'Memuat listing Anda…':'Loading your listings…'}/>;
  return <section className="market-activity-panel" aria-label={id?'Listing Anda':'Your listings'}>
    <div className="market-activity-toolbar"><p>{id?'Kelola ketersediaan dan masa aktif listing Anda.':'Manage listing availability and renewals.'}</p><div className="market-activity-toolbar-actions">{onCreateListing&&<button type="button" className="market-activity-primary" onClick={onCreateListing}><Plus size={15}/>{id?'Buat listing':'Create listing'}</button>}<button type="button" className="market-activity-refresh" onClick={()=>void refresh()}><Refresh size={15}/>{id?'Muat ulang':'Refresh'}</button></div></div>
    {loadError&&<div className="market-activity-error" role="alert"><span>{loadError}</span><button type="button" onClick={()=>void refresh()}>{id?'Coba lagi':'Try again'}</button></div>}
    {!listings.length?<MarketActivityEmpty title={id?'Belum ada listing':'No listings yet'} description={id?'Cari kartu dan pilih salinan dari koleksi untuk membuat listing.':'Search for a card, then choose a Vault copy to create a listing.'} action={<div className="market-activity-empty-actions">{onCreateListing?<button type="button" className="market-activity-empty-action" onClick={onCreateListing}>{id?'Cari kartu untuk dijual':'Search cards to list'}<Search size={14}/></button>:<Link className="market-activity-empty-action" href="/market?sell=open">{id?'Cari kartu untuk dijual':'Search cards to list'}<Search size={14}/></Link>}<Link className="market-activity-secondary-action" href="/vault">{id?'Buka koleksi':'Open Vault'}<Open size={14}/></Link></div>}/>:<div className="market-activity-list">{listings.map(listing=>{
      const expired=listing.status==='ACTIVE'&&listing.expiresAt&&now>0&&new Date(`${listing.expiresAt.replace(' ','T')}Z`).getTime()<=now;
      const status=expired?'EXPIRED':listing.status;
      const statusLabel=status==='ACTIVE'?(id?'Aktif':'Active'):status==='PAUSED'?(id?'Dijeda':'Paused'):status==='SOLD'?(id?'Terjual':'Sold'):status==='CLOSED'?(id?'Ditutup':'Closed'):(id?'Kedaluwarsa':'Expired');
      return <article className="market-activity-row market-listing-row" key={listing.id}>
        <MarketCardStack cards={listing.cards??[]}/>
        <div className="market-activity-row-main"><div className="market-activity-row-title"><span className={`vault-listing-status is-${status.toLowerCase()}`}>{statusLabel}</span><h3>{listing.title}</h3></div><p>{listing.quantity} {id?'kartu':'cards'}<span>·</span>{listing.city}<span>·</span>{listing.expiresAt?(id?'Berakhir ':'Ends ')+shortDate(listing.expiresAt,id):id?'Tanpa batas':'No expiry'}</p></div>
        <strong className="market-activity-price">{money(listing.amount,listing.currency)}</strong>
        <div className="market-activity-actions">
          {listing.type==='WTS'&&['ACTIVE','PAUSED'].includes(listing.status)&&<button type="button" disabled={busyId===listing.id} onClick={()=>{setPriceListing(priceListing===listing.id?'':listing.id);setPrices(listing.cards.map(c=>String(c.unitAmount||Math.round(listing.amount/listing.quantity))))}}>{id?'Ubah harga':'Edit prices'}</button>}
          {listing.status==='ACTIVE'&&!expired&&<button type="button" disabled={busyId===listing.id} onClick={()=>void act(listing,'pause')} aria-label={id?'Jeda listing':'Pause listing'}><Pause size={15}/><span>{id?'Jeda':'Pause'}</span></button>}
          {(listing.status==='PAUSED'||listing.status==='CLOSED')&&<button type="button" disabled={busyId===listing.id} onClick={()=>void act(listing,'resume')} aria-label={id?'Lanjutkan listing':'Resume listing'}><Play size={15}/><span>{id?'Lanjutkan':'Resume'}</span></button>}
          {expired&&<button type="button" disabled={busyId===listing.id} onClick={()=>void act(listing,'renew')} aria-label={id?'Perpanjang listing':'Renew listing'}><Renew size={15}/><span>{id?'Perpanjang':'Renew'}</span></button>}
          {listing.status!=='SOLD'&&listing.status!=='CLOSED'&&<button type="button" className="is-danger" disabled={busyId===listing.id} onClick={()=>void act(listing,'close')} aria-label={id?'Tutup listing':'Close listing'}><Close size={15}/><span>{id?'Tutup':'Close'}</span></button>}
        </div>
        {priceListing===listing.id&&<form className="market-listing-price-editor" onSubmit={e=>void savePrices(e,listing)}>{listing.cards.map((card,index)=><label key={`${card.printingId}-${index}`}><span>{card.card?.name||listing.title} - {card.quantity}× ({listing.currency}/{id?'kartu':'card'})</span><input type="number" min={1} max={100000000000} step={1} required value={prices[index]??''} onChange={e=>setPrices(current=>current.map((p,i)=>i===index?e.target.value:p))}/></label>)}<strong>{id?'Total':'Total'}: {money(listing.cards.reduce((sum,c,i)=>sum+c.quantity*(Number(prices[i])||0),0),listing.currency)}</strong><button className="button secondary" disabled={busyId===listing.id}>{id?'Simpan harga':'Save prices'}</button><button className="button secondary" type="button" onClick={()=>setPriceListing('')}>{id?'Batal':'Cancel'}</button></form>}
      </article>;
    })}</div>}
  </section>;
}
