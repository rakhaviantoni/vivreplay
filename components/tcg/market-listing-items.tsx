'use client';

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {InfoIcon as Info, MinusIcon as Minus, PlusIcon as Plus, TruckIcon as Truck, XIcon as X, MapPinIcon as MapPin} from '@phosphor-icons/react';
import type {Card} from '@/packages/card-data/catalog';
import {formatMoney,Listing} from '@/packages/domain';
import {CardArt} from './card-art';
import {CardPreviewModal} from './card-preview-modal';
import {ShareButton} from './share';
import {MarketTimestamp} from './market-timestamp';
import {authClient} from '@/lib/auth-client';
import {toast} from 'sonner';
import {getDaysUntilExpiration, isListingExpired} from '@/lib/market/policy';

type CourierRate={courier_name:string;courier_service_name:string;price:number;duration?:string;max_km?:number};
const COURIER_LABELS:Record<string,string>={'jne':'JNE','jnt':'J&T Express','sicepat':'SiCepat','anteraja':'Anteraja','tiki':'TIKI','grab_instant':'Grab Instant','gojek_instant':'Gojek Instant'};
const INSTANT_COURIERS=new Set(['grab_instant','gojek_instant']);

const DEFAULT_COURIERS:CourierRate[]=[
  {courier_name:'jnt',courier_service_name:'J&T EZ',price:0},
  {courier_name:'grab_instant',courier_service_name:'Grab Instant',price:0,max_km:40},
  {courier_name:'gojek_instant',courier_service_name:'Gojek Instant',price:0,max_km:40},
];

export function ShippingOptions({listingId,courierCount=3,variant='fact'}:{listingId:string;courierCount?:number;variant?:'fact'|'compact';}){
  const [open,setOpen]=useState(false);
  const [rates,setRates]=useState<CourierRate[]>([]);
  const [loading,setLoading]=useState(false);
  const [fetched,setFetched]=useState(false);
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');
  const dialogRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const sync=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    sync();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);

  const t=(en:string,idStr:string)=>language==='ID'?idStr:en;

  const openDialog=async()=>{
    setOpen(true);
    if(fetched)return;
    setLoading(true);
    try{
      const res=await fetch('/api/shipping/quotes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listingId})});
      const data=await res.json() as {pricing?:CourierRate[];error?:string};
      if(res.ok&&Array.isArray(data.pricing)&&data.pricing.length>0)setRates(data.pricing);
    }catch{/* no-op */}finally{setLoading(false);setFetched(true);}
  };

  useEffect(()=>{
    if(!open)return;
    const handler=(e:MouseEvent)=>{if(dialogRef.current&&!dialogRef.current.contains(e.target as Node))setOpen(false);};
    document.addEventListener('mousedown',handler,true);
    return()=>document.removeEventListener('mousedown',handler,true);
  },[open]);

  useEffect(()=>{
    if(!open)return;
    const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
    document.addEventListener('keydown',handler);
    return()=>document.removeEventListener('keydown',handler);
  },[open]);

  const activeRates=rates.length>0?rates:DEFAULT_COURIERS;
  const noAddress=!loading&&fetched&&rates.length===0;

  const modal=open?(
    <div className="shipping-options-backdrop" role="presentation" onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(false);}}>
      <div className="shipping-options-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('Shipping Options','Opsi Pengiriman')} onClick={e=>{e.preventDefault();e.stopPropagation();}}>
        <header className="shipping-options-header">
          <strong>{t('Shipping Options','Opsi Pengiriman')}</strong>
          <button type="button" className="shipping-options-close" onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(false);}} aria-label={t('Close','Tutup')}><X size={15}/></button>
        </header>
        <div className="shipping-options-body">
          {loading&&<p className="shipping-options-loading">{t('Loading shipping options…','Memuat opsi pengiriman…')}</p>}
          {!loading&&(
            <ul className="shipping-options-list">
              {activeRates.map((rate,i)=>(
                <li key={i} className="shipping-options-item">
                  <span className="shipping-options-courier">
                    <strong>{rate.courier_service_name||COURIER_LABELS[rate.courier_name]||rate.courier_name}</strong>
                    {rate.courier_service_name&&COURIER_LABELS[rate.courier_name]&&rate.courier_service_name!==COURIER_LABELS[rate.courier_name]&&(
                      <small>{COURIER_LABELS[rate.courier_name]}</small>
                    )}
                  </span>
                  <div className="shipping-options-meta">
                    {INSTANT_COURIERS.has(rate.courier_name)&&rate.max_km!=null&&(
                      <span className="shipping-options-constraint">{t('max','maks')} {rate.max_km} km</span>
                    )}
                    {rate.price>0&&(
                      <span className="shipping-options-rate-price">{formatMoney(rate.price,'IDR')}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="shipping-options-footer">
          <p>{t('Shipping fee is calculated from your address at checkout.','Ongkir dihitung dari alamatmu saat pembayaran.')}</p>
          <Link href="/profile" className="button shipping-options-address-btn" onClick={e=>e.stopPropagation()}>
            {t('Set address to calculate shipping','Atur alamat untuk lihat ongkir')}
          </Link>
        </footer>
      </div>
    </div>
  ):null;

  if(variant==='compact'){
    return(
      <>
        <span
          role="button"
          tabIndex={0}
          className="market-feed-shipping-trigger"
          onClick={e=>{e.preventDefault();e.stopPropagation();openDialog();}}
          onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();openDialog();}}}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Truck size={11}/>
          <span>{courierCount} {t('shipping options available','pengiriman tersedia')}</span>
        </span>
        {modal}
      </>
    );
  }

  return(
    <div className="shipping-options-fact">
      <dt><Truck size={11}/>{t('Shipping','Pengiriman')}</dt>
      <dd>
        <button type="button" className="shipping-options-trigger" onClick={openDialog} aria-haspopup="dialog" aria-expanded={open}>
          {courierCount} {t('shipping options available','pengiriman tersedia')}
        </button>
        {modal}
      </dd>
    </div>
  );
}

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
  const [customPrices,setCustomPrices]=useState<Record<string,number>>({});
  const [preview,setPreview]=useState<Card>();
  const {data:session}=authClient.useSession();
  const [submitting,setSubmitting]=useState(false); const [submitted,setSubmitted]=useState(false);
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');

  useEffect(()=>{
    const sync=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    sync();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);

  const t=(en:string,idStr:string)=>language==='ID'?idStr:en;

  const selectedCount=useMemo(()=>Object.values(selected).reduce((total,amount)=>total+amount,0),[selected]);
  const originalTotal=useMemo(()=>items.reduce((total,item)=>total+(selected[item.id]??0)*item.unitAmount,0),[items,selected]);
  const selectedTotal=useMemo(()=>items.reduce((total,item)=>{
    const qty=selected[item.id]??0;
    const unitPrice=customPrices[item.id]!==undefined?customPrices[item.id]:item.unitAmount;
    return total+qty*unitPrice;
  },0),[items,selected,customPrices]);

  const hasPriceAdjustments=useMemo(()=>{
    return items.some(item=>{
      const qty=selected[item.id]??0;
      return qty>0&&customPrices[item.id]!==undefined&&customPrices[item.id]!==item.unitAmount;
    });
  },[items,selected,customPrices]);

  const totalDiffPercent=originalTotal>0?Math.round(((selectedTotal-originalTotal)/originalTotal)*100):0;

  const getUnitPrice=(item:MarketListingCard)=>{
    return customPrices[item.id]!==undefined?customPrices[item.id]:item.unitAmount;
  };

  const adjustPricePercent=(item:MarketListingCard,percent:number)=>{
    const raw=Math.round(item.unitAmount*(1+percent/100));
    const rounded=currency==='IDR'&&item.unitAmount>=10000?Math.round(raw/1000)*1000:raw;
    const finalPrice=Math.max(1,rounded);
    setCustomPrices(prev=>({...prev,[item.id]:finalPrice}));
  };

  const resetPrice=(id:string)=>{
    setCustomPrices(prev=>{
      const next={...prev};
      delete next[id];
      return next;
    });
  };

  const change=(id:string,delta:number,maximum:number)=>setSelected(current=>{
    const next=Math.max(0,Math.min(maximum,(current[id]??0)+delta));
    return {...current,[id]:next};
  });
  const isBuying=listingType==='WTS';
  const actionLabel=isBuying?t('Make offer','Ajukan penawaran'):t('Offer cards','Tawarkan kartu');
  const continueOffer=async()=>{
    if(!session){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return;}
    setSubmitting(true);try{const offerItems=items.flatMap(item=>{const quantity=selected[item.id]??0;if(!quantity)return[];const unitAmount=getUnitPrice(item);return [{printingId:item.id,quantity,unitAmount}];});const response=await fetch(`/api/listings/${encodeURIComponent(listingId)}/offers`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:isBuying?'BUY':'SELL',items:offerItems,amount:selectedTotal,currency})});const payload=await response.json() as {error?:string};if(!response.ok)throw new Error(payload.error??t('We could not send your offer.','Gagal mengirimkan penawaran Anda.'));setSubmitted(true);toast.success(isBuying?t('Offer sent to the seller.','Penawaran dikirim ke penjual.'):t('Your cards were offered to the buyer.','Kartu Anda ditawarkan ke pembeli.'));}catch(error){toast.error(error instanceof Error?error.message:t('We could not send your offer.','Gagal mengirimkan penawaran Anda.'))}finally{setSubmitting(false)}
  };

  return <section className="market-listing-cards" aria-labelledby="listing-cards-heading">
    <header><h2 id="listing-cards-heading">{t('Cards in this listing','Kartu dalam listing ini')}</h2></header>
    <div className="market-listing-card-grid">
      {items.map(item=>{
        const amount=selected[item.id]??0;
        const unitPrice=getUnitPrice(item);
        const diffPercent=item.unitAmount>0?Math.round(((unitPrice-item.unitAmount)/item.unitAmount)*100):0;
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
            <p><span>{item.condition}</span><em>{amount}/{item.quantity} {t('selected','dipilih')}</em></p>
            <b>{formatMoney(item.unitAmount,currency)} {t('each','per kartu')}</b>

            {amount>0 && (
              <div className="market-card-offer">
                <div className="market-card-offer-label">
                  <span>{t('Offer price / card:','Tawar harga / kartu:')}</span>
                  {unitPrice!==item.unitAmount && (
                    <span className={`market-card-offer-badge ${diffPercent<0?'is-below':'is-above'}`}>
                      {diffPercent>0?`+${diffPercent}%`:`${diffPercent}%`}
                    </span>
                  )}
                </div>
                <div className="market-card-offer-input-row">
                  <input
                    type="number"
                    min={1}
                    step={currency==='IDR'?1000:1}
                    value={unitPrice}
                    onChange={e=>{
                      const val=Math.max(1,Math.round(Number(e.target.value)||0));
                      setCustomPrices(prev=>({...prev,[item.id]:val}));
                    }}
                    aria-label={`${t('Offer price for','Tawaran harga untuk')} ${item.card.name}`}
                  />
                </div>
                <div className="market-card-offer-steppers">
                  <button
                    type="button"
                    onClick={()=>adjustPricePercent(item,-10)}
                    title={t('10% below asking','10% di bawah harga')}
                  >
                    -10%
                  </button>
                  <button
                    type="button"
                    onClick={()=>adjustPricePercent(item,-5)}
                    title={t('5% below asking','5% di bawah harga')}
                  >
                    -5%
                  </button>
                  <button
                    type="button"
                    className={unitPrice===item.unitAmount?'is-active':''}
                    onClick={()=>resetPrice(item.id)}
                    title={t('Reset to asking price','Kembalikan ke harga asli')}
                  >
                    {t('Ask','Pas')}
                  </button>
                  <button
                    type="button"
                    onClick={()=>adjustPricePercent(item,5)}
                    title={t('5% above asking','5% di atas harga')}
                  >
                    +5%
                  </button>
                  <button
                    type="button"
                    onClick={()=>adjustPricePercent(item,10)}
                    title={t('10% above asking','10% di atas harga')}
                  >
                    +10%
                  </button>
                </div>
                {amount>1 && (
                  <div className="market-card-offer-subtotal">
                    <small>{t('Line subtotal:','Subtotal baris:')}</small>
                    <strong>{formatMoney(amount*unitPrice,currency)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </article>;
      })}
    </div>
    {preview&&<CardPreviewModal card={preview} language={preview.language==='JP'?'JP':'EN'} cards={items.map(item=>item.card)} onClose={()=>setPreview(undefined)} onNavigate={setPreview}/>}
    <footer className="market-listing-selection" aria-live="polite">
      <div className="market-listing-selection-info">
        <span>{submitted?t('Offer sent - awaiting a response.','Penawaran terkirim - menunggu tanggapan.'):selectedCount?(language==='ID'?`${selectedCount} kartu dipilih`:`${selectedCount} ${selectedCount===1?'card':'cards'} selected`):t('Select cards to calculate a total','Pilih kartu untuk menghitung total')}</span>
        <div className="market-listing-pricing-block">
          {hasPriceAdjustments && originalTotal>0 && (
            <span className="market-listing-asking-total">
              <small>{t('Asking:','Harga listing:')}</small>
              <s>{formatMoney(originalTotal,currency)}</s>
            </span>
          )}
          <div className="market-listing-final-total">
            {hasPriceAdjustments && <small>{t('Your offer:','Tawaran Anda:')}</small>}
            <strong>{formatMoney(selectedTotal,currency)}</strong>
            {hasPriceAdjustments && totalDiffPercent!==0 && (
              <span className={`market-listing-diff-chip ${totalDiffPercent<0?'is-below':'is-above'}`}>
                {totalDiffPercent>0?`+${totalDiffPercent}%`:`${totalDiffPercent}%`}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="market-listing-selection-actions">
        <button type="button" className="button" disabled={!selectedCount||submitting||submitted} onClick={continueOffer}>{submitted?t('Offer sent','Penawaran terkirim'):submitting?t('Sending...','Mengirim...'):session?(hasPriceAdjustments?t('Submit offer','Kirim penawaran'):actionLabel):(language==='ID'?`Masuk untuk ${isBuying?'menawar':'menawarkan'}`:`Sign in to ${actionLabel.toLowerCase()}`)}</button>
        <ShareButton
          title={listingTitle ?? t('Card listing','Listing kartu')}
          path={`/market/${listingId}`}
          cards={items.map(item => ({
            card: item.card,
            quantity: item.quantity,
            condition: item.condition,
            unitAmount: getUnitPrice(item),
          }))}
          price={formatMoney(selectedTotal || items[0]?.unitAmount, currency)}
          subtitle={language==='ID'?`${items.reduce((acc, it) => acc + it.quantity, 0)} kartu · ${items.length} item`:`${items.reduce((acc, it) => acc + it.quantity, 0)} ${items.reduce((acc, it) => acc + it.quantity, 0) === 1 ? 'card' : 'cards'} · ${items.length} ${items.length === 1 ? 'item' : 'items'}`}
        />
      </div>
    </footer>
  </section>;
}

export function MarketListingDetailView({
  listing,
  stored,
  listingCards,
  primary,
  cardCount,
  isOwner = false,
  initialExpired = false,
}: {
  listing: Listing;
  stored?: (Listing & { username: string }) | null;
  listingCards: MarketListingCard[];
  primary: MarketListingCard;
  cardCount: number;
  isOwner?: boolean;
  initialExpired?: boolean;
}) {
  const [language, setLanguage] = useState<'EN' | 'ID'>('EN');
  const [expiresAt, setExpiresAt] = useState<string | undefined>(listing.expiresAt);
  const [status, setStatus] = useState<string>(initialExpired ? 'EXPIRED' : 'ACTIVE');
  const [renewing, setRenewing] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const sync = () => setLanguage(window.localStorage.getItem('vivreplay-locale') === 'ID' ? 'ID' : 'EN');
    const onLocale = (event: Event) => setLanguage((event as CustomEvent<'EN' | 'ID'>).detail === 'ID' ? 'ID' : 'EN');
    sync();
    window.addEventListener('vivreplay:locale', onLocale);
    return () => window.removeEventListener('vivreplay:locale', onLocale);
  }, []);

  const t = (en: string, idStr: string) => language === 'ID' ? idStr : en;
  const isBuying = listing.type === 'WTB';
  const typeLabel = isBuying ? t('Buying', 'Dicari') : t('Selling', 'Dijual');

  const daysLeft = expiresAt ? getDaysUntilExpiration(expiresAt) : null;
  const isExpired = status !== 'ACTIVE' || (expiresAt ? isListingExpired(expiresAt) : false);

  const handleRenew = async () => {
    setRenewing(true);
    try {
      const res = await fetch(`/api/listings/${encodeURIComponent(listing.id)}/renew`, {
        method: 'POST',
      });
      const data = await res.json() as {ok?: boolean; expiresAt?: string; durationDays?: number; error?: string};
      if (!res.ok) throw new Error(data.error || 'Failed to renew listing');
      setExpiresAt(data.expiresAt);
      setStatus('ACTIVE');
      toast.success(language === 'ID' ? `Listing diperbarui untuk ${data.durationDays || 30} hari ke depan` : `Listing renewed for ${data.durationDays || 30} days`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not renew listing');
    } finally {
      setRenewing(false);
    }
  };

  const handleClose = async () => {
    if (!confirm(language === 'ID' ? 'Tutup listing ini?' : 'Close this listing?')) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/listings/${encodeURIComponent(listing.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json() as {ok?: boolean; error?: string};
      if (!res.ok) throw new Error(data.error || 'Failed to close listing');
      setStatus('CLOSED');
      toast.success(language === 'ID' ? 'Listing ditutup' : 'Listing closed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not close listing');
    } finally {
      setClosing(false);
    }
  };

  return (
    <main className="page live-card-detail market-listing-detail">
      <Link className="back-link" href="/market">
        ← {t('Back to Market', 'Kembali ke Market')}
      </Link>
      <article className="live-detail-layout market-listing-layout">
        <aside className="live-detail-art viewer-primary-art market-listing-primary">
          <ListingArtRotator items={listingCards}/>
        </aside>

        <section className="live-detail-copy market-listing-copy">
          <header className="market-listing-heading">
            <div>
              <p className="eyebrow">
                {primary.language} {t('printing', 'cetakan')}
                {listing.createdAt && <> · <MarketTimestamp value={listing.createdAt}/></>}
              </p>
              <h1>{listing.title}</h1>
            </div>
            <span className={`market-listing-status ${isBuying ? 'is-buying' : 'is-selling'}`}>{typeLabel}</span>
          </header>

          <dl className="market-listing-facts">
            <div>
              <dt>{t('Price', 'Harga')}</dt>
              <dd>{formatMoney(listing.amount, listing.currency)}</dd>
            </div>
            <div>
              <dt>{isBuying ? t('Location', 'Lokasi') : t('Ships from', 'Dikirim dari')}</dt>
              <dd>{listing.city}</dd>
            </div>
            <div>
              <dt>{t('Cards', 'Kartu')}</dt>
              <dd>{cardCount} {t('total', 'total')}</dd>
            </div>
            {expiresAt && (
              <div>
                <dt>{isExpired ? t('Status', 'Status') : t('Expires', 'Berakhir')}</dt>
                <dd>{isExpired ? (status === 'CLOSED' ? t('Closed', 'Ditutup') : t('Expired', 'Kedaluwarsa')) : `${daysLeft ?? 30} ${t('days left', 'hari lagi')}`}</dd>
              </div>
            )}
            {!isBuying && <ShippingOptions listingId={listing.id} courierCount={3}/>}
          </dl>

          {isOwner && (
            <aside className={`market-seller-banner ${isExpired ? 'is-expired' : ''}`} aria-label={t('Seller listing controls', 'Kontrol listing penjual')}>
              <div className="market-seller-banner-copy">
                <strong>{isExpired ? (status === 'CLOSED' ? t('Listing is closed', 'Listing ditutup') : t('Listing has expired', 'Listing telah kedaluwarsa')) : t('Your active listing', 'Listing aktif Anda')}</strong>
                <small>
                  {isExpired
                    ? t('This listing is hidden from the Market feed. Renew to reactivate it.', 'Listing ini disembunyikan dari feed Market. Perbarui untuk mengaktifkannya kembali.')
                    : daysLeft !== null
                    ? (language === 'ID' ? `Listing aktif · Berakhir dalam ${daysLeft} hari (${expiresAt?.split(' ')[0]})` : `Active listing · Expires in ${daysLeft} days (${expiresAt?.split(' ')[0]})`)
                    : t('Active on Market', 'Aktif di Market')}
                </small>
              </div>
              <div className="market-seller-banner-actions">
                <button
                  type="button"
                  className="btn-renew"
                  disabled={renewing}
                  onClick={handleRenew}
                >
                  {renewing ? t('Renewing...', 'Memperbarui...') : isExpired ? t('Renew (+30d)', 'Perbarui (+30h)') : t('Extend (+30d)', 'Perpanjang (+30h)')}
                </button>
                {!isExpired && (
                  <button
                    type="button"
                    className="btn-close"
                    disabled={closing}
                    onClick={handleClose}
                  >
                    {closing ? t('Closing...', 'Menutup...') : t('Close', 'Tutup')}
                  </button>
                )}
              </div>
            </aside>
          )}

          {!isOwner && isExpired && (
            <div className="market-expired-banner">
              <strong>{status === 'CLOSED' ? t('This listing has been closed', 'Listing ini telah ditutup') : t('This listing has expired', 'Listing ini telah kedaluwarsa')}</strong>
              <p>{t('The seller has not renewed this listing and it is no longer accepting offers.', 'Penjual belum memperbarui listing ini dan tidak lagi menerima penawaran.')}</p>
            </div>
          )}

          <section className="market-listing-seller">
            <span>{listing.seller.slice(0, 1).toUpperCase()}</span>
            <div>
              <small>{isBuying ? t('Buyer', 'Pembeli') : t('Seller', 'Penjual')}</small>
              <strong>{stored ? <Link href={`/players/${stored.username}`}>{listing.seller}</Link> : listing.seller}</strong>
            </div>
          </section>

          {!isExpired && (
            <MarketListingItems
              items={listingCards}
              currency={listing.currency}
              listingType={listing.type === 'WTB' ? 'WTB' : 'WTS'}
              listingId={listing.id}
              listingTitle={listing.title}
              listingAmount={formatMoney(listing.amount, listing.currency)}
            />
          )}
        </section>
      </article>
    </main>
  );
}

