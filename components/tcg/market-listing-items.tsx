'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeftIcon, InfoIcon as Info, MinusIcon as Minus, PlusIcon as Plus, TruckIcon as Truck, XIcon as X} from '@phosphor-icons/react';
import type {Card} from '@/packages/card-data/catalog';
import {formatMoney,Listing} from '@/packages/domain';
import {CardArt} from './card-art';
import {CardPreviewModal} from './card-preview-modal';
import {ShareButton} from './share';
import {MarketTimestamp} from './market-timestamp';
import {authClient} from '@/lib/auth-client';
import {TurnstileField,turnstileEnabled,turnstileHeaders} from './turnstile-field';
import {toast} from 'sonner';
import {getDaysUntilExpiration, isListingExpired} from '@/lib/market/policy';
import {FeedbackLaunchButton} from './feedback-launch';
import {AddEditItemModal} from './vault/modals/add-edit-item-modal';
import {PushNotificationPrompt} from './push-notification-settings';

type CourierRate={courier_name:string;courier_service_name:string;price:number;duration?:string;max_km?:number};
const COURIER_LABELS:Record<string,string>={'jne':'JNE Express','jnt':'J&T Express','sicepat':'SiCepat Ekspres','anteraja':'Anteraja','tiki':'TIKI','pos':'Pos Indonesia','lion':'Lion Parcel','ninja':'Ninja Xpress','wahana':'Wahana Express','grab':'GrabExpress','gojek':'GoSend','grab_instant':'Grab Instant','gojek_instant':'Gojek Instant'};
const INSTANT_COURIERS=new Set(['grab','gojek','grab_instant','gojek_instant']);

export function ShippingOptions({listingId,courierCount=0,variant='fact'}:{listingId:string;courierCount?:number;variant?:'fact'|'compact';}){
  const [open,setOpen]=useState(false);
  const [rates,setRates]=useState<CourierRate[]>([]);
  const [startingFee,setStartingFee]=useState<number|null>(null);
  const [loading,setLoading]=useState(false);
  const [quoteState,setQuoteState]=useState<'idle'|'ready'|'needs-address'|'unavailable'|'error'>('idle');
  const autoAttempted=useRef(false);
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');
  const dialogRef=useRef<HTMLDivElement>(null);
  const triggerRef=useRef<HTMLElement>(null);

  useEffect(()=>{
    const sync=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    sync();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);

  const t=(en:string,idStr:string)=>language==='ID'?idStr:en;

  const loadRates=useCallback(async(showLoading:boolean,force=false)=>{
    if(loading||quoteState==='ready'||(!force&&autoAttempted.current))return;
    if(courierCount===0){setQuoteState('unavailable');return;}
    autoAttempted.current=true;
    if(showLoading)setLoading(true);
    try{
      const res=await fetch('/api/shipping/quotes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listingId})});
      const data=await res.json() as {pricing?:CourierRate[];couriers?:string[];destinationRequired?:boolean;error?:string};
      if(!res.ok)throw new Error(data.error||t('Live rates could not be loaded.','Tarif pengiriman belum dapat dimuat.'));
      if(data.destinationRequired){setRates([]);setStartingFee(null);setQuoteState('needs-address');return;}
      if(Array.isArray(data.pricing)&&data.pricing.length>0){
        const priced=data.pricing.filter(rate=>Number.isFinite(rate.price)&&rate.price>0);
        setRates(priced);
        const prices=priced.map(rate=>rate.price);
        setStartingFee(prices.length?Math.min(...prices):null);
        setQuoteState(prices.length?'ready':'unavailable');
      }
      else{setRates([]);setStartingFee(null);setQuoteState('unavailable');}
    }catch(error){setQuoteState('error');if(showLoading)toast.error(error instanceof Error?error.message:t('Live rates could not be loaded.','Tarif pengiriman belum dapat dimuat.'));}
    finally{if(showLoading)setLoading(false);}
  },[courierCount,listingId,loading,quoteState,language]);
  const openDialog=async()=>{setOpen(true);await loadRates(true,true)};

  useEffect(()=>{
    const target=triggerRef.current;
    if(!target||quoteState==='ready'||autoAttempted.current||typeof IntersectionObserver==='undefined')return;
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){
        observer.disconnect();
        void loadRates(false);
      }
    },{rootMargin:'120px'});
    observer.observe(target);
    return()=>observer.disconnect();
  },[loadRates,quoteState]);

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

  const activeRates=rates;

  const modal=open?(
    <div className="shipping-options-backdrop" role="presentation" onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget)setOpen(false);}}>
      <div className="shipping-options-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('Shipping Options','Opsi Pengiriman')} onClick={e=>e.stopPropagation()}>
        <header className="shipping-options-header">
          <strong>{t('Shipping Options','Opsi Pengiriman')}</strong>
          <button type="button" className="shipping-options-close" onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(false);}} aria-label={t('Close','Tutup')}><X size={15}/></button>
        </header>
        <div className="shipping-options-body">
          {loading&&<p className="shipping-options-loading">{t('Loading shipping options…','Memuat opsi pengiriman…')}</p>}
          {!loading&&activeRates.length>0&&(
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
          {!loading&&activeRates.length===0&&<div className="shipping-options-empty">
            <p>{quoteState==='needs-address'?t('Add a delivery address to see rates for this listing.', 'Tambahkan alamat pengiriman untuk melihat ongkir listing ini.'):quoteState==='error'?t('Rates could not load. Try again.', 'Ongkir gagal dimuat. Coba lagi.'):courierCount>0?t('No live rates are available for this address right now.', 'Belum ada tarif langsung untuk alamat ini.'):t('The seller has not configured shipping options yet.','Penjual belum mengatur opsi pengiriman.')}</p>
            {quoteState==='needs-address'&&<a className="shipping-options-address-btn" href="/profile?tab=shipping" onClick={e=>e.stopPropagation()}>{t('Set delivery address','Atur alamat pengiriman')}</a>}
            {(quoteState==='error'||quoteState==='unavailable')&&courierCount>0&&<button type="button" className="shipping-options-retry" onClick={()=>void loadRates(true,true)}>{t('Retry','Coba lagi')}</button>}
          </div>}
        </div>
        <footer className="shipping-options-footer">
          <p>{startingFee!=null?t('Rates use your saved delivery address. The final fee is confirmed at checkout.','Tarif menggunakan alamat pengiriman tersimpan. Biaya akhir dikonfirmasi saat checkout.'):t('Confirm the delivery address and final fee with the seller before payment.','Konfirmasikan alamat pengiriman dan ongkir akhir kepada penjual sebelum pembayaran.')}</p>
        </footer>
      </div>
    </div>
  ):null;

  if(variant==='compact'){
    return(
      <>
        <span
          ref={node=>{triggerRef.current=node}}
          role="button"
          tabIndex={0}
          className="market-feed-shipping-trigger"
          onClick={e=>{e.preventDefault();e.stopPropagation();openDialog();}}
          onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();openDialog();}}}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Truck size={11}/>
          <span>{startingFee!=null?`${t('Delivery from','Ongkir mulai')} ${formatMoney(startingFee,'IDR')}`:courierCount>0?t('See delivery fees','Lihat ongkir'):t('Shipping not configured','Pengiriman belum diatur')}</span>
        </span>
        {modal}
      </>
    );
  }

  return(
    <div className="shipping-options-fact">
      <dt><Truck size={11}/>{t('Shipping','Pengiriman')}</dt>
      <dd>
        <button type="button" className="shipping-options-trigger" ref={node=>{triggerRef.current=node}} onClick={openDialog} aria-haspopup="dialog" aria-expanded={open}>
          {startingFee!=null?`${t('Delivery from','Ongkir mulai')} ${formatMoney(startingFee,'IDR')}`:courierCount>0?t('See delivery fees','Lihat ongkir'):t('Shipping not configured','Pengiriman belum diatur')}
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

export function MarketListingItems({items,currency,listingType,listingId,listingTitle,readOnly=false}:{items:MarketListingCard[];currency:string;listingType:'WTS'|'WTB';listingId:string;listingTitle?:string;listingAmount?:string;readOnly?:boolean;}){
  const router=useRouter();
  const singleCopyListing=items.length===1&&items[0].quantity===1;
  const [selected,setSelected]=useState<Record<string,number>>(()=>singleCopyListing?{[items[0].id]:1}:{});
  const [customPrices,setCustomPrices]=useState<Record<string,number>>({});
  const [preview,setPreview]=useState<Card>();
  const [vaultTarget,setVaultTarget]=useState<MarketListingCard|null>(null);
  const {data:session}=authClient.useSession();
  const [submitting,setSubmitting]=useState(false); const [submitted,setSubmitted]=useState(false);
  const [turnstileToken,setTurnstileToken]=useState('');const [turnstileResetKey,setTurnstileResetKey]=useState(0);
  const [verificationOpen,setVerificationOpen]=useState(false);
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');

  useEffect(()=>{
    if(!singleCopyListing)return;
    const onlyItem=items[0];
    setSelected(current=>current[onlyItem.id]===1?current:{[onlyItem.id]:1});
  },[singleCopyListing,items[0]?.id]);

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

  const setItemExact=(id:string,count:number,maximum:number)=>setSelected(current=>({
    ...current,
    [id]:Math.max(0,Math.min(maximum,count)),
  }));

  const selectAll=()=>setSelected(
    Object.fromEntries(items.map(item=>[item.id,item.quantity]))
  );

  const selectPlaysets=()=>setSelected(
    Object.fromEntries(items.map(item=>[item.id,Math.min(4,item.quantity)]))
  );

  const clearAll=()=>setSelected({});

  const totalAvailable=useMemo(()=>items.reduce((sum,item)=>sum+item.quantity,0),[items]);
  const hasPlaysetOpportunities=useMemo(()=>items.some(item=>item.quantity>=4),[items]);

  const isBuying=listingType==='WTS';
  const actionLabel=isBuying?t('Make offer','Ajukan penawaran'):t('Offer cards','Tawarkan kartu');
  const continueOffer=async()=>{
    if(!session){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return;}
    if(turnstileEnabled&&!turnstileToken){setVerificationOpen(true);return;}
    setSubmitting(true);try{const offerItems=items.flatMap(item=>{const quantity=selected[item.id]??0;if(!quantity)return[];const unitAmount=getUnitPrice(item);return [{printingId:item.id,quantity,unitAmount}];});const response=await fetch(`/api/listings/${encodeURIComponent(listingId)}/offers`,{method:'POST',headers:{'content-type':'application/json',...turnstileHeaders(turnstileToken)},body:JSON.stringify({type:isBuying?'BUY':'SELL',items:offerItems,amount:selectedTotal,currency})});const payload=await response.json() as {error?:string};if(!response.ok)throw new Error(payload.error??t('We could not send your offer.','Gagal mengirimkan penawaran Anda.'));setSubmitted(true);setVerificationOpen(false);toast.success(isBuying?t('Offer sent to the seller.','Penawaran dikirim ke penjual.'):t('Your cards were offered to the buyer.','Kartu Anda ditawarkan ke pembeli.'));}catch(error){const message=error instanceof Error?error.message:'';const localized=language==='ID'&&message.includes('listing is no longer active')?'Listing ini sudah tidak aktif.':language==='ID'&&message.includes('listing has expired')?'Listing ini sudah kedaluwarsa.':language==='ID'&&message.includes('Offer total must match')?'Total penawaran harus sesuai dengan harga tiap kartu.':message||t('We could not send your offer.','Gagal mengirimkan penawaran Anda.');toast.error(localized)}finally{setTurnstileToken('');setTurnstileResetKey(value=>value+1);setSubmitting(false)}
  };
  const buySelected=()=>{
    if(!session){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return;}
    const orderItems=items.flatMap(item=>{const quantity=selected[item.id]??0;return quantity?[{printingId:item.id,quantity}]:[];});
    const query=new URLSearchParams({listing:listingId,items:JSON.stringify(orderItems)});
    router.push(`/checkout/market?${query.toString()}`);
  };

  return <section className="market-listing-cards" aria-labelledby="listing-cards-heading">
    <header className="market-listing-cards-header">
      <h2 id="listing-cards-heading">{t('Cards in this listing','Kartu dalam listing ini')}</h2>
      {!readOnly&&!singleCopyListing&&<div className="market-listing-bulk-actions" role="toolbar" aria-label={t('Bulk card selection','Pilihan borongan kartu')}>
        <button
          type="button"
          className={`market-bulk-btn ${selectedCount===totalAvailable?'is-active':''}`}
          onClick={selectAll}
          title={t('Select all available cards across this listing','Pilih semua kartu yang tersedia di listing ini')}
        >
          {t('Take all','Ambil semua')} <small>({totalAvailable})</small>
        </button>
        {hasPlaysetOpportunities && (
          <button
            type="button"
            className="market-bulk-btn"
            onClick={selectPlaysets}
            title={t('Select up to 4 copies (playset) for each card','Pilih hingga 4 salinan (playset) per kartu')}
          >
            {t('Playset (4×) all','Playset (4×) semua')}
          </button>
        )}
        {selectedCount>0 && (
          <button
            type="button"
            className="market-bulk-btn is-clear"
            onClick={clearAll}
            title={t('Clear selected cards','Hapus pilihan kartu')}
          >
            {t('Reset','Reset')}
          </button>
        )}
      </div>}
    </header>
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
            {!readOnly&&!singleCopyListing&&<span className="deck-stack-actions market-listing-quantity" aria-label={`Select ${item.card.name}`}>
              <button type="button" onClick={()=>change(item.id,-1,item.quantity)} disabled={!amount} aria-label={`Remove one ${item.card.name}`}><Minus size={13}/></button>
              <button type="button" onClick={()=>change(item.id,1,item.quantity)} disabled={amount===item.quantity} aria-label={`Add one ${item.card.name}`}><Plus size={13}/></button>
              {item.quantity>1 && (
                (() => {
                  const showPlayset = item.quantity >= 4 && amount < 4;
                  const targetQty = showPlayset ? 4 : (amount === item.quantity ? 0 : item.quantity);
                  const label = showPlayset ? '4×' : (amount === item.quantity ? '0' : (item.quantity === 4 ? '4×' : t('All','Semua')));
                  const title = showPlayset
                    ? t('Take playset of 4', 'Ambil playset 4×')
                    : (amount === item.quantity
                      ? t('Deselect card', 'Batalkan pilihan kartu')
                      : t(`Take all ${item.quantity}`, `Ambil semua ${item.quantity}`));
                  return (
                    <button
                      type="button"
                      className={`market-card-quick-btn ${amount===item.quantity || (showPlayset && amount===4)?'is-active':''}`}
                      onClick={()=>setItemExact(item.id, targetQty, item.quantity)}
                      title={title}
                      aria-label={`${label} ${item.card.name}`}
                    >
                      {label}
                    </button>
                  );
                })()
              )}
            </span>}
          </div>
          <div className="market-listing-card-copy">
            <strong>{item.card.name}</strong>
            <small>{item.card.code} · {item.card.rarity} · {item.language}</small>
            <p><span>{item.condition}</span>{!readOnly&&!singleCopyListing&&<em>{amount}/{item.quantity} {t('selected','dipilih')}</em>}</p>
            <b>{formatMoney(item.unitAmount,currency)} {t('each','per kartu')}</b>
            {listingType==='WTS'&&<button type="button" className="market-listing-add-vault" onClick={()=>setVaultTarget(item)}><Plus size={13}/>{t('Add owned copy to Vault','Simpan salinan milik Anda ke Vault')}</button>}

            {!readOnly&&amount>0 && (
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
    <AddEditItemModal key={`${vaultTarget?.id??'market-listing-card'}-${Boolean(vaultTarget)}`} open={Boolean(vaultTarget)} onClose={()=>setVaultTarget(null)} onSaved={()=>router.refresh()} initialCard={vaultTarget?.card} initialPrintingId={vaultTarget?.id} isAnonymous={!session?.user} language={language}/>
    {!readOnly&&<footer className="market-listing-selection" aria-live="polite">
      <div className="market-listing-selection-info">
        <span>{submitted?t('Offer sent - awaiting a response.','Penawaran terkirim - menunggu tanggapan.'):selectedCount?(language==='ID'?`${selectedCount} kartu dipilih`:`${selectedCount} ${selectedCount===1?'card':'cards'} selected`):t('Select cards to calculate a total','Pilih kartu untuk menghitung total')}</span>
        {submitted&&<PushNotificationPrompt language={language} message="offer"/>}
        {!submitted&&selectedCount>0&&<small>{t('Offers expire after 24 hours or when the listing ends.','Penawaran berakhir setelah 24 jam atau saat listing berakhir.')}</small>}
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
        {isBuying&&<button type="button" className="button market-buy-selected" disabled={!selectedCount} onClick={buySelected}>{singleCopyListing?t('Buy now','Beli sekarang'):t('Buy selected','Beli pilihan')}</button>}
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
    </footer>}
    {verificationOpen&&<div className="market-offer-verification-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget){setVerificationOpen(false);setTurnstileToken('');setTurnstileResetKey(value=>value+1)}}}><section className="market-offer-verification" role="dialog" aria-modal="true" aria-labelledby="market-offer-verification-title"><h2 id="market-offer-verification-title">{t('Security check','Pemeriksaan keamanan')}</h2><p>{t('Complete this check to send your selected card offer.','Selesaikan pemeriksaan untuk mengirim penawaran kartu.')}</p><TurnstileField onToken={setTurnstileToken} resetKey={turnstileResetKey}/><div><button type="button" className="button secondary" onClick={()=>{setVerificationOpen(false);setTurnstileToken('');setTurnstileResetKey(value=>value+1)}}>{t('Cancel','Batal')}</button><button type="button" className="button" disabled={!turnstileToken||submitting} onClick={()=>void continueOffer()}>{submitting?t('Sending…','Mengirim…'):t('Send offer','Kirim penawaran')}</button></div></section></div>}
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
  renewDurationDays = 7,
}: {
  listing: Listing;
  stored?: (Listing & { username: string }) | null;
  listingCards: MarketListingCard[];
  primary: MarketListingCard;
  cardCount: number;
  isOwner?: boolean;
  initialExpired?: boolean;
  renewDurationDays?: number;
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
      toast.success(language === 'ID' ? `Listing diperbarui untuk ${data.durationDays || renewDurationDays} hari ke depan` : `Listing renewed for ${data.durationDays || renewDurationDays} days`);
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
        <ArrowLeftIcon aria-hidden="true" size={16}/>{t('Back to Market', 'Kembali ke Market')}
      </Link>
      <article className="live-detail-layout market-listing-layout">
        <aside className="live-detail-art viewer-primary-art market-listing-primary">
          <ListingArtRotator items={listingCards}/>
        </aside>

        <section className="live-detail-copy market-listing-copy">
          <header className="market-listing-heading">
            <div>
              <p className="eyebrow market-listing-eyebrow">
                {primary.language} {t('printing', 'cetakan')}
                {listing.createdAt && <> · <MarketTimestamp value={listing.createdAt}/></>}
                {expiresAt && <>{' · '}{isExpired?(status==='CLOSED'?t('Closed','Ditutup'):t('Expired','Kedaluwarsa')):<>{t('Expires in','Berakhir dalam')} {daysLeft ?? renewDurationDays} {t('days','hari')}</>}</>}
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
            {cardCount>1&&<div>
              <dt>{t('Cards', 'Kartu')}</dt>
              <dd>{cardCount}</dd>
            </div>}
            {!isBuying && <ShippingOptions listingId={listing.id} courierCount={listing.shippingOptionCount??0}/>}
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
                  {renewing ? t('Renewing...', 'Memperbarui...') : isExpired ? t(`Renew (+${renewDurationDays}d)`, `Perbarui (+${renewDurationDays} hari)`) : t(`Extend (+${renewDurationDays}d)`, `Perpanjang (+${renewDurationDays} hari)`)}
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
          {!isOwner&&<FeedbackLaunchButton request={{initialCategory:'market-report',listingId:listing.id}} className="market-report-link">{t('Report listing or seller','Laporkan listing atau penjual')}</FeedbackLaunchButton>}

          {(!isExpired||isOwner)&&(
            <MarketListingItems
              items={listingCards}
              currency={listing.currency}
              listingType={listing.type === 'WTB' ? 'WTB' : 'WTS'}
              listingId={listing.id}
              listingTitle={listing.title}
              listingAmount={formatMoney(listing.amount, listing.currency)}
              readOnly={isOwner}
            />
          )}
        </section>
      </article>
    </main>
  );
}
