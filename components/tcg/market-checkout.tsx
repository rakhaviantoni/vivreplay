'use client';

import Link from 'next/link';
import {MarketPaymentPreview} from './market-payment-preview';
import {useRouter,useSearchParams} from 'next/navigation';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeftIcon as ArrowLeft,MapPinIcon as MapPin,MinusIcon as Minus,PlusIcon as Plus,ShieldCheckIcon as ShieldCheck,TruckIcon as Truck,XIcon as X} from '@phosphor-icons/react';
import {formatMoney,Listing} from '@/packages/domain';
import {cardFor,Card} from '@/packages/card-data/catalog';
import {api,useAccount} from '@/lib/client';
import {CardArt} from './card-art';
import {MarketBuyerFeeCapTable} from '@/components/tcg/market-buyer-fee-cap-table';
import {PhoneInput} from '@/components/tcg/phone-input';
import {MapPicker} from '@/components/tcg/map-picker';
import {toast} from 'sonner';
import {isBiteshipAreaId} from '@/lib/shipping/biteship-area';
import {loadShippingRegionOptions,type ShippingRegionOption} from '@/lib/shipping/region-options';
import {marketListingPath} from '@/lib/market/listing-url';
import {MARKET_BUYER_FEE_PERCENT,MARKET_PRO_BUYER_FEE_PERCENT,MARKET_BUYER_FEE_MINIMUM,getMarketBuyerFeeCap,calculateBuyerServiceFee,MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,MARKET_PRO_SHIPPING_VOUCHER_SHARE,MARKET_PRO_SHIPPING_VOUCHER_CAP} from '@/lib/market/policy';

type Origin={addressLine:string;city:string;postalCode:string;areaId:string|null;recipientName:string|null;phone:string|null;latitude?:number|null;longitude?:number|null;regionNames?:{province?:string;city?:string;district?:string;subdistrict?:string}};
type Rate={courier_name:string;courier_service_name:string;courier_code:string;courier_service_code:string;company:string;type:string;price:number;duration?:string};
type CheckoutLine={printingId:string;quantity:number;unitAmount?:number};
type CartLine={listingId:string;listingTitle:string;items:CheckoutLine[]};

export function MarketCheckout(){
  const params=useSearchParams();
  const router=useRouter();
  const {data:account,loading:accountLoading,error:accountError}=useAccount();
  const cartMode=params.get('cart')==='1';
  const requestedListingsParam=params.get('listings')??'';
  const hasLegacyListingParam=params.has('listings');
  const [storedCartSelection,setStoredCartSelection]=useState<string[]|null>(null);
  const [cartSelectionReady,setCartSelectionReady]=useState(!cartMode);
  const hasRequestedListings=hasLegacyListingParam||Boolean(storedCartSelection?.length);
  const requestedListingIds=useMemo(()=>{const raw=hasLegacyListingParam?requestedListingsParam:(storedCartSelection??[]).join(',');return [...new Set(raw.split(',').filter(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))]},[hasLegacyListingParam,requestedListingsParam,storedCartSelection]);
  const [cartLines,setCartLines]=useState<CartLine[]>([]);const [cartReady,setCartReady]=useState(!cartMode);
  const activeCartLines=useMemo(()=>cartMode&&hasRequestedListings?cartLines.filter(line=>requestedListingIds.includes(line.listingId)):cartLines,[cartMode,hasRequestedListings,cartLines,requestedListingIds]);
  const listingId=params.get('listing')??cartLines[0]?.listingId??'';
  const offerId=params.get('offer')??'';
  const rawItems=params.get('items')??'';
  const items=useMemo<CheckoutLine[]>(()=>{try{const parsed=JSON.parse(rawItems) as CheckoutLine[];return Array.isArray(parsed)?parsed:[]}catch{return []}},[rawItems]);
  const [listing,setListing]=useState<Listing>();
  const [cartListings,setCartListings]=useState<Listing[]>([]);
  const orderListingId=cartMode?cartListings[0]?.id??'':listingId;
  const [origin,setOrigin]=useState<Origin>();
  const [rates,setRates]=useState<Rate[]>([]);
  const [selectedRate,setSelectedRate]=useState('');
  const [loading,setLoading]=useState(true);
  const [checkoutAvailable,setCheckoutAvailable]=useState(false);
  const [buyerTier,setBuyerTier]=useState<'free'|'pro'>('free');
  const [buyerFeeMinimum,setBuyerFeeMinimum]=useState(MARKET_BUYER_FEE_MINIMUM);
  const [voucherMinimum,setVoucherMinimum]=useState(MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL);
  const [shippingVouchersRemaining,setShippingVouchersRemaining]=useState(0);
  const [useShippingVoucher,setUseShippingVoucher]=useState(true);
  const [quoting,setQuoting]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  const [quoteError,setQuoteError]=useState('');
  const [detailsError,setDetailsError]=useState('');
  const [contactName,setContactName]=useState('');
  const [contactPhone,setContactPhone]=useState('');
  const [savingContact,setSavingContact]=useState(false);
  const [editingContact,setEditingContact]=useState(false);
  const [editingAddress,setEditingAddress]=useState(false);
  const [addressDraft,setAddressDraft]=useState({recipientName:'',phone:'',addressLine:'',city:'',postalCode:'',province:'',district:'',subdistrict:''});
  const [addressProvinces,setAddressProvinces]=useState<ShippingRegionOption[]>([]);
  const [addressCities,setAddressCities]=useState<ShippingRegionOption[]>([]);
  const [addressDistricts,setAddressDistricts]=useState<ShippingRegionOption[]>([]);
  const [addressSubdistricts,setAddressSubdistricts]=useState<ShippingRegionOption[]>([]);
  const [addressRegionLoading,setAddressRegionLoading]=useState({provinces:false,cities:false,districts:false,subdistricts:false});
  const [addressLatitude,setAddressLatitude]=useState<number|null>(null);
  const [addressLongitude,setAddressLongitude]=useState<number|null>(null);
  const [savingAddress,setSavingAddress]=useState(false);
  const autoQuoteKey=useRef('');
  const quoteRequest=useRef<AbortController|null>(null);

  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  const id=locale==='ID';
  const t=(en:string,idText:string)=>id?idText:en;
  const addressReady=Boolean(origin&&origin.addressLine.trim()&&origin.city.trim()&&/^\d{5}$/.test(origin.postalCode));

  useEffect(()=>{const sync=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');sync();window.addEventListener('vivreplay:locale',onLocale);return()=>window.removeEventListener('vivreplay:locale',onLocale)},[]);
  useEffect(()=>{if(!cartMode){setCartSelectionReady(true);return}try{const raw=window.sessionStorage.getItem('vivreplay-market-checkout-listings-v1');const parsed=raw?JSON.parse(raw) as unknown:[];setStoredCartSelection(Array.isArray(parsed)?[...new Set(parsed.filter((id):id is string=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))].slice(0,10):[])}catch{setStoredCartSelection([])}finally{setCartSelectionReady(true)}},[cartMode]);
  useEffect(()=>{if(!cartMode||!hasLegacyListingParam)return;const ids=[...new Set(requestedListingsParam.split(',').filter(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))];if(!ids.length||ids.length>10||ids.length!==requestedListingsParam.split(',').length)return;try{window.sessionStorage.setItem('vivreplay-market-checkout-listings-v1',JSON.stringify(ids))}catch{}setStoredCartSelection(ids);router.replace('/checkout/market?cart=1')},[cartMode,hasLegacyListingParam,requestedListingsParam,router]);
  useEffect(()=>{if(!cartMode)return;try{const cart=JSON.parse(window.localStorage.getItem('vivreplay-market-cart-v1')||'null');const lines=Array.isArray(cart?.lines)?cart.lines.filter((line:CartLine)=>typeof line?.listingId==='string'&&Array.isArray(line.items)&&line.items.length).map((line:CartLine)=>({listingId:line.listingId,listingTitle:typeof line.listingTitle==='string'?line.listingTitle:'',items:line.items.filter(item=>typeof item?.printingId==='string'&&Number.isInteger(item.quantity)&&item.quantity>0).map(item=>({printingId:item.printingId,quantity:item.quantity,unitAmount:item.unitAmount}))})):[];setCartLines(lines);window.localStorage.setItem('vivreplay-market-cart-v1',JSON.stringify({lines}))}catch{setCartLines([])}finally{setCartReady(true)}},[cartMode]);
  useEffect(()=>{
    if(accountLoading||(cartMode&&(!cartReady||!cartSelectionReady)))return;
    if(cartMode&&hasLegacyListingParam&&(requestedListingIds.length>10||requestedListingIds.length!==requestedListingsParam.split(',').length)){setDetailsError(t('The selected cart items are invalid. Return to your cart and choose again.','Item keranjang yang dipilih tidak valid. Kembali ke keranjang dan pilih lagi.'));setLoading(false);return;}
    if(!account){setLoading(false);return;}
    setLoading(true);setDetailsError('');
    let active=true;
    const selectedCartLines=cartMode?activeCartLines:[];
    const listingsRequest=cartMode&&!selectedCartLines.length?Promise.resolve({listings:[] as Listing[]}):api<{listings:Listing[]}>(cartMode?`/api/listings?ids=${encodeURIComponent(selectedCartLines.map(line=>line.listingId).join(','))}`:'/api/listings',undefined,'GET');
    Promise.all([
      listingsRequest,
      api<{origin:Origin|null}>('/api/shipping/origin',undefined,'GET'),
      api<{available:boolean;sandbox?:boolean;buyerTier?:'free'|'pro';buyerFeeMinimum?:number;shippingVoucherMinSubtotal?:number;shippingVouchersRemaining?:number}>('/api/checkout/market',undefined,'GET'),
    ]).then(([market,shipping,checkout])=>{
      if(!active)return;
      const checkoutLines=selectedCartLines;
      if(cartMode&&requestedListingIds.length&&checkoutLines.length!==requestedListingIds.length)throw new Error(t('The selected cart items are unavailable. Return to your cart and choose again.','Item keranjang yang dipilih tidak tersedia. Kembali ke keranjang dan pilih lagi.'));
      const selectedListings=cartMode?checkoutLines.map(line=>market.listings.find(row=>row.id===line.listingId)).filter((row):row is Listing=>Boolean(row)):[market.listings.find(row=>row.id===listingId)].filter((row):row is Listing=>Boolean(row));
      if(cartMode&&selectedListings.length!==checkoutLines.length)throw new Error(t('A listing in your cart is no longer available. Return to your cart and remove it.','Salah satu listing di keranjang sudah tidak tersedia. Kembali ke keranjang dan hapus listing tersebut.'));setCartListings(selectedListings);setListing(selectedListings[0]);
      setOrigin(shipping.origin??undefined);
      setCheckoutAvailable(checkout.available);
      setBuyerTier(checkout.buyerTier==='pro'?'pro':'free');
      setBuyerFeeMinimum(checkout.buyerFeeMinimum??MARKET_BUYER_FEE_MINIMUM);
      setVoucherMinimum(checkout.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL);
      setShippingVouchersRemaining(checkout.shippingVouchersRemaining??0);
    }).catch(cause=>{if(active)setDetailsError(cause instanceof Error?cause.message:'Checkout details could not load.')}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[account?.profile.id,accountLoading,listingId,cartMode,cartReady,cartSelectionReady,activeCartLines,requestedListingIds,hasRequestedListings,hasLegacyListingParam,requestedListingsParam,locale]);

  const selectedCards=useMemo(()=>{
    const sourceLines=cartMode?activeCartLines.map(line=>({listing:cartListings.find(row=>row.id===line.listingId),items:line.items})).filter(line=>line.listing):[{listing,items}];
    return sourceLines.flatMap(({listing:source,items:sourceItems})=>sourceItems.map(selected=>{
      const cardItems=source?.items??[];
      const item=cardItems.find(entry=>entry.printingId===selected.printingId);
      const card=(source?.printingId===selected.printingId?source.card:item?.card??cardFor(selected.printingId)) as Card|undefined;
      const bundleQuantity=cardItems.reduce((total,entry)=>total+entry.quantity,0)||source?.quantity||1;
      const fallbackUnitAmount=source?Math.max(1,Math.floor(source.amount/bundleQuantity)):0;
      return {listingId:source?.id,listingTitle:source?.title,printingId:selected.printingId,quantity:selected.quantity,card,unitAmount:selected.unitAmount&&selected.unitAmount>0?selected.unitAmount:item?.unitAmount&&item.unitAmount>0?item.unitAmount:fallbackUnitAmount,condition:item?.condition??source?.condition??'NM'};
    }));
  },[items,listing,cartMode,activeCartLines,cartListings]);
  const checkoutGroups=useMemo(()=>{
    const groups=new Map<string,{id:string;title:string;items:typeof selectedCards}>();
    for(const item of selectedCards){const key=item.listingId??listing?.id??'listing';const group=groups.get(key)??{id:key,title:item.listingTitle??listing?.title??'',items:[]};group.items.push(item);groups.set(key,group)}
    return [...groups.values()];
  },[selectedCards,listing?.id,listing?.title]);
  const subtotal=selectedCards.reduce((sum,item)=>sum+item.unitAmount*item.quantity,0);
  const buyerServiceFeePercent=buyerTier==='pro'?MARKET_PRO_BUYER_FEE_PERCENT:MARKET_BUYER_FEE_PERCENT;
  const buyerServiceFee=calculateBuyerServiceFee(subtotal,buyerServiceFeePercent,buyerFeeMinimum);
  const buyerFeeCap=getMarketBuyerFeeCap(subtotal);
  const buyerFeeLabel=t(`Market service fee (${buyerServiceFeePercent}%)`,`Biaya layanan Market (${buyerServiceFeePercent.toLocaleString('id-ID')}%)`);
  const currentRate=rates.find(rate=>`${rate.courier_code}:${rate.courier_service_code}`===selectedRate);
  const voucherEligible=buyerTier==='pro'&&shippingVouchersRemaining>0&&subtotal>=voucherMinimum;
  const shippingDiscount=voucherEligible&&useShippingVoucher&&currentRate?Math.min(Math.round(currentRate.price*MARKET_PRO_SHIPPING_VOUCHER_SHARE),MARKET_PRO_SHIPPING_VOUCHER_CAP):0;
  const courierName=(name:string)=>({jne:'JNE Express',jnt:'J&T Express',sicepat:'SiCepat Ekspres',anteraja:'Anteraja',tiki:'TIKI',pos:'Pos Indonesia',lion:'Lion Parcel',ninja:'Ninja Xpress',wahana:'Wahana Express',grab:'GrabExpress',gojek:'GoSend'}[name]??name);

  const loadQuotes=useCallback(async(forceRefresh=false)=>{
    if(!listing||!orderListingId||!origin||(!/^\d{5}$/.test(origin.postalCode)&&!isBiteshipAreaId(origin.areaId))||!selectedCards.length){setQuoteError(t('Choose a valid listing and delivery address first.','Pilih listing dan alamat pengiriman yang valid.'));return}
    quoteRequest.current?.abort();
    const controller=new AbortController();quoteRequest.current=controller;
    setQuoting(true);setQuoteError('');setRates([]);setSelectedRate('');
    try{
      const response=await fetch('/api/shipping/quotes',{signal:controller.signal,method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listingId:orderListingId,lines:cartMode?activeCartLines.map(line=>({listingId:line.listingId,items:line.items})):undefined,items,destinationAreaId:origin.areaId,destinationPostalCode:origin.postalCode,refresh:forceRefresh})});
      const result=await response.json() as {pricing?:Rate[];error?:string};
      if(controller.signal.aborted)return;
      if(!response.ok)throw new Error(result.error??t('Shipping rates could not be loaded.','Ongkir tidak dapat dimuat.'));
      const options=result.pricing??[];setRates(options);if(options[0])setSelectedRate(`${options[0].courier_code}:${options[0].courier_service_code}`);
      if(!options.length)throw new Error(t('No delivery services are available for this address. Update the address or ask the seller for help.','Tidak ada layanan pengiriman untuk alamat ini. Perbarui alamat atau hubungi penjual.'));
    }catch(cause){if(!controller.signal.aborted)setQuoteError(cause instanceof Error?cause.message:t('Shipping rates could not be loaded.','Ongkir tidak dapat dimuat.'))}finally{if(quoteRequest.current===controller){setQuoting(false);quoteRequest.current=null;}}
  },[listing,origin,items,selectedCards,orderListingId,locale,cartMode,activeCartLines]);

  useEffect(()=>{
    if(!listing||!origin||!addressReady||!selectedCards.length)return;
    const key=JSON.stringify({buyer:account?.profile.id,listingId:orderListingId,items:selectedCards.map(item=>[item.listingId,item.printingId,item.quantity]),postal:origin.postalCode,area:origin.areaId,latitude:origin.latitude,longitude:origin.longitude});
    if(autoQuoteKey.current!==key){autoQuoteKey.current=key;void loadQuotes();}
  },[account?.profile.id,listing,origin,addressReady,items,selectedCards,orderListingId,loadQuotes]);
  useEffect(()=>()=>{quoteRequest.current?.abort();},[]);
  useEffect(()=>{setContactName(origin?.recipientName||account?.profile.display_name||'');setContactPhone(origin?.phone||'');},[origin?.recipientName,origin?.phone,account?.profile.display_name]);
  useEffect(()=>{if(editingAddress||!addressReady){setAddressDraft({recipientName:origin?.recipientName||account?.profile.display_name||'',phone:origin?.phone||account?.profile.phone||'',addressLine:origin?.addressLine||'',city:origin?.regionNames?.city||origin?.city||'',postalCode:origin?.postalCode||'',province:origin?.regionNames?.province||'',district:origin?.regionNames?.district||'',subdistrict:origin?.regionNames?.subdistrict||''});setAddressLatitude(origin?.latitude??null);setAddressLongitude(origin?.longitude??null)}},[editingAddress,addressReady,origin,account?.profile.display_name,account?.profile.phone]);
  useEffect(()=>{let active=true;setAddressRegionLoading(current=>({...current,provinces:true}));void loadShippingRegionOptions('provinces',undefined,{}).then(options=>{if(active)setAddressProvinces(options)}).finally(()=>{if(active)setAddressRegionLoading(current=>({...current,provinces:false}))});return()=>{active=false}},[]);
  useEffect(()=>{if(!addressDraft.province){setAddressCities([]);return}let active=true;setAddressRegionLoading(current=>({...current,cities:true}));const parent=addressProvinces.find(item=>item.name===addressDraft.province)?.id;void loadShippingRegionOptions('regencies',parent,{province:addressDraft.province}).then(options=>{if(active)setAddressCities(options)}).finally(()=>{if(active)setAddressRegionLoading(current=>({...current,cities:false}))});return()=>{active=false}},[addressDraft.province,addressProvinces]);
  useEffect(()=>{if(!addressDraft.city){setAddressDistricts([]);return}let active=true;setAddressRegionLoading(current=>({...current,districts:true}));const parent=addressCities.find(item=>item.name===addressDraft.city)?.id;void loadShippingRegionOptions('districts',parent,{province:addressDraft.province,city:addressDraft.city}).then(options=>{if(active)setAddressDistricts(options)}).finally(()=>{if(active)setAddressRegionLoading(current=>({...current,districts:false}))});return()=>{active=false}},[addressDraft.province,addressDraft.city,addressCities]);
  useEffect(()=>{if(!addressDraft.district){setAddressSubdistricts([]);return}let active=true;setAddressRegionLoading(current=>({...current,subdistricts:true}));const parent=addressDistricts.find(item=>item.name===addressDraft.district)?.id;void loadShippingRegionOptions('villages',parent,{province:addressDraft.province,city:addressDraft.city,district:addressDraft.district}).then(options=>{if(active)setAddressSubdistricts(options)}).finally(()=>{if(active)setAddressRegionLoading(current=>({...current,subdistricts:false}))});return()=>{active=false}},[addressDraft.province,addressDraft.city,addressDraft.district,addressDistricts]);
  const saveAddress=async(event:React.FormEvent)=>{
    event.preventDefault();setSavingAddress(true);setError('');setQuoteError('');
    try{
      const samePostal=origin?.postalCode===addressDraft.postalCode;
      await api('/api/shipping/origin',{recipientName:addressDraft.recipientName,phone:addressDraft.phone,addressLine:addressDraft.addressLine,city:addressDraft.city,postalCode:addressDraft.postalCode,areaId:samePostal?origin.areaId:null,latitude:addressLatitude,longitude:addressLongitude,regions:{province:addressDraft.province,city:addressDraft.city,district:addressDraft.district,subdistrict:addressDraft.subdistrict},shippingMethods:(origin as (Origin&{shippingMethods?:string[]})|undefined)?.shippingMethods},'POST');
      setOrigin({addressLine:addressDraft.addressLine,city:addressDraft.city,postalCode:addressDraft.postalCode,areaId:samePostal?origin.areaId:null,latitude:addressLatitude,longitude:addressLongitude,recipientName:addressDraft.recipientName,phone:addressDraft.phone,regionNames:{province:addressDraft.province,city:addressDraft.city,district:addressDraft.district,subdistrict:addressDraft.subdistrict}});
      setEditingAddress(false);setEditingContact(false);setRates([]);setSelectedRate('');autoQuoteKey.current='';toast.success(t('Delivery address saved','Alamat pengiriman disimpan'));
    }catch(cause){setError(cause instanceof Error?cause.message:t('Could not save the delivery address. Check the fields and try again.','Alamat pengiriman gagal disimpan. Periksa kembali isian Anda.'))}
    finally{setSavingAddress(false)}
  };
  const contactDigits=(origin?.phone??'').replace(/\D/g,'');
  const contactComplete=Boolean(contactDigits.length>=8&&contactDigits.length<=16&&(origin?.recipientName?.trim()||account?.profile.display_name));
  const saveContact=async(event:React.FormEvent)=>{
    event.preventDefault();setSavingContact(true);setError('');
    try{const saved=await api<{recipientName:string;phone:string}>('/api/shipping/origin',{recipientName:contactName,phone:contactPhone},'PATCH');setOrigin(current=>current?{...current,recipientName:saved.recipientName,phone:saved.phone}:current);setEditingContact(false);toast.success(t('Delivery contact saved','Kontak pengiriman disimpan'));}
    catch{setError(t('The delivery contact could not be saved. Check the name and phone number.','Kontak pengiriman gagal disimpan. Periksa nama dan nomor telepon.'));}
    finally{setSavingContact(false);}
  };
  const onAddressMapChange=useCallback((coords:{lat:number;lng:number})=>{setAddressLatitude(coords.lat);setAddressLongitude(coords.lng)},[]);
  const chooseDelivery=()=>{if(editingAddress||!addressReady){setEditingAddress(true);document.querySelector('.checkout-address-editor')?.scrollIntoView({behavior:'smooth',block:'start'});return}const panel=document.getElementById('checkout-delivery-services');panel?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});panel?.focus({preventScroll:true});};
  const updateCartQuantity=(sourceListingId:string,printingId:string,quantity:number)=>{const source=cartListings.find(row=>row.id===sourceListingId);const cap=source?.items?.filter(item=>item.printingId===printingId).reduce((total,item)=>total+item.quantity,0)??99;quantity=Math.min(99,cap,quantity);const next=cartLines.map(line=>line.listingId===sourceListingId?{...line,items:line.items.map(item=>item.printingId===printingId?{...item,quantity}:item).filter(item=>item.quantity>0)}:line).filter(line=>line.items.length>0);setCartLines(next);let storedLines:CartLine[]=[];try{const stored=JSON.parse(window.localStorage.getItem('vivreplay-market-cart-v1')||'{"lines":[]}') as {lines?:CartLine[]};storedLines=Array.isArray(stored.lines)?stored.lines:[]}catch{}const selectedIds=new Set(cartLines.map(line=>line.listingId));const selectedById=new Map(next.map(line=>[line.listingId,line]));const allLines=storedLines.flatMap(line=>{if(!selectedIds.has(line.listingId))return[line];const updated=selectedById.get(line.listingId);return updated?[updated]:[]});window.localStorage.setItem('vivreplay-market-cart-v1',JSON.stringify({lines:allLines}));window.dispatchEvent(new Event('vivreplay:market-cart-updated'));autoQuoteKey.current='';};

  const startCheckout=async()=>{
    if(!currentRate)return;
    setSubmitting(true);setError('');
    try{
      const response=await fetch('/api/checkout/market',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listingId:orderListingId,offerId:offerId||undefined,items:cartMode?selectedCards.map(item=>({printingId:item.printingId,quantity:item.quantity,listingId:item.listingId})):items,lines:cartMode?activeCartLines.map(line=>({listingId:line.listingId,items:line.items})):undefined,courierName:currentRate.courier_name,courierServiceName:currentRate.courier_service_name,courierCode:currentRate.courier_code,courierServiceCode:currentRate.courier_service_code,courierType:currentRate.type,shippingFee:currentRate.price,useShippingVoucher})});
      const result=await response.json() as {checkoutUrl?:string;error?:string};
      if(response.status===409&&result.error?.includes('delivery fee changed')){await loadQuotes(true);throw new Error(t('Delivery fees changed. Review the updated options before paying.','Ongkir berubah. Periksa opsi terbaru sebelum membayar.'));}
      if(!response.ok||!result.checkoutUrl)throw new Error(result.error??t('Checkout could not be started.','Checkout tidak dapat dimulai.'));
      if(cartMode){const stored=JSON.parse(window.localStorage.getItem('vivreplay-market-cart-v1')||'{"lines":[]}') as {lines?:CartLine[]};const completedIds=new Set(activeCartLines.map(line=>line.listingId));const remaining=(stored.lines??[]).filter(line=>!completedIds.has(line.listingId));window.localStorage.setItem('vivreplay-market-cart-v1',JSON.stringify({lines:remaining}));window.sessionStorage.removeItem('vivreplay-market-checkout-listings-v1');window.dispatchEvent(new Event('vivreplay:market-cart-updated'));}
      router.push(result.checkoutUrl);
    }catch(cause){const message=cause instanceof Error?cause.message:t('Checkout could not be started.','Checkout tidak dapat dimulai.');setError(message);toast.error(message);setSubmitting(false)}
  };

  if(loading||accountLoading||(cartMode&&!cartReady))return <main className="page vivre-checkout-page"><div className="checkout-loading"><i/><span>{t('Loading your checkout…','Memuat checkout…')}</span></div></main>;
  if(detailsError||accountError)return <main className="page vivre-checkout-page"><section className="checkout-message"><h1>{t('Checkout could not load','Checkout gagal dimuat')}</h1><p>{detailsError||t('Please refresh to load the listing and delivery address.','Muat ulang untuk memuat listing dan alamat pengiriman.')}</p><div className="checkout-error-actions"><button className="button" onClick={()=>window.location.reload()}>{t('Retry','Coba lagi')}</button>{cartMode&&<button className="button secondary" onClick={()=>{if(!window.confirm(t('Remove all items from your cart?','Kosongkan semua isi keranjang?')))return;window.localStorage.removeItem('vivreplay-market-cart-v1');window.dispatchEvent(new Event('vivreplay:market-cart-updated'));router.replace('/market')}}>{t('Clear cart','Kosongkan keranjang')}</button>}</div></section></main>;
  if(!account)return <main className="page vivre-checkout-page"><section className="checkout-message checkout-auth-message"><ShieldCheck size={24}/><div className="checkout-message-content"><h1>{t('Sign in to check out','Masuk untuk checkout')}</h1><p>{t('Your delivery address and order are tied to your VivrePlay account.','Alamat pengiriman dan pesanan terhubung dengan akun VivrePlay Anda.')}</p><button className="button" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}>{t('Sign in','Masuk')}</button></div></section></main>;
  if(!listing||!selectedCards.length)return <main className="page vivre-checkout-page"><section className="checkout-message"><h1>{cartMode?t('Your cart is empty','Keranjang Anda kosong'):t('Listing unavailable','Listing tidak tersedia')}</h1><p>{cartMode?t('Browse listings to add cards.','Lihat listing untuk menambahkan kartu.'):t('Browse Market for other listings.','Cari listing lain di Market.')}</p><Link className="button" href="/market"><ArrowLeft size={16}/>{t('Back to Market','Kembali ke Market')}</Link></section></main>;

  return <main className="page vivre-checkout-page">
    <Link href={cartMode?'/market':marketListingPath('',listingId)} className="back-link"><ArrowLeft size={16}/>{cartMode?t('Back to Market','Kembali ke Market'):t('Back to listing','Kembali ke listing')}</Link>
    <header className="checkout-page-heading"><div><h1>{t('Review your order','Periksa pesanan')}</h1><p>{t('Check the cards, delivery address, and total before paying.','Periksa kartu, alamat pengiriman, dan total sebelum membayar.')}</p></div></header>
    <div className="checkout-layout">
      <section className="checkout-panel checkout-order-summary"><h2>{cartMode?t(`${activeCartLines.length} ${activeCartLines.length===1?'listing':'listings'}`,`${activeCartLines.length} listing`):listing.title}</h2><p className="checkout-seller"><strong>{listing.seller}</strong><span>{listing.city}</span></p>
        <div className="checkout-items">{checkoutGroups.map(group=>{
          const sourceListing=cartListings.find(row=>row.id===group.id)??listing;
          const artworkItems=sourceListing?.items?.length?sourceListing.items.map(item=>({card:item.card??(item.printingId===sourceListing.printingId?sourceListing.card:undefined),quantity:item.quantity,printingId:item.printingId})).filter(item=>item.card):sourceListing?.card?[{card:sourceListing.card,quantity:sourceListing.quantity,printingId:sourceListing.printingId}]:[];
          const groupCount=artworkItems.reduce((total,item)=>total+item.quantity,0);
          const stack=artworkItems.flatMap(item=>Array.from({length:Math.max(1,Math.min(3,item.quantity))},(_,copy)=>({card:item.card!,key:`${item.printingId}-${copy}`}))).slice(0,3);
          return <section className="checkout-listing-group" key={group.id}>
            <header className="checkout-listing-group-heading">
              <div className={`market-feed-stack checkout-card-stack${groupCount===1?' is-single':''}`} style={{'--stack-last-index':Math.max(0,stack.length-1)} as React.CSSProperties}>
                {stack.map(({card,key},index)=><div key={key} className="market-feed-art" style={{'--stack-index':index} as React.CSSProperties}><CardArt card={card}/></div>)}
                {groupCount>1&&<span aria-label={`${groupCount} ${id?'kartu':'cards'}`}>{groupCount}</span>}
              </div>
              <strong>{group.title}</strong>
            </header>
            {group.items.map(item=><div className="checkout-item-row" key={`${item.listingId}-${item.printingId}`}><div className="checkout-item-copy"><strong>{item.card?.name||item.listingTitle||listing.title}</strong><small><span>{item.card?.code||item.card?.printingCode||item.printingId}</span>{item.card?.language&&<span>{item.card.language}</span>}{item.card?.variant&&<span>{item.card.variant}</span>}{item.card?.setCode&&<span>{item.card.setCode}</span>}<span>{item.condition}</span></small>{cartMode&&<div className="checkout-cart-quantity"><button type="button" aria-label={t('Remove one','Kurangi satu')} disabled={item.quantity<=1} onClick={()=>updateCartQuantity(item.listingId!,item.printingId,item.quantity-1)}><Minus size={14}/></button><b>{item.quantity}</b><button type="button" aria-label={t('Add one','Tambah satu')} onClick={()=>updateCartQuantity(item.listingId!,item.printingId,item.quantity+1)}><Plus size={14}/></button><button type="button" className="checkout-cart-remove" onClick={()=>updateCartQuantity(item.listingId!,item.printingId,0)}><X size={13}/>{t('Remove','Hapus')}</button></div>}</div><b>{formatMoney(item.unitAmount*item.quantity,listing.currency)}</b></div>)}
          </section>;
        })}</div>
        <dl className="checkout-totals"><div><dt>{t('Cards','Kartu')}</dt><dd>{formatMoney(subtotal,listing.currency)}</dd></div><div><dt>{t('Delivery','Pengiriman')}</dt><dd><button type="button" className="checkout-delivery-action" aria-controls={addressReady&&!editingAddress?'checkout-delivery-services':undefined} onClick={chooseDelivery}>{currentRate&&addressReady&&!editingAddress?`${formatMoney(currentRate.price,listing.currency)} - ${t('Change','Ubah')}`:quoting?t('Loading rates…','Memuat ongkir…'):addressReady&&!editingAddress?t('Choose a service','Pilih layanan'):editingAddress?t('Save delivery address','Simpan alamat pengiriman'):t('Add delivery address','Tambahkan alamat pengiriman')}</button></dd></div>{voucherEligible&&addressReady&&!editingAddress&&currentRate&&<div className="checkout-pro-voucher-choice"><dt><label><input type="checkbox" checked={useShippingVoucher} onChange={event=>setUseShippingVoucher(event.target.checked)}/><span>{t('Use a Pro delivery voucher','Gunakan voucher ongkir Pro')}<small>{t(`${shippingVouchersRemaining} left this month - 50% off, up to ${formatMoney(MARKET_PRO_SHIPPING_VOUCHER_CAP,'IDR')}`,`${shippingVouchersRemaining} tersisa bulan ini - diskon 50%, maksimal ${formatMoney(MARKET_PRO_SHIPPING_VOUCHER_CAP,'IDR')}`)}</small></span></label></dt><dd>{shippingDiscount>0?`−${formatMoney(shippingDiscount,listing.currency)}`:formatMoney(0,listing.currency)}</dd></div>}<div><dt>{buyerFeeLabel}</dt><dd>{formatMoney(buyerServiceFee,listing.currency)}</dd></div><div className="checkout-grand-total"><dt>{t('Total','Total')}</dt><dd>{formatMoney(subtotal+(currentRate?.price??0)-shippingDiscount+buyerServiceFee,listing.currency)}</dd></div></dl>
        <details className="checkout-fee-details"><summary>{t('How the buyer fee is calculated','Cara menghitung biaya pembeli')}</summary><p>{t(`The fee is ${buyerServiceFeePercent}% of the card subtotal, with a ${formatMoney(buyerFeeMinimum,'IDR')} minimum and a ${formatMoney(buyerFeeCap,'IDR')} cap for this subtotal.`,`Biaya sebesar ${buyerServiceFeePercent}% dari subtotal kartu, minimal ${formatMoney(buyerFeeMinimum,'IDR')} dan maksimal ${formatMoney(buyerFeeCap,'IDR')} untuk subtotal ini.`)}</p><MarketBuyerFeeCapTable locale={locale==='ID'?'id':'en'} minimumFee={buyerFeeMinimum} className="checkout-fee-cap-table"/></details>
      </section>
      <section className="checkout-panel checkout-delivery-panel"><div className="checkout-section-title"><MapPin size={18}/><div><h2>{t('Delivery address','Alamat pengiriman')}</h2></div></div>
        {origin&&addressReady&&!editingAddress?<div className="checkout-address-card"><strong>{origin.recipientName||account.profile?.display_name}{origin.phone&&` - ${origin.phone}`}</strong><p>{origin.addressLine}<br/>{origin.regionNames?.subdistrict?`${origin.regionNames.subdistrict}, `:''}{origin.regionNames?.district?`${origin.regionNames.district}, `:''}{origin.city} {origin.postalCode}</p><button type="button" className="checkout-inline-link" onClick={()=>setEditingAddress(true)}>{t('Edit delivery details','Ubah detail pengiriman')}</button>
          {(!contactComplete||editingContact)&&<form className="checkout-contact-form form-stack" onSubmit={saveContact}><h3>{t('Delivery contact','Kontak pengiriman')}</h3><div className="form-row"><label>{t('Recipient name','Nama penerima')}<input required minLength={2} maxLength={100} autoComplete="name" value={contactName} onChange={event=>setContactName(event.target.value)}/></label><PhoneInput required label={t('Phone number','Nomor telepon')} autoComplete="tel" value={contactPhone} onChange={setContactPhone} locale={id?'ID':'EN'}/></div><button type="submit" className="button secondary" disabled={savingContact}>{savingContact?t('Saving…','Menyimpan…'):t('Save delivery contact','Simpan kontak pengiriman')}</button></form>}
        </div>:null}
        {editingAddress||!addressReady?<form className="checkout-address-editor" onSubmit={event=>void saveAddress(event)}>
          <div className="checkout-address-editor-heading"><strong>{t('Delivery details','Detail pengiriman')}</strong>{origin&&<button type="button" className="checkout-inline-link" onClick={()=>setEditingAddress(false)}>{t('Cancel','Batal')}</button>}</div>
          <div className="checkout-address-fields">
            <label>{t('Recipient','Penerima')}<input autoComplete="name" required minLength={2} maxLength={100} value={addressDraft.recipientName} onChange={event=>setAddressDraft({...addressDraft,recipientName:event.target.value})}/></label>
            <PhoneInput required label={t('Phone','Nomor telepon')} autoComplete="tel" value={addressDraft.phone} onChange={phone=>setAddressDraft({...addressDraft,phone})} locale={id?'ID':'EN'}/>
            <label className="checkout-address-wide">{t('Street, building, unit, or house number','Jalan, gedung, nomor unit atau rumah')}<textarea autoComplete="street-address" required minLength={5} maxLength={260} rows={3} value={addressDraft.addressLine} onChange={event=>setAddressDraft({...addressDraft,addressLine:event.target.value})}/></label>
            <label>{t('Province','Provinsi')}<select required value={addressDraft.province} onChange={event=>{const province=event.target.value;const selected=addressProvinces.find(option=>option.name===province);setAddressDraft({...addressDraft,province,city:'',district:'',subdistrict:'',postalCode:''});setAddressLatitude(selected?.latitude??null);setAddressLongitude(selected?.longitude??null)}}><option value="">{addressRegionLoading.provinces?t('Loading provinces…','Memuat provinsi…'):t('Select province','Pilih provinsi')}</option>{addressProvinces.map(option=><option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
            <label>{t('City / Regency','Kota / Kabupaten')}<select required disabled={!addressDraft.province||addressRegionLoading.cities} value={addressDraft.city} onChange={event=>{const city=event.target.value;const selected=addressCities.find(option=>option.name===city);setAddressDraft({...addressDraft,city,district:'',subdistrict:'',postalCode:''});setAddressLatitude(selected?.latitude??addressLatitude);setAddressLongitude(selected?.longitude??addressLongitude)}}><option value="">{addressRegionLoading.cities?t('Loading cities…','Memuat kota…'):t('Select city / regency','Pilih kota / kabupaten')}</option>{addressCities.map(option=><option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
            <label>{t('District','Kecamatan')}<select disabled={!addressDraft.city||addressRegionLoading.districts} value={addressDraft.district} onChange={event=>{const district=event.target.value;const selected=addressDistricts.find(option=>option.name===district);setAddressDraft({...addressDraft,district,subdistrict:'',postalCode:''});if(selected?.latitude!=null)setAddressLatitude(selected.latitude);if(selected?.longitude!=null)setAddressLongitude(selected.longitude)}}><option value="">{addressRegionLoading.districts?t('Loading districts…','Memuat kecamatan…'):t('Select district (optional)','Pilih kecamatan (opsional)')}</option>{addressDistricts.map(option=><option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
            <label>{t('Sub-district','Kelurahan / Desa')}<select disabled={!addressDraft.district||addressRegionLoading.subdistricts} value={addressDraft.subdistrict} onChange={event=>{const subdistrict=event.target.value;const selected=addressSubdistricts.find(option=>option.name===subdistrict);setAddressDraft({...addressDraft,subdistrict,postalCode:selected?.postalCode?String(selected.postalCode):addressDraft.postalCode});if(selected?.latitude!=null)setAddressLatitude(selected.latitude);if(selected?.longitude!=null)setAddressLongitude(selected.longitude)}}><option value="">{addressRegionLoading.subdistricts?t('Loading villages…','Memuat kelurahan…'):t('Select sub-district (optional)','Pilih kelurahan / desa (opsional)')}</option>{addressSubdistricts.map(option=><option key={option.id} value={option.name}>{option.name}{option.postalCode?` (${option.postalCode})`:''}</option>)}</select></label>
            <label>{t('Postal code','Kode pos')}<input inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}" maxLength={5} required value={addressDraft.postalCode} onChange={event=>setAddressDraft({...addressDraft,postalCode:event.target.value.replace(/\D/g,'').slice(0,5)})}/></label>
          </div>
          <small>{t('Add your unit or house number, RT/RW, and a nearby landmark.','Tambahkan nomor unit atau rumah, RT/RW, dan patokan terdekat.')}</small>
          <div className="checkout-address-map"><MapPicker latitude={addressLatitude} longitude={addressLongitude} onChange={onAddressMapChange} language={locale} cityHint={[addressDraft.subdistrict,addressDraft.district,addressDraft.city].filter(Boolean).join(', ')||undefined} purpose="delivery"/></div>
          <button type="submit" className="button secondary" disabled={savingAddress}>{savingAddress?t('Saving address…','Menyimpan alamat…'):t('Save and check delivery rates','Simpan dan cek ongkir')}</button>
        </form>:null}

        {addressReady&&!editingAddress&&<>
          <div className="checkout-quote-row" id="checkout-delivery-services" tabIndex={-1}><div className="checkout-section-title"><Truck size={18}/><h2>{t('Delivery options','Opsi pengiriman')}</h2></div></div>
          {quoting&&<div className="shipping-options-skeleton" role="status" aria-label={t('Loading shipping options','Memuat opsi pengiriman')}>{[0,1,2].map(index=><div key={index}><span><i/><i/></span><i/></div>)}</div>}
          {!quoting&&rates.length>0&&<div className="checkout-rate-list">{rates.map(rate=>{const key=`${rate.courier_code}:${rate.courier_service_code}`;return <label key={key} className={selectedRate===key?'is-selected':''}><input type="radio" name="shipping-rate" value={key} checked={selectedRate===key} onChange={()=>setSelectedRate(key)}/><span><strong><span>{courierName(rate.courier_code)}</span><span>{rate.courier_service_name}</span></strong>{rate.duration&&<small>{rate.duration}</small>}</span><b>{formatMoney(rate.price,listing.currency)}</b></label>})}</div>}
          {quoteError&&<div><p className="checkout-error" role="alert">{quoteError}</p><button type="button" className="button secondary" onClick={()=>{setEditingAddress(true);setRates([]);setSelectedRate('')}}>{t('Edit delivery address','Ubah alamat pengiriman')}</button></div>}
        </>}
        {error&&<p className="checkout-error" role="alert">{error}</p>}
        {!checkoutAvailable&&<MarketPaymentPreview amount={subtotal+(currentRate?.price??0)-shippingDiscount+buyerServiceFee} currency={listing.currency} language={locale}/>}
        <button type="button" className="button checkout-pay-button" disabled={!currentRate||editingAddress||submitting||!checkoutAvailable||!contactComplete||quoting} onClick={startCheckout}>{submitting?t('Preparing payment…','Menyiapkan pembayaran…'):checkoutAvailable?t('Continue to payment','Lanjut ke pembayaran'):t('Payment coming soon','Pembayaran segera tersedia')}</button>
      </section>
    </div>
  </main>
}
