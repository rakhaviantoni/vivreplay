'use client';

import Link from 'next/link';
import {SaveListingButton,WishlistButton} from './market-saved';
import {MarketReputation} from './market-reputation';
import {useRouter} from 'next/navigation';
import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {ArrowClockwiseIcon as Renew,ArrowLeftIcon, CheckIcon as Check, InfoIcon as Info, ListIcon as List, MinusIcon as Minus, PlusIcon as Plus, ShoppingCartIcon as Cart, SquaresFourIcon as Grid, TruckIcon as Truck, XIcon as X} from '@phosphor-icons/react';
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
import {marketListingPath} from '@/lib/market/listing-url';
import {PhoneInput} from '@/components/tcg/phone-input';
import {MapPicker} from '@/components/tcg/map-picker';
import {INDONESIAN_REGIONS,getCities,getDistricts,getSubdistricts} from '@/lib/indonesia-areas';
import {MarketListingPriceEdit,MarketListingPriceTerms,MarketListingTitleEdit,MarketListingUnitPriceEdit} from '@/components/tcg/market-listing-inline-edit';
import {MarketAddCardsModal} from '@/components/tcg/market-add-cards-modal';
import {Slider} from '@/components/ui/slider';

type CourierRate={courier_code:string;courier_service_code:string;courier_name:string;courier_service_name:string;price:number;duration?:string;max_km?:number};
type ShippingArea={id:string;name:string;province:string;city:string;district:string;subdistrict:string;postalCode:string;latitude?:number;longitude?:number;source:'biteship'|'local'};
type DeliveryAddressDraft={recipientName:string;phone:string;addressLine:string;city:string;postalCode:string;areaId:string|null;latitude:number|null;longitude:number|null;label:string;shippingMethods:string[];regions:{province?:string;city?:string;district?:string;subdistrict?:string}};
type DeliveryRegionOption={id:string;name:string;postalCode?:string|null;latitude?:number|null;longitude?:number|null};
type DeliveryRegionLevel='provinces'|'regencies'|'districts'|'villages';
type DeliveryRegionContext={province?:string;city?:string;district?:string};
const normalizeDeliveryRegion=(value:string)=>{const name=value.toLocaleLowerCase('id').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^(provinsi|province|kota administrasi|kabupaten administrasi|kabupaten|kota|kab\.?|kec\.?|kecamatan)\s+/,'').replace(/[^a-z0-9]+/g,' ').trim();if(name==='dki jakarta'||name==='daerah khusus ibukota jakarta')return'jakarta';if(name==='di yogyakarta'||name==='daerah istimewa yogyakarta')return'yogyakarta';return name};
function localDeliveryRegions(level:DeliveryRegionLevel,context:DeliveryRegionContext={}):DeliveryRegionOption[]{
  const province=INDONESIAN_REGIONS.find(item=>normalizeDeliveryRegion(item.name)===normalizeDeliveryRegion(context.province??''));
  const city=province&&getCities(province.name).find(item=>normalizeDeliveryRegion(item.name)===normalizeDeliveryRegion(context.city??''));
  const district=province&&city&&getDistricts(province.name,city.name).find(item=>normalizeDeliveryRegion(item.name)===normalizeDeliveryRegion(context.district??''));
  if(level==='provinces')return INDONESIAN_REGIONS.map(item=>({id:`local:province:${item.name}`,name:item.name}));
  if(level==='regencies'&&province)return getCities(province.name).map(item=>({id:`local:city:${province.name}:${item.name}`,name:item.name,latitude:item.latitude,longitude:item.longitude}));
  if(level==='districts'&&province&&city)return getDistricts(province.name,city.name).map(item=>({id:`local:district:${province.name}:${city.name}:${item.name}`,name:item.name,latitude:item.latitude,longitude:item.longitude}));
  if(level==='villages'&&province&&city&&district)return getSubdistricts(province.name,city.name,district.name).map(item=>({id:`local:village:${item.name}`,name:item.name,postalCode:item.postalCode,latitude:item.latitude,longitude:item.longitude}));
  return[];
}
async function loadDeliveryRegions(level:DeliveryRegionLevel,parent:string|undefined,context:DeliveryRegionContext):Promise<DeliveryRegionOption[]>{
  if(parent?.startsWith('local:'))return localDeliveryRegions(level,context);
  const params=new URLSearchParams({level});if(parent)params.set('parent',parent);
  try{const response=await fetch(`/api/shipping/regions?${params}`);const payload=await response.json() as {items?:DeliveryRegionOption[]};if(response.ok&&Array.isArray(payload.items)&&payload.items.length)return payload.items}catch{}
  return localDeliveryRegions(level,context);
}
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
  const [quoteError,setQuoteError]=useState('');
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
  const [addressProvinces,setAddressProvinces]=useState<DeliveryRegionOption[]>([]);
  const [addressCities,setAddressCities]=useState<DeliveryRegionOption[]>([]);
  const [addressDistricts,setAddressDistricts]=useState<DeliveryRegionOption[]>([]);
  const [addressVillages,setAddressVillages]=useState<DeliveryRegionOption[]>([]);
  const [addressRegionsLoading,setAddressRegionsLoading]=useState({provinces:false,cities:false,districts:false,villages:false});

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
      setRates([]);setStartingFee(null);setLoading(false);setQuoteState('idle');setQuoteError('');
    };
    reset();
    window.addEventListener('vivreplay:shipping-updated',reset);
    return()=>{window.removeEventListener('vivreplay:shipping-updated',reset);quoteRequest.current?.abort();};
  },[listingId,session?.user.id]);

  const loadRates=useCallback(async(cacheOnly=false,silent=false)=>{
    if(inFlight.current)return;
    setQuoteError('');
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
    }catch(error){if(controller.signal.aborted||cacheOnly)return;setQuoteState('error');setQuoteError(error instanceof Error?error.message:t('Live rates could not be loaded.','Tarif pengiriman belum dapat dimuat.'));if(!cacheOnly&&!silent)toast.error(error instanceof Error?error.message:t('Live rates could not be loaded.','Tarif pengiriman belum dapat dimuat.'));}
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
    if(!addressFormOpen)return;
    let active=true;setAddressRegionsLoading(current=>({...current,provinces:true}));
    void loadDeliveryRegions('provinces',undefined,{}).then(options=>{if(active)setAddressProvinces(options)}).finally(()=>{if(active)setAddressRegionsLoading(current=>({...current,provinces:false}))});
    return()=>{active=false};
  },[addressFormOpen]);
  useEffect(()=>{
    if(!addressFormOpen)return;
    const provinceName=addressDraft.regions.province??'';
    if(!provinceName){setAddressCities([]);return}
    let active=true;setAddressRegionsLoading(current=>({...current,cities:true}));
    const province=addressProvinces.find(option=>normalizeDeliveryRegion(option.name)===normalizeDeliveryRegion(provinceName));
    void loadDeliveryRegions('regencies',province?.id??`local:province:${provinceName}`,{province:provinceName}).then(options=>{if(active)setAddressCities(options)}).finally(()=>{if(active)setAddressRegionsLoading(current=>({...current,cities:false}))});
    return()=>{active=false};
  },[addressFormOpen,addressDraft.regions.province,addressProvinces]);
  useEffect(()=>{
    if(!addressFormOpen)return;
    const {province:provinceName,city:cityName}=addressDraft.regions;
    if(!provinceName||!cityName){setAddressDistricts([]);return}
    let active=true;setAddressRegionsLoading(current=>({...current,districts:true}));
    const province=addressProvinces.find(option=>normalizeDeliveryRegion(option.name)===normalizeDeliveryRegion(provinceName));
    const city=addressCities.find(option=>normalizeDeliveryRegion(option.name)===normalizeDeliveryRegion(cityName));
    void loadDeliveryRegions('districts',city?.id??`local:city:${cityName}`,{province:provinceName,city:cityName}).then(options=>{if(active)setAddressDistricts(options)}).finally(()=>{if(active)setAddressRegionsLoading(current=>({...current,districts:false}))});
    return()=>{active=false};
  },[addressFormOpen,addressDraft.regions.province,addressDraft.regions.city,addressProvinces,addressCities]);
  useEffect(()=>{
    if(!addressFormOpen)return;
    const {province:provinceName,city:cityName,district:districtName}=addressDraft.regions;
    if(!provinceName||!cityName||!districtName){setAddressVillages([]);return}
    let active=true;setAddressRegionsLoading(current=>({...current,villages:true}));
    const district=addressDistricts.find(option=>normalizeDeliveryRegion(option.name)===normalizeDeliveryRegion(districtName));
    void loadDeliveryRegions('villages',district?.id??`local:district:${districtName}`,{province:provinceName,city:cityName,district:districtName}).then(options=>{if(active)setAddressVillages(options)}).finally(()=>{if(active)setAddressRegionsLoading(current=>({...current,villages:false}))});
    return()=>{active=false};
  },[addressFormOpen,addressDraft.regions.province,addressDraft.regions.city,addressDraft.regions.district,addressDistricts]);

  const openAddressForm=async()=>{
    setAddressFormOpen(true);setQuoteState('needs-address');setQuoteError('');setAddressError('');setAddressLoading(true);
    try{
      const response=await fetch('/api/shipping/origin',{cache:'no-store'});
      if(!response.ok)throw new Error('');
      const payload=await response.json() as {origin?:(Partial<DeliveryAddressDraft>&{regionNames?:DeliveryAddressDraft['regions']})|null};
      const origin=payload.origin;
      if(origin)setAddressDraft(current=>{const savedRegions=origin.regionNames??origin.regions??{};const city=savedRegions.city||origin.city||'';const inferredProvince=savedRegions.province||INDONESIAN_REGIONS.find(province=>getCities(province.name).some(option=>normalizeDeliveryRegion(option.name)===normalizeDeliveryRegion(city)))?.name||'';const regions={...savedRegions,province:inferredProvince,city};return{...current,recipientName:origin.recipientName||session?.user.name||current.recipientName,phone:origin.phone||current.phone,addressLine:origin.addressLine||'',city,postalCode:origin.postalCode||'',areaId:origin.areaId||null,latitude:typeof origin.latitude==='number'?origin.latitude:null,longitude:typeof origin.longitude==='number'?origin.longitude:null,label:origin.label||current.label,shippingMethods:origin.shippingMethods??current.shippingMethods,regions}});
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
      setAddressFormOpen(false);window.dispatchEvent(new Event('vivreplay:shipping-updated'));
      await loadRates();
    }catch(error){setAddressError(error instanceof Error?error.message:t('Address could not be saved.','Alamat gagal disimpan.'))}
    finally{setAddressSaving(false)}
  };

  const quoteErrorMessage=language==='ID'&&/postal code.*delivery area|delivery area.*postal code/i.test(quoteError)
    ?'Kode pos belum cocok dengan wilayah pengiriman. Cari kecamatan atau kelurahan, lalu pilih hasil yang benar.'
    :quoteError||t('Rates could not load. Check your delivery address.','Ongkir gagal dimuat. Periksa alamat pengiriman Anda.');

  const modal=open?(
    <div className="shipping-options-backdrop" role="presentation" onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget)setOpen(false);}}>
      <div className={`shipping-options-dialog${addressFormOpen?' has-address-form':''}`} ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('Shipping Options','Opsi Pengiriman')} onClick={e=>e.stopPropagation()}>
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
            <p>{quoteState==='needs-sign-in'?t('Sign in to check delivery fees for this listing.','Masuk untuk melihat ongkir listing ini.'):quoteState==='needs-address'?t('Add a delivery address to see rates for this listing.', 'Tambahkan alamat pengiriman untuk melihat ongkir listing ini.'):quoteState==='error'?quoteErrorMessage:courierCount>0?t('No live rates are available for this address. Check your delivery area and saved address.', 'Tarif tidak tersedia untuk alamat ini. Periksa wilayah dan alamat pengiriman Anda.'):t('The seller has not set up shipping yet.','Penjual belum mengatur pengiriman.')}</p>
            {quoteState==='needs-sign-in'&&<button type="button" className="shipping-options-address-btn" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}>{t('Sign in','Masuk')}</button>}
            {quoteState==='needs-address'&&!addressFormOpen&&<button type="button" className="shipping-options-address-btn" onClick={()=>void openAddressForm()}>{t('Add delivery address','Tambahkan alamat pengiriman')}</button>}
            {(quoteState==='error'||quoteState==='unavailable')&&session?.user.id&&<button type="button" className="shipping-options-address-btn" onClick={()=>void openAddressForm()}>{t('Edit delivery address','Ubah alamat pengiriman')}</button>}
            {quoteState==='error'&&courierCount>0&&!/postal code|delivery area/i.test(quoteError)&&<button type="button" className="shipping-options-retry" onClick={()=>void loadRates()}>{t('Check again','Cek lagi')}</button>}
          </div>}
          {quoteState==='needs-address'&&addressFormOpen&&<form className="shipping-options-address-form" onSubmit={saveDeliveryAddress}>
            <div className="shipping-options-address-heading"><strong>{t('Delivery address','Alamat pengiriman')}</strong><button type="button" onClick={()=>setAddressFormOpen(false)}>{t('Cancel','Batal')}</button></div>
            {addressLoading?<div className="shipping-options-address-loading" role="status">{t('Loading saved address…','Memuat alamat tersimpan…')}</div>:<>
              <div className="shipping-address-fields">
                <label>{t('Recipient name','Nama penerima')}<input required minLength={2} maxLength={100} autoComplete="name" value={addressDraft.recipientName} onChange={event=>setAddressDraft(current=>({...current,recipientName:event.target.value}))}/></label>
                <PhoneInput required label={t('Phone number','Nomor telepon')} autoComplete="tel" value={addressDraft.phone} onChange={phone=>setAddressDraft(current=>({...current,phone}))} locale={language}/>
                <label className="shipping-address-wide">{t('Street address / Building / Landmark','Alamat jalan / Gedung / Patokan')}<input required minLength={5} maxLength={260} autoComplete="street-address" value={addressDraft.addressLine} onChange={event=>setAddressDraft(current=>({...current,addressLine:event.target.value}))}/></label>
                <div className="shipping-cascading-grid shipping-address-wide">
                  <label>{t('Province','Provinsi')}<select required value={addressDraft.regions.province??''} onChange={event=>{const province=event.target.value;setAddressDraft(current=>({...current,city:'',areaId:null,postalCode:'',latitude:null,longitude:null,regions:{province,city:'',district:'',subdistrict:''}}))}}><option value="">{addressRegionsLoading.provinces?t('Loading provinces…','Memuat provinsi…'):t('Select province','Pilih provinsi')}</option>{addressProvinces.map(option=><option key={option.id} value={option.name}>{option.name}</option>)}{addressDraft.regions.province&&!addressProvinces.some(option=>normalizeDeliveryRegion(option.name)===normalizeDeliveryRegion(addressDraft.regions.province??''))&&<option value={addressDraft.regions.province}>{addressDraft.regions.province}</option>}</select></label>
                  <label>{t('City / Regency','Kota / Kabupaten')}<select required disabled={!addressDraft.regions.province||addressRegionsLoading.cities} value={addressDraft.regions.city??''} onChange={event=>{const city=addressCities.find(option=>option.name===event.target.value);setAddressDraft(current=>({...current,city:event.target.value,areaId:null,postalCode:'',latitude:city?.latitude??null,longitude:city?.longitude??null,regions:{...current.regions,city:event.target.value,district:'',subdistrict:''}}))}}><option value="">{addressRegionsLoading.cities?t('Loading cities…','Memuat kota…'):t('Select city / regency','Pilih kota / kabupaten')}</option>{addressCities.map(option=><option key={option.id} value={option.name}>{option.name}</option>)}{addressDraft.regions.city&&!addressCities.some(option=>normalizeDeliveryRegion(option.name)===normalizeDeliveryRegion(addressDraft.regions.city??''))&&<option value={addressDraft.regions.city}>{addressDraft.regions.city}</option>}</select></label>
                  <label>{t('District','Kecamatan')}<select required disabled={!addressDraft.regions.city||addressRegionsLoading.districts} value={addressDraft.regions.district??''} onChange={event=>{const district=addressDistricts.find(option=>option.name===event.target.value);setAddressDraft(current=>({...current,areaId:null,postalCode:'',latitude:district?.latitude??current.latitude,longitude:district?.longitude??current.longitude,regions:{...current.regions,district:event.target.value,subdistrict:''}}))}}><option value="">{addressRegionsLoading.districts?t('Loading districts…','Memuat kecamatan…'):t('Select district','Pilih kecamatan')}</option>{addressDistricts.map(option=><option key={option.id} value={option.name}>{option.name}</option>)}{addressDraft.regions.district&&!addressDistricts.some(option=>normalizeDeliveryRegion(option.name)===normalizeDeliveryRegion(addressDraft.regions.district??''))&&<option value={addressDraft.regions.district}>{addressDraft.regions.district}</option>}</select></label>
                  <label>{t('Village / Sub-district','Kelurahan / Desa')}<select required disabled={!addressDraft.regions.district||addressRegionsLoading.villages} value={addressDraft.regions.subdistrict??''} onChange={event=>{const village=addressVillages.find(option=>option.name===event.target.value);setAddressDraft(current=>({...current,areaId:null,postalCode:village?.postalCode?String(village.postalCode):'',latitude:village?.latitude??null,longitude:village?.longitude??null,regions:{...current.regions,subdistrict:event.target.value}}))}}><option value="">{addressRegionsLoading.villages?t('Loading villages…','Memuat kelurahan…'):t('Select village / sub-district','Pilih kelurahan / desa')}</option>{addressVillages.map(option=><option key={option.id} value={option.name}>{option.name}{option.postalCode?` (${option.postalCode})`:''}</option>)}{addressDraft.regions.subdistrict&&!addressVillages.some(option=>normalizeDeliveryRegion(option.name)===normalizeDeliveryRegion(addressDraft.regions.subdistrict??''))&&<option value={addressDraft.regions.subdistrict}>{addressDraft.regions.subdistrict}</option>}</select></label>
                </div>
                <label className="shipping-address-wide">{t('Postal code','Kode pos')}<input required={!addressDraft.areaId} inputMode="numeric" autoComplete="postal-code" maxLength={5} pattern="[0-9]{5}" value={addressDraft.postalCode} onChange={event=>setAddressDraft(current=>({...current,areaId:null,postalCode:event.target.value.replace(/\D/g,'').slice(0,5)}))}/></label>
              </div>
              {addressError&&<p className="shipping-options-address-error" role="alert">{addressError}</p>}
              <MapPicker latitude={addressDraft.latitude} longitude={addressDraft.longitude} onChange={coords=>setAddressDraft(current=>({...current,latitude:coords.lat,longitude:coords.lng}))} language={language} purpose="delivery" cityHint={[addressDraft.regions.subdistrict,addressDraft.regions.district,addressDraft.city].filter(Boolean).join(', ')||undefined}/>
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

function WantedListingShippingOptions({listingId,destinationCity,items,language,previewOnly=false}:{listingId:string;destinationCity:string;items:Array<{printingId:string;quantity:number;unitAmount:number}>;language:'EN'|'ID';previewOnly?:boolean}){
  const {data:session}=authClient.useSession();
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState(destinationCity);
  const [areas,setAreas]=useState<ShippingArea[]>([]);
  const [loadingAreas,setLoadingAreas]=useState(false);
  const [loadingRates,setLoadingRates]=useState(false);
  const [rates,setRates]=useState<CourierRate[]>([]);
  const [destination,setDestination]=useState('');
  const [error,setError]=useState('');
  const [selectedArea,setSelectedArea]=useState(false);
  const dialogRef=useRef<HTMLDivElement>(null);
  const t=(en:string,id:string)=>language==='ID'?id:en;

  useEffect(()=>{
    if(!open||!session?.user.id||selectedArea||query.trim().length<2)return;
    let active=true;
    const timer=window.setTimeout(async()=>{
      setLoadingAreas(true);
      try{
        const response=await fetch(`/api/shipping/areas?query=${encodeURIComponent(query.trim())}`);
        const payload=await response.json() as {areas?:ShippingArea[]};
        if(active)setAreas((payload.areas??[]).slice(0,8));
      }catch{if(active)setAreas([])}finally{if(active)setLoadingAreas(false)}
    },300);
    return()=>{active=false;window.clearTimeout(timer)};
  },[open,query,selectedArea,session?.user.id]);

  useEffect(()=>{
    if(!open)return;
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
    document.addEventListener('keydown',close);
    return()=>document.removeEventListener('keydown',close);
  },[open]);

  const chooseArea=async(area:ShippingArea)=>{
    setQuery([area.subdistrict,area.district,area.city].filter(Boolean).join(', '));
    setDestination([area.city,area.province].filter(Boolean).join(', '));
    setSelectedArea(true);
    setAreas([]);setError('');setRates([]);setLoadingRates(true);
    try{
      const response=await fetch('/api/shipping/quotes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listingId,items,destinationAreaId:area.source==='biteship'?area.id:'',destinationPostalCode:area.postalCode,estimateForWantedListing:true})});
      const payload=await response.json() as {pricing?:CourierRate[];error?:string};
      if(!response.ok)throw new Error(payload.error||t('Delivery fees could not load. Check your shipping details.','Ongkir belum dapat dimuat. Periksa detail pengiriman Anda.'));
      setRates(payload.pricing??[]);
      if(!payload.pricing?.length)setError(t('No delivery services are available for this area. Choose another district.','Layanan pengiriman tidak tersedia untuk wilayah ini. Pilih kecamatan lain.'));
    }catch(reason){setError(reason instanceof Error?reason.message:t('Delivery fees could not load. Check your shipping details.','Ongkir belum dapat dimuat. Periksa detail pengiriman Anda.'))}
    finally{setLoadingRates(false)}
  };

  const searchAgain=()=>{setSelectedArea(false);setDestination('');setRates([]);setError('');setAreas([])};
  const needsShippingSetup=/add a shipping address|choose a courier|valid 5-digit pickup postal code/i.test(error);

  return <div className="market-wanted-shipping-options">
    <button type="button" className="shipping-options-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setQuery(destinationCity);setSelectedArea(false);setOpen(true)}}>{t('Check delivery fees','Cek ongkir')}</button>
    {open&&<div className="shipping-options-backdrop" role="presentation" onClick={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
      <div className="shipping-options-dialog market-wanted-shipping-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('Delivery fees','Ongkir')} onClick={event=>event.stopPropagation()}>
        <header className="shipping-options-header"><strong>{t('Delivery fees','Ongkir')}</strong><button type="button" className="shipping-options-close" onClick={()=>setOpen(false)} aria-label={t('Close','Tutup')}><X size={15}/></button></header>
        <div className="market-wanted-shipping-body">
          {previewOnly?<div className="shipping-options-empty"><p>{t('Sellers can check delivery fees after choosing a district.','Penjual dapat melihat ongkir setelah memilih kecamatan.')}</p></div>:!session?.user.id?<div className="shipping-options-empty"><p>{t('Sign in to see delivery fees from your address to the buyer.','Masuk untuk melihat ongkir dari alamat Anda ke pembeli.')}</p><Link className="shipping-options-address-btn" href="/sign-in">{t('Sign in','Masuk')}</Link></div>:<>
            <p className="market-wanted-shipping-route">{t('From your saved shipping address to','Dari alamat pengiriman Anda ke')} <strong>{destination||destinationCity}</strong></p>
            <label className="market-wanted-shipping-search">{t('Choose the buyer’s district','Pilih kecamatan pembeli')}<input value={query} onChange={event=>{setQuery(event.target.value);setAreas([]);setSelectedArea(false);setDestination('');setRates([]);setError('')}} placeholder={t('Search district or village','Cari kecamatan atau kelurahan')} autoComplete="off"/></label>
            {loadingAreas&&<small className="market-wanted-shipping-state" role="status">{t('Searching delivery areas…','Mencari wilayah pengiriman…')}</small>}
            {!loadingAreas&&!selectedArea&&query.trim().length>=2&&areas.length===0&&<small className="market-wanted-shipping-state">{t('No matching areas. Try a district or village name.','Wilayah tidak ditemukan. Coba nama kecamatan atau kelurahan.')}</small>}
            {areas.length>0&&!selectedArea&&<div className="shipping-options-area-results" role="listbox" aria-label={t('Delivery areas','Wilayah pengiriman')}>{areas.map(area=><button type="button" role="option" key={`${area.source}:${area.id}`} onClick={()=>void chooseArea(area)}><strong>{[area.subdistrict,area.district].filter(Boolean).join(', ')||area.name}</strong><small>{[area.city,area.province,area.postalCode].filter(Boolean).join(' / ')}</small></button>)}</div>}
            {loadingRates&&<div className="shipping-options-loading" role="status">{t('Loading delivery fees…','Memuat ongkir…')}</div>}
            {error&&<div className="market-wanted-shipping-error" role="alert"><p>{error}</p>{needsShippingSetup?<Link className="shipping-options-address-btn" href="/profile?tab=shipping">{t('Set up shipping','Atur pengiriman')}</Link>:<button type="button" className="shipping-options-address-btn" onClick={searchAgain}>{t('Choose another area','Pilih wilayah lain')}</button>}</div>}
            {!loadingRates&&rates.length>0&&<ul className="shipping-options-list">{rates.map(rate=><li className="shipping-options-item" key={`${rate.courier_code}:${rate.courier_service_code}`}><span className="shipping-options-courier"><strong>{COURIER_LABELS[rate.courier_code]??rate.courier_name}</strong><small>{rate.courier_service_name}{rate.duration?` - ${rate.duration}`:''}</small></span><span className="shipping-options-rate-price">{formatMoney(rate.price,'IDR')}</span></li>)}</ul>}
          </>}
        </div>
      </div>
    </div>}
  </div>;
}

export type MarketListingCard={
  id:string;
  instanceId?:string;
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
  if(!active)return null;
  const cardCount=items.reduce((total,item)=>total+Math.max(0,item.quantity||0),0);
  const visibleStackCount=Math.min(3,Math.max(1,cardCount));
  const underlays=Array.from({length:visibleStackCount-1},(_,index)=>items[(activeIndex+index+1)%items.length]??active);

  return <div className={`viewer-art-stack market-listing-art-rotator ${visibleStackCount===1?'is-single':''}`} data-card-count={cardCount} aria-label={`Featured card: ${active.card.name}; ${cardCount} cards in this listing`}>
    {underlays.map((item,index)=><div key={`${item.id}-${index}`} className={`viewer-art-underlay viewer-art-underlay-${index}`} aria-hidden="true"><CardArt card={item.card}/></div>)}
    <div className="viewer-art-current market-listing-art-current" key={active.id}><CardArt card={active.card} priority/></div>
  </div>;
}

export function MarketListingItems({items,currency,listingType,listingId,listingTitle,sellerId,listingInfo,negotiable=true,readOnly=false,previewOnly=false,canEditPrices=false,canManageListing=false,onItemsAdded,onPriceSaved}:{items:MarketListingCard[];currency:string;listingType:'WTS'|'WTB';listingId:string;listingTitle?:string;sellerId?:string;listingInfo?:{seller?:string;city?:string;expiresAt?:string};listingAmount?:string;negotiable?:boolean;readOnly?:boolean;previewOnly?:boolean;canEditPrices?:boolean;canManageListing?:boolean;onItemsAdded?:(cards:MarketListingCard[])=>void;onPriceSaved?:(index:number,unitAmount:number)=>void;}){
  const router=useRouter();
  const singleCopyListing=items.length===1&&items[0].quantity===1;
  const [selected,setSelected]=useState<Record<string,number>>(()=>singleCopyListing?{[items[0].id]:1}:{});
  const [cardsView,setCardsView]=useState<'grid'|'list'>('grid');
  const [customPrices,setCustomPrices]=useState<Record<string,number>>({});
  const [preview,setPreview]=useState<Card>();
  const [previewPrintingId,setPreviewPrintingId]=useState<string>();
  const [vaultTarget,setVaultTarget]=useState<MarketListingCard|null>(null);
  const [addCardsOpen,setAddCardsOpen]=useState(false);
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

  const setPricePercent=(item:MarketListingCard,percent:number)=>{
    const raw=Math.round(item.unitAmount*(1+percent/100));
    const rounded=currency==='IDR'&&item.unitAmount>=10000?Math.round(raw/1000)*1000:raw;
    setCustomPrices(prev=>({...prev,[item.id]:Math.max(1,rounded)}));
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
    if(!session?.user||readOnly||previewOnly||!acceptsOffers){setOfferCheckComplete(true);return()=>{active=false};}
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
  },[listingId,session?.user.id,sessionPending,readOnly,previewOnly,acceptsOffers,items,restoreActiveOffer]);
  const continueOffer=async()=>{
    if(previewOnly)return;
    if(!session){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return;}
    setSubmitting(true);try{const offerItems=items.flatMap(item=>{const quantity=selected[item.id]??0;if(!quantity)return[];const unitAmount=getUnitPrice(item);return [{printingId:item.id,quantity,unitAmount}];});const response=await fetch(`/api/listings/${encodeURIComponent(listingId)}/offers`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:isBuying?'BUY':'SELL',items:offerItems,amount:selectedTotal,currency})});const payload=await response.json() as {id?:string;actorId?:string;status?:string;expiresAt?:string;error?:string;offerId?:string};if(!response.ok){if(response.status===409&&payload.offerId){const currentResponse=await fetch(`/api/listings/${encodeURIComponent(listingId)}/offers`,{cache:'no-store'});const current=await currentResponse.json() as {offer?:ActiveListingOffer|null};if(currentResponse.ok&&current.offer&&restoreActiveOffer(current.offer)){setOfferCheckComplete(true);toast.info(t('An open offer already exists.','Penawaran masih terbuka.'),{action:{label:t('See offer','Lihat penawaran'),onClick:()=>openOfferConversation(current.offer!.id)}});return;}}throw new Error(payload.error??t('We could not send your offer.','Gagal mengirimkan penawaran Anda.'));}const id=payload.id;if(!id)throw new Error(t('We could not confirm your offer. Refresh and check your Offers.','Penawaran belum dapat dikonfirmasi. Muat ulang dan periksa Penawaran Anda.'));setActiveOffer({id,actorId:payload.actorId??session.user.id,viewerIsActor:true,items:offerItems,amount:selectedTotal,currency,expiresAt:payload.expiresAt??null});setOfferJustSent(true);setOfferCheckComplete(true);toast.success(isBuying?t('Offer sent to the seller.','Penawaran dikirim ke penjual.'):t('Your cards were offered to the buyer.','Kartu Anda ditawarkan ke pembeli.'),{action:{label:t('See offer','Lihat penawaran'),onClick:()=>openOfferConversation(id)}});}catch(error){const message=error instanceof Error?error.message:'';const localized=language==='ID'&&message.includes('listing is no longer active')?'Listing ini sudah tidak aktif.':language==='ID'&&message.includes('listing has expired')?'Listing ini sudah kedaluwarsa.':language==='ID'&&message.includes('firm price')?'Listing ini menggunakan harga pas dan tidak menerima penawaran.':language==='ID'&&message.includes('Offer total must match')?'Total penawaran harus sesuai dengan harga tiap kartu.':message||t('We could not send your offer.','Gagal mengirimkan penawaran Anda.');toast.error(localized)}
  };
  const buySelected=()=>{
    if(previewOnly)return;
    if(!session){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return;}
    const orderItems=items.flatMap(item=>{const quantity=selected[item.id]??0;return quantity?[{printingId:item.id,quantity}]:[];});
    const query=new URLSearchParams({listing:listingId,items:JSON.stringify(orderItems)});
    router.push(`/checkout/market?${query.toString()}`);
  };
  const addSelectedToCart=()=>{
    if(previewOnly)return;
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

  return <section className="market-listing-cards" aria-label={t('Cards in this listing','Kartu dalam listing ini')}>
    <header className="market-listing-cards-header">
      <div className="market-listing-cards-heading">
        <h2>{t('Cards in this listing','Kartu dalam listing ini')}</h2>
        {canManageListing&&listingType==='WTS'&&<button type="button" className="button secondary market-listing-add-cards" onClick={()=>setAddCardsOpen(true)}><Plus size={15}/>{t('Add cards','Tambah kartu')}</button>}
        <div className="market-view-toggle market-listing-view-toggle" role="group" aria-label={t('Card layout','Tata letak kartu')}>
          <button type="button" className={cardsView==='grid'?'active':''} onClick={()=>setCardsView('grid')} aria-label={t('Grid view','Tampilan kisi')} aria-pressed={cardsView==='grid'}><Grid size={16}/></button>
          <button type="button" className={cardsView==='list'?'active':''} onClick={()=>setCardsView('list')} aria-label={t('List view','Tampilan daftar')} aria-pressed={cardsView==='list'}><List size={16}/></button>
        </div>
      </div>
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
    <div className={`market-listing-card-grid is-${cardsView}`}>
      {items.map((item,index)=>{
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
                    onClick={()=>{setPreview(item.card);setPreviewPrintingId(item.id)}}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setPreview(item.card);setPreviewPrintingId(item.id);}}}
                  >
                    <CardArt card={item.card}/>
                  </div>
                ) : (
                  <CardArt card={item.card}/>
                )}
              </div>
            ))}
            {item.quantity>1 && <b>×{item.quantity}</b>}
            <button type="button" className="deck-info-action market-icon-action market-listing-info" onClick={()=>{setPreview(item.card);setPreviewPrintingId(item.id)}} aria-label={`View ${item.card.name} details`}><Info size={13}/></button>
            {!readOnly&&<div className="market-listing-card-utility-actions">
              {listingType==='WTS'&&<button type="button" className="button secondary is-icon-only market-icon-action market-listing-add-vault" disabled={previewOnly} onClick={()=>setVaultTarget(item)} aria-label={t('Add an owned copy to Vault','Simpan salinan milik Anda ke Koleksi')} title={t('Add an owned copy to Vault','Simpan salinan milik Anda ke Koleksi')}><Plus size={17}/></button>}
              <WishlistButton printingId={item.id} language={language} iconOnly disabled={previewOnly}/>
            </div>}
            {!readOnly&&offerCheckComplete&&!activeOffer&&!submitting&&!singleCopyListing&&<span className="deck-stack-actions market-listing-quantity" aria-label={`Select ${item.card.name}`}>
              <button type="button" onClick={()=>change(item.id,-1,item.quantity)} disabled={!amount} aria-label={`Remove one ${item.card.name}`}><Minus size={13}/></button>
              <button type="button" onClick={()=>change(item.id,1,item.quantity)} disabled={amount===item.quantity} aria-label={`Add one ${item.card.name}`}><Plus size={13}/></button>
              {item.quantity>1&&(()=>{
                const showPlayset=item.quantity>=4&&amount<4;
                const targetQty=showPlayset?4:(amount===item.quantity?0:item.quantity);
                const label=showPlayset?'4×':(amount===item.quantity?'0':(item.quantity===4?'4×':t('All','Semua')));
                const title=showPlayset?t('Take playset of 4','Ambil playset 4×'):(amount===item.quantity?t('Deselect card','Batalkan pilihan kartu'):t(`Take all ${item.quantity}`,`Ambil semua ${item.quantity}`));
                return <button type="button" className={`market-card-quick-btn ${amount===item.quantity||(showPlayset&&amount===4)?'is-active':''}`} onClick={()=>setItemExact(item.id,targetQty,item.quantity)} title={title} aria-label={`${label} ${item.card.name}`}>{label}</button>;
              })()}
            </span>}
          </div>
          <div className="market-listing-card-copy">
            <strong>{item.card.name}</strong>
            <small className="market-card-meta"><span>{item.card.code}</span><span>{item.card.rarity}</span><span>{item.language}</span></small>
            <p className="market-listing-card-condition"><span>{item.condition}</span>{!readOnly&&!singleCopyListing&&<em>{amount}/{item.quantity} {t('selected','dipilih')}</em>}</p>
            <div className="market-listing-card-unit-price" aria-label={`${formatMoney(item.unitAmount,currency)} ${t('per card','per kartu')}`} title={`${formatMoney(item.unitAmount,currency)} ${t('per card','per kartu')}`}>{canEditPrices?<MarketListingUnitPriceEdit listingId={listingId} title={listingTitle||''} listingType={listingType} cards={items.map(entry=>({printingId:entry.id,name:entry.card.name,quantity:entry.quantity,unitAmount:entry.unitAmount}))} cardIndex={index} currency={currency} language={language} onSaved={unitAmount=>onPriceSaved?.(index,unitAmount)}><span>{formatMoney(item.unitAmount,currency)}</span></MarketListingUnitPriceEdit>:formatMoney(item.unitAmount,currency)}</div>

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
                <div className="market-card-offer-slider-wrap">
                  <div className="market-card-offer-slider-label"><span>{t('Compared with asking price','Dibanding harga penjual')}</span><output>{diffPercent===0?t('Ask','Pas'):`${diffPercent>0?'+':''}${diffPercent}%`}</output></div>
                  <div className="market-slider-wrap">
                    <Slider
                      className="market-card-offer-slider"
                      min={-50}
                      max={50}
                      step={1}
                      value={[Math.max(-50,Math.min(50,diffPercent))]}
                      onValueChange={([value])=>value!==undefined&&setPricePercent(item,value)}
                      aria-label={`${t('Offer price compared with asking price for','Tawaran dibanding harga penjual untuk')} ${item.card.name}`}
                    />
                    <div className="market-slider-checkpoints" aria-hidden="true">{Array.from({length:21},(_,index)=><i key={index} style={{left:`${index*5}%`}}/>)}</div>
                  </div>
                  <div className="market-card-offer-slider-range" aria-hidden="true"><span>−50%</span><span>{t('Ask','Pas')}</span><span>+50%</span></div>
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
    {canManageListing&&listingType==='WTS'&&<MarketAddCardsModal key={addCardsOpen?'open':'closed'} open={addCardsOpen} listingId={listingId} listingItems={items.map(item=>({instanceId:item.instanceId,printingId:item.id,quantity:item.quantity,condition:item.condition,unitAmount:item.unitAmount,card:item.card,language:item.language}))} currency={currency} language={language} onClose={()=>setAddCardsOpen(false)} onAdded={cards=>{onItemsAdded?.(cards);router.refresh()}}/>}
    {preview&&<CardPreviewModal card={preview} initialPrintingId={previewPrintingId} printingIds={items.map(item=>item.id)} language={preview.language==='JP'?'JP':'EN'} cards={items.map(item=>item.card)} marketActions={!readOnly&&!previewOnly} onClose={()=>{setPreview(undefined);setPreviewPrintingId(undefined)}} onNavigate={(card,index)=>{setPreview(card);setPreviewPrintingId(items[index]?.id)}}/>}
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
        {isBuying&&<button type="button" className="button market-buy-selected" disabled={!selectedCount||submitting||previewOnly} onClick={buySelected}>{singleCopyListing?t('Buy now','Beli sekarang'):t('Buy selected','Beli pilihan')}</button>}
        {isBuying&&!readOnly&&<button type="button" className={`button secondary market-add-cart${selectionInCart?' is-in-cart':''}`} title={selectionInCart?t('In cart — view cart','Sudah di keranjang — lihat keranjang'):t('Add selected cards to cart','Tambahkan kartu pilihan ke keranjang')} aria-label={selectionInCart?t('In cart — view cart','Sudah di keranjang — lihat keranjang'):t('Add selected cards to cart','Tambahkan kartu pilihan ke keranjang')} aria-pressed={selectionInCart} disabled={!selectedCount||submitting||previewOnly} onClick={addSelectedToCart}>{selectionInCart?<Check size={18}/>:<Cart size={18}/>}</button>}
        {activeOffer&&<button type="button" className="button market-listing-offer-action" onClick={()=>openOfferConversation(activeOffer.id)}>{activeOffer.viewerIsActor?t('See offer','Lihat penawaran'):t('Review counteroffer','Tinjau penawaran balik')}</button>}
        {!activeOffer&&acceptsOffers&&<button type="button" className="button market-listing-offer-action" disabled={!selectedCount||submitting||!offerCheckComplete||previewOnly} onClick={continueOffer}>{submitting?t('Sending...','Mengirim...'):!offerCheckComplete?t('Checking offer…','Memeriksa penawaran…'):session?(hasPriceAdjustments?t('Submit offer','Kirim penawaran'):actionLabel):(language==='ID'?`Masuk untuk ${isBuying?'menawar':'menawarkan'}`:`Sign in to ${actionLabel.toLowerCase()}`)}</button>}
        <ShareButton
          title={listingTitle ?? t('Card listing','Listing kartu')}
          path={marketListingPath(listingTitle??'Card listing',listingId)}
          cards={items.map(item => ({
            card: item.card,
            printingId: item.id,
            quantity: item.quantity,
            condition: item.condition,
            unitAmount: item.unitAmount,
          }))}
          price={formatMoney(publicListingTotal, currency)}
          subtitle={language==='ID'?`${items.reduce((acc, it) => acc + it.quantity, 0)} kartu`:`${items.reduce((acc, it) => acc + it.quantity, 0)} ${items.reduce((acc, it) => acc + it.quantity, 0) === 1 ? 'card' : 'cards'}`}
          listingInfo={listingInfo}
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
  isAdmin = false,
  canEdit = isOwner,
  initialExpired = false,
  renewDurationDays = 7,
}: {
  listing: Listing;
  stored?: (Listing & { username: string }) | null;
  listingCards: MarketListingCard[];
  primary: MarketListingCard;
  cardCount: number;
  isOwner?: boolean;
  isAdmin?: boolean;
  canEdit?: boolean;
  initialExpired?: boolean;
  renewDurationDays?: number;
}) {
  const router=useRouter();
  const [language, setLanguage] = useState<'EN' | 'ID'>('EN');
  const [listingTitle, setListingTitle] = useState(listing.title);
  const [listingAmount, setListingAmount] = useState(listing.amount);
  const [listingNegotiable, setListingNegotiable] = useState(listing.negotiable!==false);
  const [editableCards, setEditableCards] = useState(listingCards);
  const [expiresAt, setExpiresAt] = useState<string | undefined>(listing.expiresAt);
  const [status, setStatus] = useState<string>(initialExpired ? 'EXPIRED' : 'ACTIVE');
  const [renewing, setRenewing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [previewRole, setPreviewRole] = useState<'buyer'|'seller'>(listing.type==='WTB'?'buyer':'seller');

  useEffect(() => {
    const sync = () => setLanguage(window.localStorage.getItem('vivreplay-locale') === 'ID' ? 'ID' : 'EN');
    const onLocale = (event: Event) => setLanguage((event as CustomEvent<'EN' | 'ID'>).detail === 'ID' ? 'ID' : 'EN');
    sync();
    window.addEventListener('vivreplay:locale', onLocale);
    return () => window.removeEventListener('vivreplay:locale', onLocale);
  }, []);

  const t = (en: string, idStr: string) => language === 'ID' ? idStr : en;
  const isBuying = listing.type === 'WTB';
  const canPreviewAsBuyer = isOwner || isAdmin;
  const ownerRole = isBuying?'buyer':'seller';
  const counterpartyPreview = canPreviewAsBuyer&&previewRole!==ownerRole;
  const ownerView = isOwner&&previewRole===ownerRole;
  const canEditListing = canEdit && ownerView;
  const typeLabel = isBuying ? t('Buying', 'Dicari') : t('Selling', 'Dijual');
  const shippingQuoteItems=useMemo(()=>editableCards.map(item=>({printingId:item.id,quantity:item.quantity,unitAmount:item.unitAmount})),[editableCards]);

  useEffect(()=>setPreviewRole(listing.type==='WTB'?'buyer':'seller'),[listing.id,listing.type]);

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
          <ListingArtRotator items={editableCards}/>
        </aside>

        <section className="live-detail-copy market-listing-copy">
          <header className="market-listing-heading">
            <div>
              <div className="market-listing-eyebrow-row">
                <p className="eyebrow market-listing-eyebrow">
                  <span>{primary.language} {t('printing', 'cetakan')}</span>
                  {listing.createdAt && <><span className="market-listing-eyebrow-separator" aria-hidden="true">/</span><span><MarketTimestamp value={listing.createdAt}/></span></>}
                  {expiresAt && <><span className="market-listing-eyebrow-separator" aria-hidden="true">/</span><span>{isExpired?(status==='CLOSED'?t('Closed','Ditutup'):t('Expired','Kedaluwarsa')):daysLeft===null?t('Expiry date unavailable','Tanggal akhir tidak tersedia'):<>{t('Ends in','Berakhir dalam')} {daysLeft} {t('days','hari')} / <MarketTimestamp value={expiresAt} absolute/></>}</span></>}
                </p>
                {ownerView&&<><span className="market-listing-eyebrow-separator" aria-hidden="true">/</span><div className="market-listing-owner-actions">
                  <button type="button" className="btn-renew" disabled={renewing} onClick={handleRenew} aria-label={isExpired?t('Renew listing','Perbarui listing'):t('Extend listing','Perpanjang listing')}><Renew size={14}/><span>{renewing?t('Saving…','Menyimpan…'):isExpired?t('Renew','Perbarui'):t('Extend','Perpanjang')}</span></button>
                  {!isExpired&&<button type="button" className="btn-close" disabled={closing} onClick={handleClose} aria-label={t('Close listing','Tutup listing')}><X size={14}/><span>{closing?t('Closing…','Menutup…'):t('Close','Tutup')}</span></button>}
                </div></>}
              </div>
              {canEditListing?<MarketListingTitleEdit listingId={listing.id} title={listingTitle} language={language} onSaved={updated=>{setListingTitle(updated);router.replace(marketListingPath(updated,listing.id),{scroll:false})}}><h1>{listingTitle}</h1></MarketListingTitleEdit>:<div className="market-listing-title-edit-row"><h1>{listingTitle}</h1></div>}
            </div>
            <span className={`market-listing-status ${isBuying ? 'is-buying' : 'is-selling'}`}>{typeLabel}</span>
          </header>

          <dl className="market-listing-facts">
            <div>
              <dt>{t('Price', 'Harga')}</dt>
              <dd className="market-listing-price-value">{canEditListing?<MarketListingPriceEdit listingId={listing.id} title={listingTitle} listingType={listing.type==='WTB'?'WTB':'WTS'} amount={listingAmount} currency={listing.currency} cards={editableCards.map(item=>({printingId:item.id,name:item.card.name,quantity:item.quantity,unitAmount:item.unitAmount}))} language={language} onSaved={updated=>{setListingAmount(updated.amount);setEditableCards(current=>current.map((item,index)=>({...item,unitAmount:updated.prices[index]??item.unitAmount})))}}><span>{formatMoney(listingAmount, listing.currency)}</span></MarketListingPriceEdit>:<span>{formatMoney(listingAmount, listing.currency)}</span>}</dd>
            </div>
            {cardCount>1&&<div>
              <dt>{t('Cards', 'Kartu')}</dt>
              <dd>{cardCount}</dd>
            </div>}
            {listing.type==='WTS'&&<div>
              <dt>{t('Price terms','Ketentuan harga')}</dt>
              <dd>{canEditListing?<MarketListingPriceTerms listingId={listing.id} negotiable={listingNegotiable} language={language} onSaved={setListingNegotiable}/>:listingNegotiable===false?t('Firm price','Harga pas'):t('Negotiable','Bisa ditawar')}</dd>
            </div>}
            {isBuying ? <div>
              <dt>{t('Location', 'Lokasi')}</dt>
      <dd>{listing.city}{!ownerView&&<WantedListingShippingOptions listingId={listing.id} destinationCity={listing.city} items={shippingQuoteItems} language={language} previewOnly={counterpartyPreview}/>}</dd>
            </div> : ownerView ? <div>
              <dt>{t('Ships from', 'Dikirim dari')}</dt>
              <dd className="market-listing-shipping-origin"><span>{listing.city}</span><ShippingCouriers couriers={listing.shippingCouriers??[]} language={language} maxVisible={2}/></dd>
            </div> : <ShippingOptions listingId={listing.id} courierCount={listing.shippingOptionCount??0} couriers={listing.shippingCouriers??[]} items={shippingQuoteItems}/>}
          </dl>

          {!ownerView && isExpired && (
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
            <div className="market-listing-utility-actions">
              {!ownerView&&<><FeedbackLaunchButton request={{initialCategory:'market-report',listingId:listing.id,cardCode:editableCards.length===1?editableCards[0].card.code:undefined,printingId:editableCards.length===1?editableCards[0].id:undefined,cardOptions:editableCards.map(item=>({cardCode:item.card.code,printingId:item.id,label:`${item.card.name} (${item.card.code})${item.card.variant?` / ${item.card.variant}`:''} / ${item.language}`}))}} className="market-report-link" disabled={counterpartyPreview}>{t('Report listing','Laporkan listing')}</FeedbackLaunchButton><SaveListingButton listingId={listing.id} language={language} iconOnly disabled={counterpartyPreview}/></>}
              {canPreviewAsBuyer&&<div className="market-listing-view-as-toggle" role="group" aria-label={t('View listing as','Lihat listing sebagai')}><button type="button" aria-pressed={previewRole==='buyer'} onClick={()=>setPreviewRole('buyer')}>{t('Buyer','Pembeli')}</button><button type="button" aria-pressed={previewRole==='seller'} onClick={()=>setPreviewRole('seller')}>{t('Seller','Penjual')}</button></div>}
            </div>
          </div>

          {(!isExpired||ownerView)&&(
            <MarketListingItems
              items={editableCards}
              currency={listing.currency}
              listingType={listing.type === 'WTB' ? 'WTB' : 'WTS'}
              listingId={listing.id}
              sellerId={listing.sellerId}
              listingInfo={{seller:listing.seller,city:listing.city,expiresAt:listing.expiresAt??undefined}}
              listingTitle={listingTitle}
              listingAmount={formatMoney(listingAmount, listing.currency)}
              negotiable={listingNegotiable}
              readOnly={ownerView}
              previewOnly={counterpartyPreview}
              canManageListing={canEditListing}
              onItemsAdded={setEditableCards}
              canEditPrices={canEditListing&&editableCards.length>1}
              onPriceSaved={(index,unitAmount)=>{setEditableCards(current=>current.map((item,currentIndex)=>currentIndex===index?{...item,unitAmount}:item));setListingAmount(current=>current+(unitAmount-editableCards[index].unitAmount)*editableCards[index].quantity)}}
            />
          )}
        </section>
      </article>
    </main>
  );
}
