'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {PauseIcon as Pause,PlayIcon as Play,ArrowClockwiseIcon as Renew,ArrowSquareOutIcon as Open,XIcon as Close,ArrowCounterClockwiseIcon as Refresh,MagnifyingGlassIcon as Search,PlusIcon as Plus,PencilSimpleIcon as Pencil,CheckIcon as Check} from '@phosphor-icons/react';
import {MarketActivityEmpty,MarketActivityLoading,MarketCardStack,type MarketActivityCard} from '@/components/tcg/vault/tabs/market-activity-state';

type SellerListing={id:string;title:string;amount:number;currency:string;quantity:number;type:string;status:string;city:string;createdAt:string;expiresAt:string|null;cards:(MarketActivityCard&{unitAmount?:number})[]};
const money=(amount:number,currency:string)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:currency||'IDR',maximumFractionDigits:0}).format(amount);
const expiryTime=(value:string)=>{const raw=value.trim();const iso=/^\d{4}-\d{2}-\d{2}$/.test(raw)?`${raw}T23:59:59Z`:raw.includes('T')?raw:raw.replace(' ','T');const zoned=/([zZ]|[+-]\d{2}(?::?\d{2})?)$/.test(iso)?iso:`${iso}Z`;const parsed=Date.parse(zoned);return Number.isFinite(parsed)?parsed:null};
const shortDate=(value:string,id:boolean)=>{const time=expiryTime(value);return time===null?(id?'Tanggal tidak tersedia':'Date unavailable'):new Intl.DateTimeFormat(id?'id-ID':'en-US',{day:'numeric',month:'short',year:'numeric'}).format(time)};
const countdown=(value:string,now:number,id:boolean)=>{const time=expiryTime(value);if(time===null)return id?'Tanggal akhir tidak tersedia':'Expiry date unavailable';const minutes=Math.max(0,Math.ceil((time-now)/60_000));if(minutes<60)return id?`${minutes} mnt lagi`:`${minutes}m left`;const hours=Math.floor(minutes/60);if(hours<24)return id?`${hours} jam ${minutes%60} mnt lagi`:`${hours}h ${minutes%60}m left`;const days=Math.floor(hours/24);return id?`${days} hari ${hours%24} jam lagi`:`${days}d ${hours%24}h left`};

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
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),60_000);return()=>window.clearInterval(timer)},[]);

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

  const savePrices=async(listing:SellerListing)=>{if(prices.length!==listing.cards.length||prices.some(price=>!Number.isSafeInteger(Number(price))||Number(price)<=0)){setLoadError(id?'Masukkan harga yang valid untuk setiap kartu.':'Enter a valid price for every card.');return}setBusyId(listing.id);setLoadError('');try{const response=await fetch(`/api/listings/${listing.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'price',prices:prices.map(Number),amount:listing.cards.reduce((sum,card,index)=>sum+card.quantity*Number(prices[index]),0)})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error|| (id?'Harga gagal disimpan':'Could not save prices'));setPriceListing('');await refresh()}catch(reason){setLoadError(reason instanceof Error?reason.message:'Could not save prices')}finally{setBusyId('')}};
  if(loading)return <MarketActivityLoading kind="listings" label={id?'Memuat listing Anda…':'Loading your listings…'}/>;
  return <section className="market-activity-panel" aria-label={id?'Listing Anda':'Your listings'}>
    <div className="market-activity-toolbar"><p>{id?'Kelola ketersediaan dan masa aktif listing Anda.':'Manage listing availability and renewals.'}</p><div className="market-activity-toolbar-actions">{onCreateListing&&<button type="button" className="market-activity-primary" onClick={onCreateListing}><Plus size={15}/>{id?'Buat listing':'Create listing'}</button>}<button type="button" className="market-activity-refresh" onClick={()=>void refresh()}><Refresh size={15}/>{id?'Muat ulang':'Refresh'}</button></div></div>
    {loadError&&<div className="market-activity-error" role="alert"><span>{loadError}</span><button type="button" onClick={()=>void refresh()}>{id?'Coba lagi':'Try again'}</button></div>}
    {!listings.length?<MarketActivityEmpty title={id?'Belum ada listing':'No listings yet'} description={id?'Cari kartu dan pilih salinan dari koleksi untuk membuat listing.':'Search for a card, then choose a Vault copy to create a listing.'} action={<div className="market-activity-empty-actions">{onCreateListing?<button type="button" className="market-activity-empty-action" onClick={onCreateListing}>{id?'Cari kartu untuk dijual':'Search cards to list'}<Search size={14}/></button>:<Link className="market-activity-empty-action" href="/market?sell=open">{id?'Cari kartu untuk dijual':'Search cards to list'}<Search size={14}/></Link>}<Link className="market-activity-secondary-action" href="/vault">{id?'Buka koleksi':'Open Vault'}<Open size={14}/></Link></div>}/>:<div className="market-activity-list">{listings.map(listing=>{
      const expiry=listing.expiresAt?expiryTime(listing.expiresAt):null;
      const expired=listing.status==='ACTIVE'&&expiry!==null&&now>0&&expiry<=now;
      const status=expired?'EXPIRED':listing.status;
      const statusLabel=status==='ACTIVE'?(id?'Aktif':'Active'):status==='PAUSED'?(id?'Dijeda':'Paused'):status==='SOLD'?(id?'Terjual':'Sold'):status==='CLOSED'?(id?'Ditutup':'Closed'):(id?'Kedaluwarsa':'Expired');
      return <article className="market-activity-row market-listing-row" key={listing.id}>
        <MarketCardStack cards={listing.cards??[]}/>
        <div className="market-activity-row-main"><div className="market-activity-row-title"><span className={`vault-listing-status is-${status.toLowerCase()}`}>{statusLabel}</span><h3>{listing.title}</h3></div><p>{listing.quantity} {id?'kartu':'cards'}<span>|</span>{listing.city}<span>|</span>{listing.expiresAt?(expired?(id?'Berakhir ':'Ended ')+shortDate(listing.expiresAt,id):(id?'Berakhir dalam ':'Ends in ')+countdown(listing.expiresAt,now,id)):id?'Tanpa batas':'No expiry'}</p></div>
        <div className="market-listing-price-cell">{priceListing===listing.id?<><div className="market-listing-inline-prices">{listing.cards.map((card,index)=><label key={`${card.printingId}-${index}`}><span className="sr-only">{id?'Harga':'Price'}: {card.card?.name||listing.title}, {card.quantity}×</span><input autoFocus={index===0} type="number" min={1} max={100000000000} step={1} required value={prices[index]??''} onChange={e=>setPrices(current=>current.map((p,i)=>i===index?e.target.value:p))}/></label>)}</div><div className="market-listing-price-tools"><button type="button" aria-label={id?'Simpan harga':'Save price'} title={id?'Simpan harga':'Save price'} disabled={busyId===listing.id} onClick={()=>void savePrices(listing)}><Check size={16}/></button><button type="button" aria-label={id?'Batalkan perubahan harga':'Cancel price edit'} title={id?'Batalkan':'Cancel'} disabled={busyId===listing.id} onClick={()=>setPriceListing('')}><Close size={16}/></button></div></>:<><strong className="market-activity-price">{money(listing.amount,listing.currency)}</strong>{listing.type==='WTS'&&['ACTIVE','PAUSED'].includes(listing.status)&&<button type="button" className="market-listing-price-edit" aria-label={id?'Ubah harga':'Edit price'} title={id?'Ubah harga':'Edit price'} onClick={()=>{setPriceListing(listing.id);setPrices(listing.cards.map(c=>String(c.unitAmount||Math.round(listing.amount/listing.quantity))))}}><Pencil size={14}/></button>}</>}</div>
        <div className="market-activity-actions">
          <Link className="market-activity-view-listing" href={`/market/${encodeURIComponent(listing.id)}`}><Open size={14}/><span>{id?'Lihat listing':'View listing'}</span></Link>
          {listing.status==='ACTIVE'&&!expired&&<button type="button" disabled={busyId===listing.id} onClick={()=>void act(listing,'pause')} aria-label={id?'Jeda listing':'Pause listing'}><Pause size={15}/><span>{id?'Jeda':'Pause'}</span></button>}
          {(listing.status==='PAUSED'||listing.status==='CLOSED')&&<button type="button" disabled={busyId===listing.id} onClick={()=>void act(listing,'resume')} aria-label={id?'Lanjutkan listing':'Resume listing'}><Play size={15}/><span>{id?'Lanjutkan':'Resume'}</span></button>}
          {expired&&<button type="button" disabled={busyId===listing.id} onClick={()=>void act(listing,'renew')} aria-label={id?'Perpanjang listing':'Renew listing'}><Renew size={15}/><span>{id?'Perpanjang':'Renew'}</span></button>}
          {listing.status!=='SOLD'&&listing.status!=='CLOSED'&&<button type="button" className="is-danger" disabled={busyId===listing.id} onClick={()=>void act(listing,'close')} aria-label={id?'Tutup listing':'Close listing'}><Close size={15}/><span>{id?'Tutup':'Close'}</span></button>}
        </div>
      </article>;
    })}</div>}
  </section>;
}
