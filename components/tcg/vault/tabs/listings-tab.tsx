'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {PauseIcon as Pause,PlayIcon as Play,ArrowClockwiseIcon as Renew,ArrowSquareOutIcon as Open,XIcon as Close,ArrowCounterClockwiseIcon as Refresh,PlusIcon as Plus,SpinnerGapIcon as Spinner,StorefrontIcon as Store} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {MarketActivityLoading,MarketCardStack,type MarketActivityCard} from '@/components/tcg/vault/tabs/market-activity-state';
import {VaultPanelEmpty} from '@/components/tcg/vault/vault-panel-empty';
import {marketListingPath} from '@/lib/market/listing-url';
import {MarketListingPriceEdit,MarketListingPriceTerms,MarketListingTitleEdit} from '@/components/tcg/market-listing-inline-edit';

type SellerListing={id:string;title:string;amount:number;currency:string;quantity:number;type:string;status:string;city:string;createdAt:string;expiresAt:string|null;negotiable:boolean;cards:(MarketActivityCard&{unitAmount?:number})[]};
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
  const operationLock=useRef(false);
  const refreshSequence=useRef(0);
  const refresh=useCallback(async(silent=false)=>{
    const sequence=++refreshSequence.current;
    if(!silent){setLoading(true);setLoadError('')}
    try{
      const response=await fetch('/api/listings/mine',{cache:'no-store'});
      const data=await response.json() as {listings?:SellerListing[];error?:string};
      if(!response.ok)throw new Error(data.error||'Your listings could not be loaded.');
      if(sequence!==refreshSequence.current)return;
      setListings(data.listings??[]);
      setNow(Date.now());
    }catch(error){if(!silent&&sequence===refreshSequence.current)setLoadError(error instanceof Error?error.message:'Your listings could not be loaded.');}
    finally{if(sequence===refreshSequence.current)setLoading(false)}
  },[]);
  // Initial loading is represented by the initial state; manual refreshes toggle it later.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void refresh()},[refresh]);
  useEffect(()=>{const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh(true)},30_000);return()=>window.clearInterval(timer)},[refresh]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),60_000);return()=>window.clearInterval(timer)},[]);

  const act=async(listing:SellerListing,action:'pause'|'resume'|'close'|'renew')=>{
    if(operationLock.current)return;
    operationLock.current=true;
    setBusyId(listing.id);
    setLoadError('');
    try{
      const endpoint=action==='close'?`/api/listings/${encodeURIComponent(listing.id)}`:action==='renew'?`/api/listings/${encodeURIComponent(listing.id)}/renew`:`/api/listings/${encodeURIComponent(listing.id)}`;
      const response=await fetch(endpoint,{method:action==='close'?'DELETE':action==='renew'?'POST':'PATCH',...(action==='pause'||action==='resume'?{headers:{'content-type':'application/json'},body:JSON.stringify({action})}:{})});
      const data=await response.json() as {id?:string;status?:string;expiresAt?:string|null;durationDays?:number;error?:string};
      if(!response.ok)throw new Error(data.error||'Listing could not be updated.');
      if(data.id!==listing.id)throw new Error(id?'Listing yang diperbarui tidak cocok. Muat ulang dan coba lagi.':'The updated listing did not match. Refresh and try again.');
      const expectedStatus=action==='pause'?'PAUSED':action==='close'?'CLOSED':'ACTIVE';
      if(data.status!==expectedStatus)throw new Error(id?'Status listing belum dapat dikonfirmasi. Muat ulang dan periksa lagi.':'The listing status could not be confirmed. Refresh and check again.');
      refreshSequence.current++;
      setListings(current=>current.map(item=>item.id===listing.id?{...item,status:data.status!,expiresAt:data.expiresAt??item.expiresAt}:item));
      toast.success(action==='pause'?(id?`“${listing.title}” dijeda`:`“${listing.title}” paused`):action==='resume'?(id?`“${listing.title}” aktif kembali`:`“${listing.title}” is active again`):action==='close'?(id?`“${listing.title}” ditutup`:`“${listing.title}” closed`):(id?`“${listing.title}” diperpanjang ${data.durationDays??''} hari`:`“${listing.title}” renewed for ${data.durationDays??''} days`));
      if(action==='pause'||action==='resume'){try{navigator.vibrate?.(10)}catch{}}
    }catch(error){const message=error instanceof Error?error.message:'Listing could not be updated.';setLoadError(message);toast.error(message);}
    finally{operationLock.current=false;setBusyId('')}
  };

  if(loading)return <MarketActivityLoading kind="listings" label={id?'Memuat listing Anda…':'Loading your listings…'}/>;
  return <section className="market-activity-panel" aria-label={id?'Listing Anda':'Your listings'}>
    <div className="market-activity-toolbar is-compact"><div className="market-activity-toolbar-actions">{onCreateListing&&<button type="button" className="market-activity-primary" onClick={onCreateListing}><Plus size={15}/>{id?'Buat listing':'Create listing'}</button>}<button type="button" className="market-activity-refresh market-activity-icon-action" aria-label={id?'Muat ulang listing':'Refresh listings'} title={id?'Muat ulang':'Refresh'} onClick={()=>void refresh()}><Refresh size={15}/></button></div></div>
    {loadError&&<div className="market-activity-error" role="alert"><span>{loadError}</span><button type="button" onClick={()=>void refresh()}>{id?'Coba lagi':'Try again'}</button></div>}
    {!listings.length?<VaultPanelEmpty title={id?'Belum ada listing':'No listings yet'} description={id?'Pilih kartu dari Vault untuk mulai menjual.':'Choose cards from your Vault to start selling.'} icon={<Store size={22}/>} action={<div className="vault-panel-empty-actions is-paired">{onCreateListing?<button type="button" className="vault-btn vault-btn-primary" onClick={onCreateListing}>{id?'Buat listing':'Create listing'}<Plus size={14}/></button>:<Link className="vault-btn vault-btn-primary" href="/market?sell=open">{id?'Buat listing':'Create listing'}<Plus size={14}/></Link>}<Link className="vault-btn vault-btn-secondary" href="/vault">{id?'Buka Vault':'Open Vault'}<Open size={14}/></Link></div>}/>:<div className="market-activity-list">{listings.map(listing=>{
      const expiry=listing.expiresAt?expiryTime(listing.expiresAt):null;
      const expired=listing.status==='ACTIVE'&&expiry!==null&&now>0&&expiry<=now;
      const status=expired?'EXPIRED':listing.status;
      const statusLabel=status==='ACTIVE'?(id?'Aktif':'Active'):status==='PAUSED'?(id?'Dijeda':'Paused'):status==='SOLD'?(id?'Terjual':'Sold'):status==='CLOSED'?(id?'Ditutup':'Closed'):(id?'Kedaluwarsa':'Expired');
      return <article className="market-activity-row market-listing-row" key={listing.id} aria-busy={busyId===listing.id}>
        <MarketCardStack cards={listing.cards??[]}/>
        <div className="market-activity-row-main"><div className="market-activity-row-title"><span className={`vault-listing-status is-${status.toLowerCase()}`}>{statusLabel}</span>{['ACTIVE','PAUSED'].includes(listing.status)?<MarketListingTitleEdit variant="row" listingId={listing.id} title={listing.title} language={language} onSaved={title=>setListings(current=>current.map(item=>item.id===listing.id?{...item,title}:item))}><h3>{listing.title}</h3></MarketListingTitleEdit>:<h3>{listing.title}</h3>}</div><p>{listing.quantity} {id?'kartu':'cards'}<span>|</span>{listing.city}{listing.type==='WTS'&&<><span>|</span>{['ACTIVE','PAUSED'].includes(listing.status)?<MarketListingPriceTerms listingId={listing.id} negotiable={listing.negotiable} language={language} onSaved={negotiable=>setListings(current=>current.map(item=>item.id===listing.id?{...item,negotiable}:item))}/>:listing.negotiable?(id?'Bisa ditawar':'Negotiable'):(id?'Harga pas':'Firm price')}</>}<span>|</span>{listing.expiresAt?(expired?(id?'Berakhir ':'Ended ')+shortDate(listing.expiresAt,id):(id?'Berakhir dalam ':'Ends in ')+countdown(listing.expiresAt,now,id)):id?'Tanpa batas':'No expiry'}</p></div>
        <div className="market-listing-price-cell">{['ACTIVE','PAUSED'].includes(listing.status)?<MarketListingPriceEdit listingId={listing.id} title={listing.title} listingType={listing.type==='WTB'?'WTB':'WTS'} amount={listing.amount} currency={listing.currency} cards={listing.cards.map(card=>({printingId:card.printingId,name:card.card?.name||card.printingId,quantity:card.quantity,unitAmount:card.unitAmount||Math.round(listing.amount/listing.quantity)}))} language={language} onSaved={updated=>setListings(current=>current.map(item=>item.id===listing.id?{...item,amount:updated.amount,cards:item.cards.map((card,index)=>({...card,unitAmount:updated.prices[index]??card.unitAmount}))}:item))}><strong className="market-activity-price">{money(listing.amount,listing.currency)}</strong></MarketListingPriceEdit>:<strong className="market-activity-price">{money(listing.amount,listing.currency)}</strong>}</div>
        <div className="market-activity-actions">
          <Link className="market-activity-view-listing" href={marketListingPath(listing.title,listing.id)}><Open size={14}/><span>{id?'Lihat listing':'View listing'}</span></Link>
          {listing.status==='ACTIVE'&&!expired&&<button type="button" disabled={Boolean(busyId)} onClick={()=>void act(listing,'pause')} aria-label={busyId===listing.id?(id?'Menjeda listing':'Pausing listing'):(id?'Jeda listing':'Pause listing')}>{busyId===listing.id?<Spinner className="is-spinning" size={15}/>:<Pause size={15}/>}<span>{busyId===listing.id?(id?'Menjeda…':'Pausing…'):(id?'Jeda':'Pause')}</span></button>}
          {(listing.status==='PAUSED'||listing.status==='CLOSED')&&<button type="button" disabled={Boolean(busyId)} onClick={()=>void act(listing,'resume')} aria-label={busyId===listing.id?(id?'Mengaktifkan listing':'Resuming listing'):(id?'Lanjutkan listing':'Resume listing')}>{busyId===listing.id?<Spinner className="is-spinning" size={15}/>:<Play size={15}/>}<span>{busyId===listing.id?(id?'Mengaktifkan…':'Resuming…'):(id?'Lanjutkan':'Resume')}</span></button>}
          {expired&&<button type="button" disabled={Boolean(busyId)} onClick={()=>void act(listing,'renew')} aria-label={id?'Perpanjang listing':'Renew listing'}>{busyId===listing.id?<Spinner className="is-spinning" size={15}/>:<Renew size={15}/>}<span>{busyId===listing.id?(id?'Memperpanjang…':'Renewing…'):(id?'Perpanjang':'Renew')}</span></button>}
          {listing.status!=='SOLD'&&listing.status!=='CLOSED'&&<button type="button" className="is-danger" disabled={Boolean(busyId)} onClick={()=>{if(window.confirm(id?`Tutup listing “${listing.title}”?`:`Close “${listing.title}”?`))void act(listing,'close')}} aria-label={id?'Tutup listing':'Close listing'}>{busyId===listing.id?<Spinner className="is-spinning" size={15}/>:<Close size={15}/>}<span>{busyId===listing.id?(id?'Menutup…':'Closing…'):(id?'Tutup':'Close')}</span></button>}
        </div>
      </article>;
    })}</div>}
  </section>;
}
