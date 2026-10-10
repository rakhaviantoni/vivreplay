'use client';

import Link from 'next/link';
import {SaveListingButton,WishlistButton} from './market-saved';
import {MarketReputation} from './market-reputation';
import {useRouter} from 'next/navigation';
import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {ArrowClockwiseIcon as Renew,ArrowLeftIcon, CheckIcon as Check, InfoIcon as Info, MinusIcon as Minus, PlusIcon as Plus, ShoppingCartIcon as Cart, TruckIcon as Truck, XIcon as X} from '@phosphor-icons/react';
import type {Card} from '@/packages/card-data/catalog';
import {formatMoney,Listing} from '@/packages/domain';
import {CardArt} from './card-art';
import {CardPreviewModal} from './card-preview-modal';
import {ShareButton} from './share';
import {MarketTimestamp} from './market-timestamp';
import {authClient} from '@/lib/auth-client';
import {toast} from 'sonner';
import {getDaysUntilExpiration, isListingExpired} from '@/lib/market/policy';
import {FeedbackLaunchButton} from './feedback-launch';
import {AddEditItemModal} from './vault/modals/add-edit-item-modal';
import {PushNotificationPrompt} from './push-notification-settings';

type CourierRate={courier_code:string;courier_service_code:string;courier_name:string;courier_service_name:string;price:number;duration?:string;max_km?:number};
type ShippingArea={id:string;name:string;province:string;city:string;district:string;subdistrict:string;postalCode:string;latitude?:number;longitude?:number;source:'biteship'|'local'};
type DeliveryAddressDraft={recipientName:string;phone:string;addressLine:string;city:string;postalCode:string;areaId:string|null;latitude:number|null;longitude:number|null;label:string;shippingMethods:string[];regions:{province?:string;city?:string;district?:string;subdistrict?:string}};
const COURIER_LABELS:Record<string,string>={'jne':'JNE Express','jnt':'J&T Express','sicepat':'SiCepat Ekspres','anteraja':'Anteraja','tiki':'TIKI','pos':'Pos Indonesia','lion':'Lion Parcel','ninja':'Ninja Xpress','wahana':'Wahana Express','grab':'GrabExpress','gojek':'GoSend','grab_instant':'Grab Instant','gojek_instant':'Gojek Instant'};
const INSTANT_COURIERS=new Set(['grab','gojek','grab_instant','gojek_instant']);

export function ShippingCouriers({couriers,language,maxVisible=2}:{couriers:string[];language:'EN'|'ID';maxVisible?:number}){
  const labels=couriers.map(code=>COURIER_LABELS[code]??code);
  return <span className="market-feed-shipping-availability" title={labels.join(', ')}><Truck size={11}/><span>{labels.length?`${labels.slice(0,maxVisible).join(', ')}${labels.length>maxVisible?` +${labels.length-maxVisible}`:''}`:language==='ID'?'Pengiriman belum diatur':'Shipping not configured'}</span></span>;
}

export function ShippingOptions({listingId,courierCount=0,couriers=[],items=[]}:{listingId:string;courierCount?:number;couriers?:string[];items?:Array<{printingId:string;quantity:number;unitAmount:number}>}){
  const {data:session}=authClient.useSession();
  const [open,setOpen]=useState(false);
  const [rates,setRates]=useState<CourierRate[]>([]);
  const [startingFee,setStartingFee]=useState<number|null>(null);
  const [loading,setLoading]=useState(false);
  const [quoteState,setQuoteState]=useState<'idle'|'ready'|'needs-address'|'needs-sign-in'|'unavailable'|'error'>('idle');
  const inFlight=useRef(false);
  const quoteRequest=useRef<AbortController|null>(null);
  const autoLoaded=useRef('');
  const [quoteExpiresAt,setQuoteExpiresAt]=useState(0);
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');
  const dialogRef=useRef<HTMLDivElement>(null);
  const [addressFormOpen,setAddressFormOpen]=useState(false);
  const [addressLoading,setAddressLoading]=useState(false);
  const [addressSaving,setAddressSaving]=useState(false);
  const [addressError,setAddressError]=useState('');
  const [addressDraft,setAddressDraft]=useState<DeliveryAddressDraft>({recipientName:'',phone:'',addressLine:'',city:'',postalCode:'',areaId:null,latitude:null,longitude:null,label:'Primary origin',shippingMethods:['jnt','jne'],regions:{}});
  const [areaQuery,setAreaQuery]=useState('');
  const [areaResults,setAreaResults]=useState<ShippingArea[]>([]);
  const [areaLoading,setAreaLoading]=useState(false);

  useEffect(()=>{
    const sync=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    sync();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);

  const t=(en:string,idStr:string)=>language==='ID'?idStr:en;

  useEffect(()=>{
    const reset=()=>{
      quoteRequest.current?.abort();quoteRequest.current=null;
      inFlight.current=false;autoLoaded.current='';setQuoteExpiresAt(0);
      setRates([]);setStartingFee(null);setLoading(false);setQuoteState('idle');
    };
    reset();
    window.addEventListener('vivreplay:shipping-updated',reset);
    return()=>{window.removeEventListener('vivreplay:shipping-updated',reset);quoteRequest.current?.abort();};
  },[listingId,session?.user.id]);

  const loadRates=useCallback(async(cacheOnly=false,silent=false)=>{
    if(inFlight.current)return;
    if(courierCount===0){setLoading(false);setQuoteState('unavailable');return;}
    inFlight.current=true;
    if(!cacheOnly){setLoading(true);setRates([]);}
    const controller=new AbortController();quoteRequest.current=controller;
    try{
      const res=await fetch('/api/shipping/quotes',{signal:controller.signal,method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listingId,items,cacheOnly})});
      const data=await res.json() as {pricing?:CourierRate[];couriers?:string[];destinationRequired?:boolean;cacheMiss?:boolean;regularExpiresAt?:number;instantExpiresAt?:number;error?:string};
      if(controller.signal.aborted)return;
      if(!res.ok)throw new Error(data.error||t('Live rates could not be loaded.','Tarif pengiriman belum dapat dimuat.'));
      if(data.cacheMiss)return;
      const expiries=[data.regularExpiresAt,data.instantExpiresAt].filter((value):value is number=>typeof value==='number'&&value>Date.now());
      setQuoteExpiresAt(expiries.length?Math.min(...expiries):Date.now()+60_000);
      if(data.destinationRequired){setRates([]);setStartingFee(null);setQuoteState('needs-address');return;}
      if(Array.isArray(data.pricing)&&data.pricing.length>0){
        const priced=data.pricing.filter(rate=>Number.isFinite(rate.price)&&rate.price>=0);
        setRates(priced);
        const prices=priced.map(rate=>rate.price);
        setStartingFee(prices.length?Math.min(...prices):null);
        setQuoteState(prices.length?'ready':'unavailable');
      }
      else{setRates([]);setStartingFee(null);setQuoteState('unavailable');}
    }catch(error){if(controller.signal.aborted||cacheOnly)return;setQuoteState('error');if(!cacheOnly&&!silent)toast.error(error instanceof Error?error.message:t('Live rates could not be loaded.','Tarif pengiriman belum dapat dimuat.'));}
    finally{if(quoteRequest.current===controller){inFlight.current=false;setLoading(false);quoteRequest.current=null;}}
  },[courierCount,listingId,language,items]);
  const openDialog=async()=>{setOpen(true);if(!session?.user.id){setLoading(false);setQuoteState('needs-sign-in');return;}if(rates.length&&quoteExpiresAt>Date.now()){setLoading(false);return;}setLoading(true);await loadRates()};

  useEffect(()=>{
    const key=`${session?.user.id??''}:${listingId}:${courierCount}`;
    if(session?.user.id&&autoLoaded.current!==key){autoLoaded.current=key;void loadRates(false,true);}
  },[session?.user.id,listingId,courierCount,loadRates]);

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

  useEffect(()=>{
    const query=areaQuery.trim();
    if(!addressFormOpen||query.length<2)return;
    let active=true;
    const timer=window.setTimeout(async()=>{
      setAreaLoading(true);
      try{
        const response=await fetch(`/api/shipping/areas?query=${encodeURIComponent(query)}`);
        const payload=await response.json() as {areas?:ShippingArea[]};
        if(active)setAreaResults((payload.areas??[]).slice(0,8));
      }catch{if(active)setAreaResults([])}finally{if(active)setAreaLoading(false)}
    },300);
    return()=>{active=false;window.clearTimeout(timer)};
  },[addressFormOpen,areaQuery]);

  const openAddressForm=async()=>{
    setAddressFormOpen(true);setAddressError('');setAreaQuery('');setAreaResults([]);setAreaLoading(false);setAddressLoading(true);
    try{
      const response=await fetch('/api/shipping/origin',{cache:'no-store'});
      if(!response.ok)throw new Error('');
      const payload=await response.json() as {origin?:(Partial<DeliveryAddressDraft>&{regionNames?:DeliveryAddressDraft['regions']})|null};
      const origin=payload.origin;
      if(origin)setAddressDraft(current=>({...current,recipientName:origin.recipientName||session?.user.name||current.recipientName,phone:origin.phone||current.phone,addressLine:origin.addressLine||'',city:origin.city||'',postalCode:origin.postalCode||'',areaId:origin.areaId||null,latitude:typeof origin.latitude==='number'?origin.latitude:null,longitude:typeof origin.longitude==='number'?origin.longitude:null,label:origin.label||current.label,shippingMethods:origin.shippingMethods??current.shippingMethods,regions:origin.regionNames??origin.regions??{city:origin.city||''}}));
      else setAddressDraft(current=>({...current,recipientName:session?.user.name||current.recipientName}));
    }catch{/* The form can still be completed without a saved address. */}
    finally{setAddressLoading(false)}
  };

  const saveDeliveryAddress=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setAddressSaving(true);setAddressError('');
    try{
      const response=await fetch('/api/shipping/origin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...addressDraft,regions:{...addressDraft.regions,city:addressDraft.city}})});
      const payload=await response.json() as {error?:string};
      if(!response.ok)throw new Error(payload.error||t('Address could not be saved.','Alamat gagal disimpan.'));
      setAddressFormOpen(false);setAreaQuery('');window.dispatchEvent(new Event('vivreplay:shipping-updated'));
      await loadRates();
    }catch(error){setAddressError(error instanceof Error?error.message:t('Address could not be saved.','Alamat gagal disimpan.'))}
    finally{setAddressSaving(false)}
  };

  const modal=open?(
    <div className="shipping-options-backdrop" role="presentation" onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget)setOpen(false);}}>
      <div className="shipping-options-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('Shipping Options','Opsi Pengiriman')} onClick={e=>e.stopPropagation()}>
        <header className="shipping-options-header">
          <strong>{t('Shipping Options','Opsi Pengiriman')}</strong>
          <button type="button" className="shipping-options-close" onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(false);}} aria-label={t('Close','Tutup')}><X size={15}/></button>
        </header>
        <div className="shipping-options-body">
          {!loading&&activeRates.length===0&&couriers.length>0&&<p className="shipping-options-enabled"><ShippingCouriers couriers={couriers} language={language} maxVisible={couriers.length}/></p>}
          {loading&&<div className="shipping-options-skeleton" role="status" aria-label={t('Loading shipping options','Memuat opsi pengiriman')}>{Array.from({length:4},(_,index)=><div key={index}><span><i/><i/></span><i/></div>)}</div>}
          {!loading&&activeRates.length>0&&(
            <ul className="shipping-options-list">
              {activeRates.map(rate=>(
                <li key={`${rate.courier_code}:${rate.courier_service_code}`} className="shipping-options-item">
                  <span className="shipping-options-courier">
                    <strong>{COURIER_LABELS[rate.courier_code]||rate.courier_name}</strong>
                    <small>{rate.courier_service_name}{rate.duration?` - ${rate.duration}`:''}</small>
                  </span>
                  <div className="shipping-options-meta">
                    {INSTANT_COURIERS.has(rate.courier_code)&&rate.max_km!=null&&(
                      <span className="shipping-options-constraint">{t('max','maks')} {rate.max_km} km</span>
                    )}
                    {rate.price>=0&&(
                      <span className="shipping-options-rate-price">{formatMoney(rate.price,'IDR')}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!loading&&activeRates.length===0&&!(quoteState==='needs-address'&&addressFormOpen)&&<div className="shipping-options-empty">
            <p>{quoteState==='needs-sign-in'?t('Sign in to check delivery fees for this listing.','Masuk untuk melihat ongkir listing ini.'):quoteState==='needs-address'?t('Add a delivery address to see rates for this listing.', 'Tambahkan alamat pengiriman untuk melihat ongkir listing ini.'):quoteState==='error'?t('Rates could not load. Try again.', 'Ongkir belum dapat dimuat. Coba lagi.'):courierCount>0?t('No live rates are available for this address right now.', 'Belum ada tarif untuk alamat ini.'):t('The seller has not set up shipping yet.','Penjual belum mengatur pengiriman.')}</p>
            {quoteState==='needs-sign-in'&&<button type="button" className="shipping-options-address-btn" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}>{t('Sign in','Masuk')}</button>}
            {quoteState==='needs-address'&&!addressFormOpen&&<button type="button" className="shipping-options-address-btn" onClick={()=>void openAddressForm()}>{t('Add delivery address','Tambahkan alamat pengiriman')}</button>}
            {(quoteState==='error'||quoteState==='unavailable')&&courierCount>0&&<button type="button" className="shipping-options-retry" onClick={()=>void loadRates()}>{t('Retry','Coba lagi')}</button>}
          </div>}
          {quoteState==='needs-address'&&addressFormOpen&&<form className="shipping-options-address-form" onSubmit={saveDeliveryAddress}>
            <div className="shipping-options-address-heading"><strong>{t('Delivery address','Alamat pengiriman')}</strong><button type="button" onClick={()=>{setAddressFormOpen(false);setAreaLoading(false)}}>{t('Cancel','Batal')}</button></div>
            {addressLoading?<div className="shipping-options-address-loading" role="status">{t('Loading saved address…','Memuat alamat tersimpan…')}</div>:<>
              <label>{t('Recipient','Penerima')}<input required minLength={2} maxLength={100} autoComplete="name" value={addressDraft.recipientName} onChange={event=>setAddressDraft(current=>({...current,recipientName:event.target.value}))}/></label>
              <label>{t('Phone number','Nomor telepon')}<input required type="tel" autoComplete="tel" value={addressDraft.phone} onChange={event=>setAddressDraft(current=>({...current,phone:event.target.value}))}/></label>
              <label>{t('Street address','Alamat jalan')}<input required maxLength={260} autoComplete="street-address" value={addressDraft.addressLine} onChange={event=>setAddressDraft(current=>({...current,addressLine:event.target.value}))}/></label>
              <label>{t('Search delivery area','Cari wilayah pengiriman')}<input autoComplete="off" value={areaQuery||[addressDraft.regions.subdistrict,addressDraft.regions.district].filter(Boolean).join(', ')} onChange={event=>{const value=event.target.value;setAreaQuery(value);setAreaResults([]);setAreaLoading(value.trim().length>=2);setAddressDraft(current=>({...current,areaId:null,postalCode:'',latitude:null,longitude:null}))}} placeholder={t('Village or district','Kelurahan atau kecamatan')}/></label>
              {areaLoading&&<small className="shipping-options-address-hint" role="status">{t('Searching areas…','Mencari wilayah…')}</small>}
              {areaResults.length>0&&<div className="shipping-options-area-results" role="group" aria-label={t('Delivery areas','Wilayah pengiriman')}>{areaResults.map(area=><button type="button" key={`${area.source}:${area.id}`} onClick={()=>{setAddressDraft(current=>({...current,areaId:area.source==='biteship'?area.id:null,postalCode:area.postalCode||'',latitude:area.latitude??null,longitude:area.longitude??null,city:area.city,regions:{province:area.province,city:area.city,district:area.district,subdistrict:area.subdistrict}}));setAreaQuery('');setAreaResults([]);setAreaLoading(false)}}><strong>{[area.subdistrict,area.district].filter(Boolean).join(', ')||area.name}</strong><small>{[area.city,area.province,area.postalCode].filter(Boolean).join(' · ')}</small></button>)}</div>}
              <label>{t('City / Regency','Kota / Kabupaten')}<input required autoComplete="address-level2" value={addressDraft.city} onChange={event=>setAddressDraft(current=>({...current,city:event.target.value,regions:{...current.regions,city:event.target.value}}))}/></label>
              {!addressDraft.areaId&&<label>{t('Postal code','Kode pos')}<input required inputMode="numeric" autoComplete="postal-code" maxLength={5} pattern="[0-9]{5}" value={addressDraft.postalCode} onChange={event=>setAddressDraft(current=>({...current,postalCode:event.target.value.replace(/\D/g,'').slice(0,5)}))}/></label>}
              {addressError&&<p className="shipping-options-address-error" role="alert">{addressError}</p>}
              <button type="submit" className="shipping-options-address-submit" disabled={addressSaving}>{addressSaving?t('Saving…','Menyimpan…'):t('Save and check rates','Simpan dan lihat ongkir')}</button>
            </>}
          </form>}
        </div>
        <footer className="shipping-options-footer">
          {startingFee!=null&&<p>{t('Rates use your saved delivery address. The final fee is confirmed at checkout.','Tarif memakai alamat pengiriman tersimpan. Ongkir final terlihat saat checkout.')}</p>}
        </footer>
      </div>
    </div>
  ):null;


  return(
    <div className="shipping-options-fact">
      <dt><Truck size={11}/>{t('Shipping','Pengiriman')}</dt>
      <dd>
        <button type="button" className="shipping-options-trigger" aria-busy={loading} onClick={openDialog} aria-haspopup="dialog" aria-expanded={open}>
          {loading?t('Loading rates…','Memuat ongkir…'):startingFee!=null?`${t('Delivery from','Ongkir mulai')} ${formatMoney(startingFee,'IDR')}`:courierCount>0?t('Check delivery fees','Cek ongkir'):t('Shipping not configured','Pengiriman belum diatur')}
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

type ActiveListingOffer={
  id:string;
  actorId:string;
  viewerIsActor:boolean;
  items:Array<{printingId:string;quantity:number;unitAmount?:number}>;
  amount:number;
  currency:string;
  expiresAt:string|null;
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

  return <div className={`viewer-art-stack market-listing-art-rotator ${items.length===1?'is-single':''}`} aria-label={`Featured card: ${active.card.name}`}>
    {underlays.map((item,index)=><div key={item.id} className={`viewer-art-underlay viewer-art-underlay-${index}`} aria-hidden="true"><CardArt card={item.card}/></div>)}
    <div className="viewer-art-current market-listing-art-current" key={active.id}><CardArt card={active.card} priority/></div>
  </div>;
}

export function MarketListingItems({items,currency,listingType,listingId,listingTitle,sellerId,negotiable=true,readOnly=false}:{items:MarketListingCard[];currency:string;listingType:'WTS'|'WTB';listingId:string;listingTitle?:string;sellerId?:string;listingAmount?:string;negotiable?:boolean;readOnly?:boolean;}){
  const router=useRouter();
  const singleCopyListing=items.length===1&&items[0].quantity===1;
  const [selected,setSelected]=useState<Record<string,number>>(()=>singleCopyListing?{[items[0].id]:1}:{});
  const [customPrices,setCustomPrices]=useState<Record<string,number>>({});
  const [preview,setPreview]=useState<Card>();
  const [vaultTarget,setVaultTarget]=useState<MarketListingCard|null>(null);
  const {data:session,isPending:sessionPending}=authClient.useSession();
  const [submitting,setSubmitting]=useState(false); const [activeOffer,setActiveOffer]=useState<ActiveListingOffer|null>(null);
  const [offerJustSent,setOfferJustSent]=useState(false);
  const [offerCheckComplete,setOfferCheckComplete]=useState(false);
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');
  const [cartQuantities,setCartQuantities]=useState<Record<string,number>>({});

  useEffect(()=>{
    const sync=()=>{
      try{
        const cart=JSON.parse(window.localStorage.getItem('vivreplay-market-cart-v1')||'null') as {lines?:Array<{listingId:string;items?:Array<{printingId:string;quantity:number}>}>}|null;
        const line=cart?.lines?.find(entry=>entry.listingId===listingId);
        setCartQuantities(Object.fromEntries((line?.items??[]).map(item=>[item.printingId,item.quantity])));
      }catch{setCartQuantities({})}
    };
    sync();window.addEventListener('vivreplay:market-cart-updated',sync);window.addEventListener('storage',sync);
    return()=>{window.removeEventListener('vivreplay:market-cart-updated',sync);window.removeEventListener('storage',sync)};
  },[listingId]);

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
  const restoreActiveOffer=useCallback((offer:ActiveListingOffer)=>{
    const offerItems=offer.items.filter(item=>items.some(listingItem=>listingItem.id===item.printingId)&&Number.isInteger(item.quantity)&&item.quantity>0);
    if(!offerItems.length)return false;
    setSelected(Object.fromEntries(offerItems.map(item=>[item.printingId,Math.min(item.quantity,items.find(listingItem=>listingItem.id===item.printingId)?.quantity??item.quantity)])));
    setCustomPrices(Object.fromEntries(offerItems.filter(item=>Number.isSafeInteger(item.unitAmount)&&Number(item.unitAmount)>0).map(item=>[item.printingId,Number(item.unitAmount)])));
    setActiveOffer({...offer,items:offerItems});
    return true;
  },[items]);

  const selectedCount=useMemo(()=>Object.values(selected).reduce((total,amount)=>total+amount,0),[selected]);
  const selectionInCart=selectedCount>0&&items.every(item=>{const quantity=selected[item.id]??0;return quantity===0||(cartQuantities[item.id]??0)>=quantity});
  const publicListingTotal=useMemo(()=>items.reduce((total,item)=>total+item.quantity*item.unitAmount,0),[items]);
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
  const acceptsOffers=!isBuying||negotiable;
  const actionLabel=isBuying?t('Make offer','Ajukan penawaran'):t('Offer cards','Tawarkan kartu');
  const openOfferConversation=(offerId:string)=>router.push(`/market?activity=offers&conversation=${encodeURIComponent(offerId)}`);
  useEffect(()=>{
    let active=true;
    if(sessionPending)return()=>{active=false};
    if(!session?.user||readOnly||!acceptsOffers){setOfferCheckComplete(true);return()=>{active=false};}
    setOfferCheckComplete(false);
    const controller=new AbortController();
    void fetch(`/api/listings/${encodeURIComponent(listingId)}/offers`,{cache:'no-store',signal:controller.signal})
      .then(async response=>response.ok?await response.json() as {offer?:ActiveListingOffer|null}:null)
      .then(payload=>{
        if(!active||!payload?.offer)return;
        restoreActiveOffer(payload.offer);
      })
      .catch(()=>{})
      .finally(()=>{if(active)setOfferCheckComplete(true)});
    return()=>{active=false;controller.abort()};
  },[listingId,session?.user.id,sessionPending,readOnly,acceptsOffers,items,restoreActiveOffer]);
  const continueOffer=async()=>{
    if(!session){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return;}
    setSubmitting(true);try{const offerItems=items.flatMap(item=>{const quantity=selected[item.id]??0;if(!quantity)return[];const unitAmount=getUnitPrice(item);return [{printingId:item.id,quantity,unitAmount}];});const response=await fetch(`/api/listings/${encodeURIComponent(listingId)}/offers`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:isBuying?'BUY':'SELL',items:offerItems,amount:selectedTotal,currency})});const payload=await response.json() as {id?:string;actorId?:string;status?:string;expiresAt?:string;error?:string;offerId?:string};if(!response.ok){if(response.status===409&&payload.offerId){const currentResponse=await fetch(`/api/listings/${encodeURIComponent(listingId)}/offers`,{cache:'no-store'});const current=await currentResponse.json() as {offer?:ActiveListingOffer|null};if(currentResponse.ok&&current.offer&&restoreActiveOffer(current.offer)){setOfferCheckComplete(true);toast.info(t('An open offer already exists.','Penawaran masih terbuka.'),{action:{label:t('See offer','Lihat penawaran'),onClick:()=>openOfferConversation(current.offer!.id)}});return;}}throw new Error(payload.error??t('We could not send your offer.','Gagal mengirimkan penawaran Anda.'));}const id=payload.id;if(!id)throw new Error(t('We could not confirm your offer. Refresh and check your Offers.','Penawaran belum dapat dikonfirmasi. Muat ulang dan periksa Penawaran Anda.'));setActiveOffer({id,actorId:payload.actorId??session.user.id,viewerIsActor:true,items:offerItems,amount:selectedTotal,currency,expiresAt:payload.expiresAt??null});setOfferJustSent(true);setOfferCheckComplete(true);toast.success(isBuying?t('Offer sent to the seller.','Penawaran dikirim ke penjual.'):t('Your cards were offered to the buyer.','Kartu Anda ditawarkan ke pembeli.'),{action:{label:t('See offer','Lihat penawaran'),onClick:()=>openOfferConversation(id)}});}catch(error){const message=error instanceof Error?error.message:'';const localized=language==='ID'&&message.includes('listing is no longer active')?'Listing ini sudah tidak aktif.':language==='ID'&&message.includes('listing has expired')?'Listing ini sudah kedaluwarsa.':language==='ID'&&message.includes('firm price')?'Listing ini menggunakan harga pas dan tidak menerima penawaran.':language==='ID'&&message.includes('Offer total must match')?'Total penawaran harus sesuai dengan harga tiap kartu.':message||t('We could not send your offer.','Gagal mengirimkan penawaran Anda.');toast.error(localized)}
  };
  const buySelected=()=>{
    if(!session){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return;}
    const orderItems=items.flatMap(item=>{const quantity=selected[item.id]??0;return quantity?[{printingId:item.id,quantity}]:[];});
    const query=new URLSearchParams({listing:listingId,items:JSON.stringify(orderItems)});
    router.push(`/checkout/market?${query.toString()}`);
  };
  const addSelectedToCart=()=>{
    if(!session){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return;}
    if(selectionInCart){window.dispatchEvent(new Event('vivreplay:open-market-cart'));return;}
    const cartKey='vivreplay-market-cart-v1';
    let cart:{sellerId:string;lines:{listingId:string;listingTitle:string;items:{printingId:string;quantity:number}[]}[]}={sellerId:sellerId??'',lines:[]};
    try{const saved=JSON.parse(window.localStorage.getItem(cartKey)||'null');if(saved&&Array.isArray(saved.lines))cart=saved;}catch{}
    if(cart.sellerId&&sellerId&&cart.sellerId!==sellerId){const replace=window.confirm(t('Checkout is limited to one seller at a time. Switching sellers will clear your current cart. Continue?','Checkout hanya bisa untuk satu penjual. Mengganti penjual akan menghapus isi keranjang saat ini. Lanjutkan?'));if(!replace)return;cart={sellerId,lines:[]};}
    cart.sellerId=sellerId??cart.sellerId;
    if(!cart.lines.some(line=>line.listingId===listingId)&&cart.lines.length>=10){toast.error(t('A cart can hold listings from up to 10 of this seller’s listings.','Keranjang dapat berisi hingga 10 listing dari penjual ini.'));return;}const incoming=items.flatMap(item=>selected[item.id]?[{printingId:item.id,quantity:Math.min(99,selected[item.id])}]:[]);
    const current=cart.lines.find(line=>line.listingId===listingId);
    if(current){for(const item of incoming){const existing=current.items.find(line=>line.printingId===item.printingId);const available=items.find(listingItem=>listingItem.id===item.printingId)?.quantity??item.quantity;if(existing)existing.quantity=Math.min(99,available,Math.max(existing.quantity,item.quantity));else current.items.push({...item,quantity:Math.min(99,available,item.quantity)});}}
    else cart.lines.push({listingId,listingTitle:listingTitle??t('Card listing','Listing kartu'),items:incoming});
    window.localStorage.setItem(cartKey,JSON.stringify(cart));window.dispatchEvent(new Event('vivreplay:market-cart-updated'));
    toast.success(current?t('Cart updated','Keranjang diperbarui'):t('Added to cart','Ditambahkan ke keranjang'),{action:{label:t('View cart','Lihat keranjang'),onClick:()=>window.dispatchEvent(new Event('vivreplay:open-market-cart'))}});
  };

  return <section className="market-listing-cards" aria-labelledby="listing-cards-heading">
    <header className="market-listing-cards-header">
      <h2 id="listing-cards-heading">{t('Cards in this listing','Kartu dalam listing ini')}</h2>
      {!readOnly&&offerCheckComplete&&!activeOffer&&!submitting&&!singleCopyListing&&<div className="market-listing-bulk-actions" role="toolbar" aria-label={t('Bulk card selection','Pilihan borongan kartu')}>
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
            {!readOnly&&<div className="market-listing-card-utility-actions">
              {listingType==='WTS'&&<button type="button" className="button secondary is-icon-only market-listing-add-vault" onClick={()=>setVaultTarget(item)} aria-label={t('Add an owned copy to Vault','Simpan salinan milik Anda ke Koleksi')} title={t('Add an owned copy to Vault','Simpan salinan milik Anda ke Koleksi')}><Plus size={17}/></button>}
              <WishlistButton printingId={item.id} language={language} iconOnly/>
            </div>}
            {!readOnly&&offerCheckComplete&&!activeOffer&&!submitting&&!singleCopyListing&&<span className="deck-stack-actions market-listing-quantity" aria-label={`Select ${item.card.name}`}>
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
            <small className="market-card-meta"><span>{item.card.code}</span><span>{item.card.rarity}</span><span>{item.language}</span></small>
            <p className="market-listing-card-condition"><span>{item.condition}</span>{!readOnly&&!singleCopyListing&&<em>{amount}/{item.quantity} {t('selected','dipilih')}</em>}</p>
            <b className="market-listing-card-unit-price" aria-label={`${formatMoney(item.unitAmount,currency)} ${t('per card','per kartu')}`} title={`${formatMoney(item.unitAmount,currency)} ${t('per card','per kartu')}`}>{formatMoney(item.unitAmount,currency)}</b>

            {!readOnly&&acceptsOffers&&offerCheckComplete&&!activeOffer&&!submitting&&amount>0 && (
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
    {preview&&<CardPreviewModal card={preview} language={preview.language==='JP'?'JP':'EN'} cards={items.map(item=>item.card)} marketActions={!readOnly} onClose={()=>setPreview(undefined)} onNavigate={setPreview}/>}
    <AddEditItemModal key={`${vaultTarget?.id??'market-listing-card'}-${Boolean(vaultTarget)}`} open={Boolean(vaultTarget)} onClose={()=>setVaultTarget(null)} onSaved={()=>router.refresh()} initialCard={vaultTarget?.card} initialPrintingId={vaultTarget?.id} isAnonymous={!session?.user} language={language}/>
    {!readOnly&&<footer className={`market-listing-selection${offerJustSent?' has-push-prompt':''}`} aria-live="polite">
      <div className="market-listing-selection-info">
        <span>{activeOffer?(activeOffer.viewerIsActor?t('Offer sent, awaiting a response.','Penawaran terkirim, menunggu tanggapan.'):t('A counteroffer is waiting for you.','Ada penawaran balik untuk Anda.')):selectedCount?(language==='ID'?`${selectedCount} kartu dipilih`:`${selectedCount} ${selectedCount===1?'card':'cards'} selected`):t('Select cards to calculate a total','Pilih kartu untuk menghitung total')}</span>
        {!activeOffer&&selectedCount>0&&acceptsOffers&&<small>{t('Offers expire after 24 hours or when the listing ends.','Penawaran berakhir setelah 24 jam atau saat listing berakhir.')}</small>}
        {activeOffer?.expiresAt&&<small>{t('Expires','Berakhir')} {new Intl.DateTimeFormat(language==='ID'?'id-ID':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(activeOffer.expiresAt.includes('T')?activeOffer.expiresAt:`${activeOffer.expiresAt.replace(' ','T')}Z`))}</small>}
        <div className="market-listing-pricing-block">
          {hasPriceAdjustments && originalTotal>0 && (
            <span className="market-listing-asking-total">
              <small>{t('Asking:','Harga listing:')}</small>
              <s>{formatMoney(originalTotal,currency)}</s>
            </span>
          )}
          <div className="market-listing-final-total">
            {(hasPriceAdjustments||activeOffer)&&<small>{activeOffer?(activeOffer.viewerIsActor?t('Offer amount:','Nilai penawaran:'):t('Counteroffer:','Penawaran balik:')):t('Your offer:','Tawaran Anda:')}</small>}
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
        {isBuying&&<button type="button" className="button market-buy-selected" disabled={!selectedCount||submitting} onClick={buySelected}>{singleCopyListing?t('Buy now','Beli sekarang'):t('Buy selected','Beli pilihan')}</button>}
        {isBuying&&!readOnly&&<button type="button" className={`button secondary market-add-cart${selectionInCart?' is-in-cart':''}`} title={selectionInCart?t('In cart — view cart','Sudah di keranjang — lihat keranjang'):t('Add selected cards to cart','Tambahkan kartu pilihan ke keranjang')} aria-label={selectionInCart?t('In cart — view cart','Sudah di keranjang — lihat keranjang'):t('Add selected cards to cart','Tambahkan kartu pilihan ke keranjang')} aria-pressed={selectionInCart} disabled={!selectedCount||submitting} onClick={addSelectedToCart}>{selectionInCart?<Check size={18}/>:<Cart size={18}/>}</button>}
        {activeOffer&&<button type="button" className="button market-listing-offer-action" onClick={()=>openOfferConversation(activeOffer.id)}>{activeOffer.viewerIsActor?t('See offer','Lihat penawaran'):t('Review counteroffer','Tinjau penawaran balik')}</button>}
        {!activeOffer&&acceptsOffers&&<button type="button" className="button market-listing-offer-action" disabled={!selectedCount||submitting||!offerCheckComplete} onClick={continueOffer}>{submitting?t('Sending...','Mengirim...'):!offerCheckComplete?t('Checking offer…','Memeriksa penawaran…'):session?(hasPriceAdjustments?t('Submit offer','Kirim penawaran'):actionLabel):(language==='ID'?`Masuk untuk ${isBuying?'menawar':'menawarkan'}`:`Sign in to ${actionLabel.toLowerCase()}`)}</button>}
        <ShareButton
          title={listingTitle ?? t('Card listing','Listing kartu')}
          path={`/market/${listingId}`}
          cards={items.map(item => ({
            card: item.card,
            quantity: item.quantity,
            condition: item.condition,
            unitAmount: item.unitAmount,
          }))}
          price={formatMoney(publicListingTotal, currency)}
          subtitle={language==='ID'?`${items.reduce((acc, it) => acc + it.quantity, 0)} kartu`:`${items.reduce((acc, it) => acc + it.quantity, 0)} ${items.reduce((acc, it) => acc + it.quantity, 0) === 1 ? 'card' : 'cards'}`}
          className="market-listing-share"
        />
      </div>
      {offerJustSent&&<PushNotificationPrompt language={language} message="offer"/>}
    </footer>}
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
  const shippingQuoteItems=useMemo(()=>listingCards.map(item=>({printingId:item.id,quantity:item.quantity,unitAmount:item.unitAmount})),[listingCards]);

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
              <div className="market-listing-eyebrow-row">
                <p className="eyebrow market-listing-eyebrow">
                  <span>{primary.language} {t('printing', 'cetakan')}</span>
                  {listing.createdAt && <><span className="market-listing-eyebrow-separator" aria-hidden="true">/</span><span><MarketTimestamp value={listing.createdAt}/></span></>}
                  {expiresAt && <><span className="market-listing-eyebrow-separator" aria-hidden="true">/</span><span>{isExpired?(status==='CLOSED'?t('Closed','Ditutup'):t('Expired','Kedaluwarsa')):daysLeft===null?t('Expiry date unavailable','Tanggal akhir tidak tersedia'):<>{t('Ends in','Berakhir dalam')} {daysLeft} {t('days','hari')}</>}</span></>}
                </p>
                {isOwner&&<><span className="market-listing-eyebrow-separator" aria-hidden="true">/</span><div className="market-listing-owner-actions">
                  <button type="button" className="btn-renew" disabled={renewing} onClick={handleRenew} aria-label={isExpired?t('Renew listing','Perbarui listing'):t('Extend listing','Perpanjang listing')}><Renew size={14}/><span>{renewing?t('Saving…','Menyimpan…'):isExpired?t('Renew','Perbarui'):t('Extend','Perpanjang')}</span></button>
                  {!isExpired&&<button type="button" className="btn-close" disabled={closing} onClick={handleClose} aria-label={t('Close listing','Tutup listing')}><X size={14}/><span>{closing?t('Closing…','Menutup…'):t('Close','Tutup')}</span></button>}
                </div></>}
              </div>
              <h1>{listing.title}</h1>
            </div>
            <span className={`market-listing-status ${isBuying ? 'is-buying' : 'is-selling'}`}>{typeLabel}</span>
          </header>

          <dl className="market-listing-facts">
            <div>
              <dt>{t('Price', 'Harga')}</dt>
              <dd>{formatMoney(listing.amount, listing.currency)}</dd>
            </div>
            {listing.type==='WTS'&&<div>
              <dt>{t('Price terms','Ketentuan harga')}</dt>
              <dd>{listing.negotiable===false?t('Firm price','Harga pas'):t('Negotiable','Bisa ditawar')}</dd>
            </div>}
            <div>
              <dt>{isBuying ? t('Location', 'Lokasi') : t('Ships from', 'Dikirim dari')}</dt>
              <dd>{listing.city}</dd>
            </div>
            {cardCount>1&&<div>
              <dt>{t('Cards', 'Kartu')}</dt>
              <dd>{cardCount}</dd>
            </div>}
            {!isBuying && !isOwner && <ShippingOptions listingId={listing.id} courierCount={listing.shippingOptionCount??0} couriers={listing.shippingCouriers??[]} items={shippingQuoteItems}/>}
          </dl>

          {!isOwner && isExpired && (
            <div className="market-expired-banner">
              <strong>{status === 'CLOSED' ? t('This listing has been closed', 'Listing ini telah ditutup') : t('This listing has expired', 'Listing ini telah kedaluwarsa')}</strong>
              <p>{t('The seller has not renewed this listing and it is no longer accepting offers.', 'Penjual belum memperbarui listing ini dan tidak lagi menerima penawaran.')}</p>
            </div>
          )}

          <div className="market-listing-seller-toolbar">
            <section className="market-listing-seller">
              <span>{listing.seller.slice(0, 1).toUpperCase()}</span>
              <div className="market-listing-seller-copy">
                <small>{isBuying ? t('Buyer', 'Pembeli') : t('Seller', 'Penjual')}</small>
                <div className="market-listing-seller-name"><strong>{stored ? <Link href={`/players/${stored.username}`}>{listing.seller}</Link> : listing.seller}</strong><MarketReputation listingId={listing.id} language={language} role={isBuying?'buyer':'seller'}/></div>
              </div>
            </section>
            {!isOwner&&<div className="market-listing-utility-actions"><FeedbackLaunchButton request={{initialCategory:'market-report',listingId:listing.id}} className="market-report-link">{t('Report listing','Laporkan listing')}</FeedbackLaunchButton><SaveListingButton listingId={listing.id} language={language} iconOnly/></div>}
          </div>

          {(!isExpired||isOwner)&&(
            <MarketListingItems
              items={listingCards}
              currency={listing.currency}
              listingType={listing.type === 'WTB' ? 'WTB' : 'WTS'}
              listingId={listing.id}
              sellerId={listing.sellerId}
              listingTitle={listing.title}
              listingAmount={formatMoney(listing.amount, listing.currency)}
              negotiable={listing.negotiable!==false}
              readOnly={isOwner}
            />
          )}
        </section>
      </article>
    </main>
  );
}
