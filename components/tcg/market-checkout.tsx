'use client';

import Link from 'next/link';
import {MarketPaymentPreview} from './market-payment-preview';
import {useRouter,useSearchParams} from 'next/navigation';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeftIcon as ArrowLeft,MapPinIcon as MapPin,ShieldCheckIcon as ShieldCheck,TruckIcon as Truck} from '@phosphor-icons/react';
import {formatMoney,Listing} from '@/packages/domain';
import {cardFor,Card} from '@/packages/card-data/catalog';
import {api,useAccount} from '@/lib/client';
import {CardArt} from './card-art';
import {toast} from 'sonner';
import {isBiteshipAreaId} from '@/lib/shipping/biteship-area';
import {MARKET_BUYER_FEE_PERCENT,MARKET_PRO_BUYER_FEE_PERCENT,MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,MARKET_PRO_SHIPPING_VOUCHER_SHARE,MARKET_PRO_SHIPPING_VOUCHER_CAP} from '@/lib/market/policy';

type Origin={addressLine:string;city:string;postalCode:string;areaId:string|null;recipientName:string|null;phone:string|null;latitude?:number|null;longitude?:number|null;regionNames?:{province?:string;district?:string;subdistrict?:string}};
type Rate={courier_name:string;courier_service_name:string;courier_code:string;courier_service_code:string;company:string;type:string;price:number;duration?:string};
type CheckoutLine={printingId:string;quantity:number;unitAmount?:number};
type CartLine={listingId:string;listingTitle:string;items:CheckoutLine[]};

export function MarketCheckout(){
  const params=useSearchParams();
  const router=useRouter();
  const {data:account,loading:accountLoading,error:accountError}=useAccount();
  const cartMode=params.get('cart')==='1';
  const [cartLines,setCartLines]=useState<CartLine[]>([]);const [cartReady,setCartReady]=useState(!cartMode);
  const listingId=params.get('listing')??cartLines[0]?.listingId??'';
  const offerId=params.get('offer')??'';
  const rawItems=params.get('items')??'';
  const items=useMemo<CheckoutLine[]>(()=>{try{const parsed=JSON.parse(rawItems) as CheckoutLine[];return Array.isArray(parsed)?parsed:[]}catch{return []}},[rawItems]);
  const [listing,setListing]=useState<Listing>();
  const [cartListings,setCartListings]=useState<Listing[]>([]);
  const [origin,setOrigin]=useState<Origin>();
  const [rates,setRates]=useState<Rate[]>([]);
  const [selectedRate,setSelectedRate]=useState('');
  const [loading,setLoading]=useState(true);
  const [checkoutAvailable,setCheckoutAvailable]=useState(false);
  const [sandboxPayment,setSandboxPayment]=useState(false);
  const [buyerTier,setBuyerTier]=useState<'free'|'pro'>('free');
  const [shippingVouchersRemaining,setShippingVouchersRemaining]=useState(0);
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
  const [savingAddress,setSavingAddress]=useState(false);
  const autoQuoteKey=useRef('');
  const quoteRequest=useRef<AbortController|null>(null);

  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  const id=locale==='ID';
  const t=(en:string,idText:string)=>id?idText:en;

  useEffect(()=>{const sync=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');sync();window.addEventListener('vivreplay:locale',onLocale);return()=>window.removeEventListener('vivreplay:locale',onLocale)},[]);
  useEffect(()=>{if(!cartMode)return;try{const cart=JSON.parse(window.localStorage.getItem('vivreplay-market-cart-v1')||'null');setCartLines(Array.isArray(cart?.lines)?cart.lines.filter((line:CartLine)=>line?.listingId&&Array.isArray(line.items)&&line.items.length):[])}catch{setCartLines([])}finally{setCartReady(true)}},[cartMode]);
  useEffect(()=>{
    if(accountLoading)return;
    if(!account){setLoading(false);return;}
    setLoading(true);setDetailsError('');
    let active=true;
    Promise.all([
      api<{listings:Listing[]}>('/api/listings'),
      api<{origin:Origin|null}>('/api/shipping/origin',undefined,'GET'),
      api<{available:boolean;sandbox?:boolean;buyerTier?:'free'|'pro';shippingVouchersRemaining?:number}>('/api/checkout/market',undefined,'GET'),
    ]).then(([market,shipping,checkout])=>{
      if(!active)return;
      const selectedListings=cartMode?cartLines.map(line=>market.listings.find(row=>row.id===line.listingId)).filter((row):row is Listing=>Boolean(row)):[market.listings.find(row=>row.id===listingId)].filter((row):row is Listing=>Boolean(row));
      if(cartMode&&selectedListings.length!==cartLines.length)throw new Error(t('A listing in your cart is no longer available. Remove it and try again.','Salah satu listing di keranjang sudah tidak tersedia. Hapus listing tersebut lalu coba lagi.'));setCartListings(selectedListings);setListing(selectedListings[0]);
      setOrigin(shipping.origin??undefined);
      setCheckoutAvailable(checkout.available);
      setSandboxPayment(checkout.sandbox===true);
      setBuyerTier(checkout.buyerTier==='pro'?'pro':'free');
      setShippingVouchersRemaining(checkout.shippingVouchersRemaining??0);
    }).catch(cause=>{if(active)setDetailsError(cause instanceof Error?cause.message:'Checkout details could not load.')}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[account?.profile.id,accountLoading,listingId,cartMode,cartLines]);

  const selectedCards=useMemo(()=>{
    const sourceLines=cartMode?cartLines.map(line=>({listing:cartListings.find(row=>row.id===line.listingId),items:line.items})).filter(line=>line.listing):[{listing,items}];
    return sourceLines.flatMap(({listing:source,items:sourceItems})=>sourceItems.map(selected=>{
      const cardItems=source?.items??[];
      const item=cardItems.find(entry=>entry.printingId===selected.printingId);
      const card=(source?.printingId===selected.printingId?source.card:item?.card??cardFor(selected.printingId)) as Card|undefined;
      const bundleQuantity=cardItems.reduce((total,entry)=>total+entry.quantity,0)||source?.quantity||1;
      const fallbackUnitAmount=source?Math.max(1,Math.floor(source.amount/bundleQuantity)):0;
      return {listingId:source?.id,listingTitle:source?.title,printingId:selected.printingId,quantity:selected.quantity,card,unitAmount:selected.unitAmount&&selected.unitAmount>0?selected.unitAmount:item?.unitAmount&&item.unitAmount>0?item.unitAmount:fallbackUnitAmount,condition:item?.condition??source?.condition??'NM'};
    }));
  },[items,listing,cartMode,cartLines,cartListings]);
  const subtotal=selectedCards.reduce((sum,item)=>sum+item.unitAmount*item.quantity,0);
  const buyerServiceFeePercent=buyerTier==='pro'?MARKET_PRO_BUYER_FEE_PERCENT:MARKET_BUYER_FEE_PERCENT;
  const buyerServiceFee=Math.round(subtotal*buyerServiceFeePercent/100);
  const currentRate=rates.find(rate=>`${rate.courier_code}:${rate.courier_service_code}`===selectedRate);
  const shippingDiscount=buyerTier==='pro'&&shippingVouchersRemaining>0&&subtotal>=MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL&&currentRate?Math.min(Math.round(currentRate.price*MARKET_PRO_SHIPPING_VOUCHER_SHARE),MARKET_PRO_SHIPPING_VOUCHER_CAP):0;
  const courierName=(name:string)=>({jne:'JNE Express',jnt:'J&T Express',sicepat:'SiCepat Ekspres',anteraja:'Anteraja',tiki:'TIKI',pos:'Pos Indonesia',lion:'Lion Parcel',ninja:'Ninja Xpress',wahana:'Wahana Express',grab:'GrabExpress',gojek:'GoSend'}[name]??name);

  const loadQuotes=useCallback(async(forceRefresh=false)=>{
    if(!listing||!origin||(!/^\d{5}$/.test(origin.postalCode)&&!isBiteshipAreaId(origin.areaId))||!selectedCards.length){setQuoteError(t('Choose a valid listing and delivery address first.','Pilih listing dan alamat pengiriman yang valid.'));return}
    quoteRequest.current?.abort();
    const controller=new AbortController();quoteRequest.current=controller;
    setQuoting(true);setQuoteError('');setRates([]);setSelectedRate('');
    try{
      const response=await fetch('/api/shipping/quotes',{signal:controller.signal,method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listingId,lines:cartMode?cartLines.map(line=>({listingId:line.listingId,items:line.items})):undefined,items,destinationAreaId:origin.areaId,destinationPostalCode:origin.postalCode,refresh:forceRefresh})});
      const result=await response.json() as {pricing?:Rate[];error?:string};
      if(controller.signal.aborted)return;
      if(!response.ok)throw new Error(result.error??t('Shipping rates could not be loaded.','Ongkir tidak dapat dimuat.'));
      const options=result.pricing??[];setRates(options);if(options[0])setSelectedRate(`${options[0].courier_code}:${options[0].courier_service_code}`);
      if(!options.length)throw new Error(t('No delivery services are available for this address. Update the address or ask the seller for help.','Tidak ada layanan pengiriman untuk alamat ini. Perbarui alamat atau hubungi penjual.'));
    }catch(cause){if(!controller.signal.aborted)setQuoteError(cause instanceof Error?cause.message:t('Shipping rates could not be loaded.','Ongkir tidak dapat dimuat.'))}finally{if(quoteRequest.current===controller){setQuoting(false);quoteRequest.current=null;}}
  },[listing,origin,items,selectedCards,listingId,locale,cartMode,cartLines]);

  useEffect(()=>{
    if(!listing||!origin||!selectedCards.length)return;
    const key=JSON.stringify({buyer:account?.profile.id,listingId,items:selectedCards.map(item=>[item.listingId,item.printingId,item.quantity]),postal:origin.postalCode,area:origin.areaId,latitude:origin.latitude,longitude:origin.longitude});
    if(autoQuoteKey.current!==key){autoQuoteKey.current=key;void loadQuotes();}
  },[account?.profile.id,listing,origin,items,selectedCards,listingId,loadQuotes]);
  useEffect(()=>()=>{quoteRequest.current?.abort();},[]);
  useEffect(()=>{setContactName(origin?.recipientName||account?.profile.display_name||'');setContactPhone(origin?.phone||'');},[origin?.recipientName,origin?.phone,account?.profile.display_name]);
  useEffect(()=>{if(editingAddress)setAddressDraft({recipientName:origin?.recipientName||account?.profile.display_name||'',phone:origin?.phone||account?.profile.phone||'',addressLine:origin?.addressLine||'',city:origin?.city||'',postalCode:origin?.postalCode||'',province:origin?.regionNames?.province||'',district:origin?.regionNames?.district||'',subdistrict:origin?.regionNames?.subdistrict||''})},[editingAddress,origin,account?.profile.display_name,account?.profile.phone]);
  const saveAddress=async(event:React.FormEvent)=>{
    event.preventDefault();setSavingAddress(true);setError('');setQuoteError('');
    try{
      await api('/api/shipping/origin',{recipientName:addressDraft.recipientName,phone:addressDraft.phone,addressLine:addressDraft.addressLine,city:addressDraft.city,postalCode:addressDraft.postalCode,areaId:origin?.postalCode===addressDraft.postalCode?origin.areaId:null,latitude:origin?.postalCode===addressDraft.postalCode?origin.latitude:null,longitude:origin?.postalCode===addressDraft.postalCode?origin.longitude:null,regions:{province:addressDraft.province,district:addressDraft.district,subdistrict:addressDraft.subdistrict},shippingMethods:(origin as (Origin&{shippingMethods?:string[]})|undefined)?.shippingMethods},'POST');
      setOrigin({addressLine:addressDraft.addressLine,city:addressDraft.city,postalCode:addressDraft.postalCode,areaId:origin?.postalCode===addressDraft.postalCode?origin.areaId:null,recipientName:addressDraft.recipientName,phone:addressDraft.phone,regionNames:{province:addressDraft.province,district:addressDraft.district,subdistrict:addressDraft.subdistrict}});
      setEditingAddress(false);setEditingContact(false);autoQuoteKey.current='';toast.success(t('Delivery address saved','Alamat pengiriman disimpan'));
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
  const chooseDelivery=()=>{const panel=document.getElementById('checkout-delivery-services');panel?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});panel?.focus({preventScroll:true});};
  const updateCartQuantity=(sourceListingId:string,printingId:string,quantity:number)=>{const source=cartListings.find(row=>row.id===sourceListingId);const cap=source?.items?.filter(item=>item.printingId===printingId).reduce((total,item)=>total+item.quantity,0)??99;quantity=Math.min(99,cap,quantity);const next=cartLines.map(line=>line.listingId===sourceListingId?{...line,items:line.items.map(item=>item.printingId===printingId?{...item,quantity}:item).filter(item=>item.quantity>0)}:line).filter(line=>line.items.length>0);setCartLines(next);window.localStorage.setItem('vivreplay-market-cart-v1',JSON.stringify({sellerId:cartListings[0]?.sellerId??'',lines:next}));window.dispatchEvent(new Event('vivreplay:market-cart-updated'));autoQuoteKey.current='';};

  const startCheckout=async()=>{
    if(!currentRate)return;
    setSubmitting(true);setError('');
    try{
      const response=await fetch('/api/checkout/market',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listingId,offerId:offerId||undefined,items:cartMode?selectedCards.map(item=>({printingId:item.printingId,quantity:item.quantity,listingId:item.listingId})):items,lines:cartMode?cartLines.map(line=>({listingId:line.listingId,items:line.items})):undefined,courierName:currentRate.courier_name,courierServiceName:currentRate.courier_service_name,courierCode:currentRate.courier_code,courierServiceCode:currentRate.courier_service_code,courierType:currentRate.type,shippingFee:currentRate.price})});
      const result=await response.json() as {checkoutUrl?:string;error?:string};
      if(response.status===409&&result.error?.includes('delivery fee changed')){await loadQuotes(true);throw new Error(t('Delivery fees changed. Review the updated options before paying.','Ongkir berubah. Periksa opsi terbaru sebelum membayar.'));}
      if(!response.ok||!result.checkoutUrl)throw new Error(result.error??t('Checkout could not be started.','Checkout tidak dapat dimulai.'));
      if(cartMode){window.localStorage.removeItem('vivreplay-market-cart-v1');window.dispatchEvent(new Event('vivreplay:market-cart-updated'));}
      router.push(result.checkoutUrl);
    }catch(cause){const message=cause instanceof Error?cause.message:t('Checkout could not be started.','Checkout tidak dapat dimulai.');setError(message);toast.error(message)}finally{setSubmitting(false)}
  };

  if(loading||accountLoading||(cartMode&&!cartReady))return <main className="page vivre-checkout-page"><div className="checkout-loading"><i/><span>{t('Loading your checkout…','Memuat checkout…')}</span></div></main>;
  if(detailsError||accountError)return <main className="page vivre-checkout-page"><section className="checkout-message"><h1>{t('Checkout could not load','Checkout gagal dimuat')}</h1><p>{detailsError||t('Please refresh to load the listing and delivery address.','Muat ulang untuk memuat listing dan alamat pengiriman.')}</p><div className="checkout-error-actions"><button className="button" onClick={()=>window.location.reload()}>{t('Retry','Coba lagi')}</button>{cartMode&&<button className="button secondary" onClick={()=>{window.localStorage.removeItem('vivreplay-market-cart-v1');window.dispatchEvent(new Event('vivreplay:market-cart-updated'));router.replace('/market')}}>{t('Clear cart','Kosongkan keranjang')}</button>}</div></section></main>;
  if(!account)return <main className="page vivre-checkout-page"><section className="checkout-message checkout-auth-message"><ShieldCheck size={24}/><div className="checkout-message-content"><h1>{t('Sign in to check out','Masuk untuk checkout')}</h1><p>{t('Your delivery address and order are tied to your VivrePlay account.','Alamat pengiriman dan pesanan terhubung dengan akun VivrePlay Anda.')}</p><button className="button" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}>{t('Sign in','Masuk')}</button></div></section></main>;
  if(!listing||!selectedCards.length)return <main className="page vivre-checkout-page"><section className="checkout-message"><h1>{cartMode?t('Your cart is empty','Keranjang Anda kosong'):t('Listing unavailable','Listing tidak tersedia')}</h1><p>{cartMode?t('Add cards from a seller’s active listings to check them out together.','Tambahkan kartu dari listing aktif satu penjual untuk checkout bersama.'):t('Return to Market and select cards from an active seller listing.','Kembali ke Market dan pilih kartu dari listing yang aktif.')}</p><Link className="button" href="/market"><ArrowLeft size={16}/>{t('Back to Market','Kembali ke Market')}</Link></section></main>;

  return <main className="page vivre-checkout-page">
    <Link href={cartMode?'/market':`/market/${encodeURIComponent(listingId)}`} className="back-link"><ArrowLeft size={16}/>{cartMode?t('Back to Market','Kembali ke Market'):t('Back to listing','Kembali ke listing')}</Link>
    <header className="checkout-page-heading"><div><h1>{t('Review your order','Periksa pesanan')}</h1><p>{t('Check the cards, delivery address, and total before paying.','Periksa kartu, alamat pengiriman, dan total sebelum membayar.')}</p></div><span className="checkout-secure"><ShieldCheck size={15}/>{sandboxPayment?t('Sandbox test','Uji coba sandbox'):t('Secure payment','Pembayaran aman')}</span></header>
    <div className="checkout-layout">
      <section className="checkout-panel checkout-order-summary"><h2>{cartMode?t(`${cartLines.length} listings from ${listing.seller}`,`${cartLines.length} listing dari ${listing.seller}`):listing.title}</h2><p className="checkout-seller"><strong>{listing.seller}</strong><span>{listing.city}</span></p>
        <div className="checkout-items">{selectedCards.map(item=><div className="checkout-item-row" key={`${item.listingId}-${item.printingId}`}><div className="checkout-item-art">{item.card?<CardArt card={item.card}/>:<span>{item.printingId}</span>}</div><div className="checkout-item-copy"><strong>{item.card?.name||item.listingTitle||listing.title}</strong>{cartMode&&<small className="checkout-source-listing">{item.listingTitle}</small>}<small><span>{item.card?.code||item.card?.printingCode||item.printingId}</span>{item.card?.language&&<span>{item.card.language}</span>}{item.card?.variant&&<span>{item.card.variant}</span>}{item.card?.setCode&&<span>{item.card.setCode}</span>}<span>{item.condition}</span></small>{cartMode&&<div className="checkout-cart-quantity"><button type="button" aria-label={t('Remove one','Kurangi satu')} onClick={()=>updateCartQuantity(item.listingId!,item.printingId,item.quantity-1)}>−</button><span>{item.quantity}</span><button type="button" aria-label={t('Add one','Tambah satu')} onClick={()=>updateCartQuantity(item.listingId!,item.printingId,item.quantity+1)}>+</button><button type="button" className="checkout-cart-remove" onClick={()=>updateCartQuantity(item.listingId!,item.printingId,0)}>{t('Remove','Hapus')}</button></div>}</div><b>{formatMoney(item.unitAmount*item.quantity,listing.currency)}</b></div>)}</div>
        <dl className="checkout-totals"><div><dt>{t('Cards','Kartu')}</dt><dd>{formatMoney(subtotal,listing.currency)}</dd></div><div><dt>{t('Delivery','Pengiriman')}</dt><dd><button type="button" className="checkout-delivery-action" aria-controls="checkout-delivery-services" onClick={chooseDelivery}>{currentRate?`${formatMoney(currentRate.price,listing.currency)} - ${t('Change','Ubah')}`:quoting?t('Loading rates…','Memuat ongkir…'):t('Choose a service','Pilih layanan')}</button></dd></div>{shippingDiscount>0&&<div className="checkout-pro-voucher"><dt>{t('Market Pro delivery voucher','Voucher pengiriman Market Pro')}</dt><dd>−{formatMoney(shippingDiscount,listing.currency)}</dd></div>}<div><dt>{t(`Market service fee (${buyerServiceFeePercent}%)`,`Biaya layanan Market (${buyerServiceFeePercent}%)`)}</dt><dd>{formatMoney(buyerServiceFee,listing.currency)}</dd></div><div className="checkout-grand-total"><dt>{t('Total','Total')}</dt><dd>{formatMoney(subtotal+(currentRate?.price??0)-shippingDiscount+buyerServiceFee,listing.currency)}</dd></div></dl>
      </section>
      <section className="checkout-panel checkout-delivery-panel"><div className="checkout-section-title"><MapPin size={18}/><div><h2>{t('Delivery address','Alamat pengiriman')}</h2></div></div>
        {origin&&!editingAddress?<div className="checkout-address-card"><strong>{origin.recipientName||account.profile?.display_name}{origin.phone&&` - ${origin.phone}`}</strong><p>{origin.addressLine}<br/>{origin.regionNames?.subdistrict?`${origin.regionNames.subdistrict}, `:''}{origin.regionNames?.district?`${origin.regionNames.district}, `:''}{origin.city} {origin.postalCode}</p><button type="button" className="checkout-inline-link" onClick={()=>setEditingAddress(true)}>{t('Edit delivery details','Ubah detail pengiriman')}</button>
          {(!contactComplete||editingContact)&&<form className="checkout-contact-form form-stack" onSubmit={saveContact}><h3>{t('Delivery contact','Kontak pengiriman')}</h3><div className="form-row"><label>{t('Recipient name','Nama penerima')}<input required minLength={2} maxLength={100} autoComplete="name" value={contactName} onChange={event=>setContactName(event.target.value)}/></label><label>{t('Phone number','Nomor telepon')}<input required type="tel" minLength={8} maxLength={24} autoComplete="tel" value={contactPhone} onChange={event=>setContactPhone(event.target.value)}/></label></div><button type="submit" className="button secondary" disabled={savingContact}>{savingContact?t('Saving…','Menyimpan…'):t('Save delivery contact','Simpan kontak pengiriman')}</button></form>}
        </div>:null}
        {editingAddress||!origin?<form className="checkout-address-editor" onSubmit={event=>void saveAddress(event)}><div className="checkout-address-editor-heading"><strong>{t('Delivery details','Detail pengiriman')}</strong>{origin&&<button type="button" className="checkout-inline-link" onClick={()=>setEditingAddress(false)}>{t('Cancel','Batal')}</button>}</div><div className="checkout-address-fields"><label>{t('Recipient','Penerima')}<input autoComplete="name" required minLength={2} maxLength={100} value={addressDraft.recipientName} onChange={event=>setAddressDraft({...addressDraft,recipientName:event.target.value})}/></label><label>{t('Phone','Nomor telepon')}<input autoComplete="tel" type="tel" required minLength={8} maxLength={24} value={addressDraft.phone} onChange={event=>setAddressDraft({...addressDraft,phone:event.target.value})}/></label><label className="checkout-address-wide">{t('Street, building, unit, or house number','Jalan, gedung, nomor unit atau rumah')}<textarea autoComplete="street-address" required minLength={5} maxLength={260} rows={3} value={addressDraft.addressLine} onChange={event=>setAddressDraft({...addressDraft,addressLine:event.target.value})}/></label><label>{t('City / Regency','Kota / Kabupaten')}<input autoComplete="address-level2" required value={addressDraft.city} onChange={event=>setAddressDraft({...addressDraft,city:event.target.value})}/></label><label>{t('Postal code','Kode pos')}<input inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}" maxLength={5} required value={addressDraft.postalCode} onChange={event=>setAddressDraft({...addressDraft,postalCode:event.target.value.replace(/\D/g,'')})}/></label><label>{t('District (optional)','Kecamatan (opsional)')}<input autoComplete="address-level3" value={addressDraft.district} onChange={event=>setAddressDraft({...addressDraft,district:event.target.value})}/></label><label>{t('Sub-district (optional)','Kelurahan (opsional)')}<input value={addressDraft.subdistrict} onChange={event=>setAddressDraft({...addressDraft,subdistrict:event.target.value})}/></label></div><small>{t('Enter a 5-digit postal code to get delivery rates. Include tower, unit, RT/RW, or a landmark in the address.','Masukkan kode pos 5 digit untuk melihat ongkir. Tambahkan tower, unit, RT/RW atau patokan alamat.')}</small><button type="submit" className="button secondary" disabled={savingAddress}>{savingAddress?t('Saving address…','Menyimpan alamat…'):t('Save and check delivery rates','Simpan dan cek ongkir')}</button></form>:null}

        <div className="checkout-quote-row" id="checkout-delivery-services" tabIndex={-1}><div className="checkout-section-title"><Truck size={18}/><h2>{t('Delivery service','Layanan pengiriman')}</h2></div></div>
        {quoting&&<div className="shipping-options-skeleton" role="status" aria-label={t('Loading shipping options','Memuat opsi pengiriman')}>{[0,1,2].map(index=><div key={index}><span><i/><i/></span><i/></div>)}</div>}
        {!quoting&&rates.length>0&&<div className="checkout-rate-list">{rates.map(rate=>{const key=`${rate.courier_code}:${rate.courier_service_code}`;return <label key={key} className={selectedRate===key?'is-selected':''}><input type="radio" name="shipping-rate" value={key} checked={selectedRate===key} onChange={()=>setSelectedRate(key)}/><span><strong><span>{courierName(rate.courier_code)}</span><span>{rate.courier_service_name}</span></strong>{rate.duration&&<small>{rate.duration}</small>}</span><b>{formatMoney(rate.price,listing.currency)}</b></label>})}</div>}
        {quoteError&&<div><p className="checkout-error" role="alert">{quoteError}</p><button type="button" className="button secondary" disabled={quoting||!origin} onClick={()=>void loadQuotes()}>{t('Try again','Coba lagi')}</button></div>}
        {error&&<p className="checkout-error" role="alert">{error}</p>}
        {!checkoutAvailable&&<MarketPaymentPreview amount={subtotal+(currentRate?.price??0)-shippingDiscount+buyerServiceFee} currency={listing.currency} language={locale}/>}
        <button type="button" className="button checkout-pay-button" disabled={!currentRate||submitting||!checkoutAvailable||!contactComplete||quoting} onClick={startCheckout}>{submitting?t('Preparing payment…','Menyiapkan pembayaran…'):checkoutAvailable?t('Continue to payment','Lanjut ke pembayaran'):t('Payment coming soon','Pembayaran segera tersedia')}</button>
      </section>
    </div>
  </main>
}
