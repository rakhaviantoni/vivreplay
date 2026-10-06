'use client';

import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {useEffect,useMemo,useState} from 'react';
import {ArrowLeftIcon as ArrowLeft,MapPinIcon as MapPin,ShieldCheckIcon as ShieldCheck,TruckIcon as Truck} from '@phosphor-icons/react';
import {formatMoney,Listing} from '@/packages/domain';
import {cardFor,Card} from '@/packages/card-data/catalog';
import {api,useAccount} from '@/lib/client';
import {CardArt} from './card-art';
import {toast} from 'sonner';
import {isBiteshipAreaId} from '@/lib/shipping/biteship-area';

type Origin={addressLine:string;city:string;postalCode:string;areaId:string|null;recipientName:string|null;phone:string|null;regionNames?:{province?:string;district?:string;subdistrict?:string}};
type Rate={courier_name:string;courier_service_name:string;courier_code:string;courier_service_code:string;company:string;type:string;price:number;duration?:string};
type CheckoutLine={printingId:string;quantity:number;unitAmount?:number};

export function MarketCheckout(){
  const params=useSearchParams();
  const router=useRouter();
  const {data:account}=useAccount();
  const listingId=params.get('listing')??'';
  const offerId=params.get('offer')??'';
  const rawItems=params.get('items')??'';
  const items=useMemo<CheckoutLine[]>(()=>{try{const parsed=JSON.parse(rawItems) as CheckoutLine[];return Array.isArray(parsed)?parsed:[]}catch{return []}},[rawItems]);
  const [listing,setListing]=useState<Listing>();
  const [origin,setOrigin]=useState<Origin>();
  const [rates,setRates]=useState<Rate[]>([]);
  const [selectedRate,setSelectedRate]=useState('');
  const [loading,setLoading]=useState(true);
  const [checkoutAvailable,setCheckoutAvailable]=useState(false);
  const [quoting,setQuoting]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  const id=locale==='ID';
  const t=(en:string,idText:string)=>id?idText:en;

  useEffect(()=>{const sync=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');sync();window.addEventListener('vivreplay:locale',onLocale);return()=>window.removeEventListener('vivreplay:locale',onLocale)},[]);
  useEffect(()=>{
    if(!account)return;
    let active=true;
    Promise.all([
      api<{listings:Listing[]}>('/api/listings'),
      api<{origin:Origin|null}>('/api/shipping/origin',undefined,'GET'),
      api<{available:boolean}>('/api/checkout/market',undefined,'GET'),
    ]).then(([market,shipping,checkout])=>{
      if(!active)return;
      setListing(market.listings.find(row=>row.id===listingId));
      setOrigin(shipping.origin??undefined);
      setCheckoutAvailable(checkout.available);
    }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Checkout details could not load.')}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[account,listingId]);

  const selectedCards=useMemo(()=>{
    const cardItems=listing?.items??[];
    return items.map(selected=>{
      const item=cardItems.find(entry=>entry.printingId===selected.printingId);
      const card=(listing?.printingId===selected.printingId?listing.card:item?.card??cardFor(selected.printingId)) as Card|undefined;
      const bundleQuantity=cardItems.reduce((total,entry)=>total+entry.quantity,0)||listing?.quantity||1;
      const fallbackUnitAmount=listing?Math.max(1,Math.floor(listing.amount/bundleQuantity)):0;
      return {printingId:selected.printingId,quantity:selected.quantity,card,unitAmount:selected.unitAmount&&selected.unitAmount>0?selected.unitAmount:item?.unitAmount&&item.unitAmount>0?item.unitAmount:fallbackUnitAmount,condition:item?.condition??listing?.condition??'NM'};
    });
  },[items,listing]);
  const subtotal=selectedCards.reduce((sum,item)=>sum+item.unitAmount*item.quantity,0);
    const currentRate=rates.find(rate=>`${rate.courier_code}:${rate.courier_service_code}`===selectedRate);
  const courierName=(name:string)=>({jne:'JNE Express',jnt:'J&T Express',sicepat:'SiCepat Ekspres',anteraja:'Anteraja',tiki:'TIKI',pos:'Pos Indonesia',lion:'Lion Parcel',ninja:'Ninja Xpress',wahana:'Wahana Express',grab:'GrabExpress',gojek:'GoSend'}[name]??name);

  const loadQuotes=async(forceRefresh=false)=>{
    if(!listing||!origin||(!/^\d{5}$/.test(origin.postalCode)&&!isBiteshipAreaId(origin.areaId))||!items.length){setError(t('Choose a valid listing and delivery address first.','Pilih listing dan alamat pengiriman yang valid.'));return}
    setQuoting(true);setError('');setRates([]);setSelectedRate('');
    try{
      const response=await fetch('/api/shipping/quotes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listingId,items,destinationAreaId:origin.areaId,destinationPostalCode:origin.postalCode,refresh:forceRefresh})});
      const result=await response.json() as {pricing?:Rate[];error?:string};
      if(!response.ok)throw new Error(result.error??t('Shipping rates could not be loaded.','Ongkir tidak dapat dimuat.'));
      const options=result.pricing??[];setRates(options);if(options[0])setSelectedRate(`${options[0].courier_code}:${options[0].courier_service_code}`);
      if(!options.length)throw new Error(t('No delivery services are available for this address. Update the address or ask the seller for help.','Tidak ada layanan pengiriman untuk alamat ini. Perbarui alamat atau hubungi penjual.'));
    }catch(cause){setError(cause instanceof Error?cause.message:t('Shipping rates could not be loaded.','Ongkir tidak dapat dimuat.'))}finally{setQuoting(false)}
  };

  const startCheckout=async()=>{
    if(!currentRate)return;
    setSubmitting(true);setError('');
    try{
      const response=await fetch('/api/checkout/market',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listingId,offerId:offerId||undefined,items,courierName:currentRate.courier_name,courierServiceName:currentRate.courier_service_name,courierCode:currentRate.courier_code,courierServiceCode:currentRate.courier_service_code,courierType:currentRate.type,shippingFee:currentRate.price})});
      const result=await response.json() as {checkoutUrl?:string;error?:string};
      if(response.status===409&&result.error?.includes('delivery fee changed')){await loadQuotes(true);throw new Error(t('Delivery fees changed. Review the updated options before paying.','Ongkir berubah. Periksa opsi terbaru sebelum membayar.'));}
      if(!response.ok||!result.checkoutUrl)throw new Error(result.error??t('Checkout could not be started.','Checkout tidak dapat dimulai.'));
      router.push(result.checkoutUrl);
    }catch(cause){const message=cause instanceof Error?cause.message:t('Checkout could not be started.','Checkout tidak dapat dimulai.');setError(message);toast.error(message)}finally{setSubmitting(false)}
  };

  if(loading)return <main className="page vivre-checkout-page"><div className="checkout-loading"><i/><span>{t('Loading your checkout…','Memuat checkout…')}</span></div></main>;
  if(!account)return <main className="page vivre-checkout-page"><section className="checkout-message"><ShieldCheck size={24}/><h1>{t('Sign in to check out','Masuk untuk checkout')}</h1><p>{t('Your delivery address and order are tied to your VivrePlay account.','Alamat pengiriman dan pesanan terhubung dengan akun VivrePlay Anda.')}</p><button className="button" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}>{t('Sign in','Masuk')}</button></section></main>;
  if(!listing||!items.length)return <main className="page vivre-checkout-page"><section className="checkout-message"><h1>{t('Listing unavailable','Listing tidak tersedia')}</h1><p>{t('Return to Market and select cards from an active seller listing.','Kembali ke Market dan pilih kartu dari listing yang aktif.')}</p><Link className="button" href="/market"><ArrowLeft size={16}/>{t('Back to Market','Kembali ke Market')}</Link></section></main>;

  return <main className="page vivre-checkout-page">
    <Link href={`/market/${encodeURIComponent(listingId)}`} className="back-link"><ArrowLeft size={16}/>{t('Back to listing','Kembali ke listing')}</Link>
    <header className="checkout-page-heading"><div><p className="eyebrow">VIVREPLAY MARKET</p><h1>{t('Checkout','Checkout')}</h1><p>{t('Review the cards and delivery service before payment.','Periksa kartu dan layanan pengiriman sebelum membayar.')}</p></div><span className="checkout-secure"><ShieldCheck size={15}/>{t('Secure payment','Pembayaran aman')}</span></header>
    <div className="checkout-layout">
      <section className="checkout-panel checkout-order-summary"><h2>{listing.title}</h2><p className="checkout-seller">{listing.seller} · {listing.city}</p>
        <div className="checkout-items">{selectedCards.map(item=><div key={item.printingId} className="checkout-item-row"><div className="checkout-item-art">{item.card?<CardArt card={item.card}/>:<span>{item.printingId}</span>}</div><div className="checkout-item-copy"><strong>{item.card?.name||listing.title}</strong><small>{item.card?.code||item.card?.printingCode||item.printingId}{item.card?.language&&` · ${item.card.language}`}{item.card?.variant&&` · ${item.card.variant}`}{item.card?.setCode&&` · ${item.card.setCode}`} · {item.condition} · {item.quantity}×</small></div><b>{formatMoney(item.unitAmount*item.quantity,listing.currency)}</b></div>)}</div>
        <dl className="checkout-totals"><div><dt>{t('Cards','Kartu')}</dt><dd>{formatMoney(subtotal,listing.currency)}</dd></div><div><dt>{t('Delivery','Pengiriman')}</dt><dd>{currentRate?formatMoney(currentRate.price,listing.currency):t('Choose a service','Pilih layanan')}</dd></div><div className="checkout-grand-total"><dt>{t('Total','Total')}</dt><dd>{formatMoney(subtotal+(currentRate?.price??0),listing.currency)}</dd></div></dl>
      </section>
      <section className="checkout-panel checkout-delivery-panel"><div className="checkout-section-title"><MapPin size={18}/><div><h2>{t('Delivery address','Alamat pengiriman')}</h2><p>{t('Shipping is quoted from your saved address.','Ongkir dihitung dari alamat yang tersimpan.')}</p></div></div>
        {origin?<div className="checkout-address-card"><strong>{origin.recipientName||account.profile?.displayName||t('Recipient','Penerima')} · {origin.phone||t('No phone','Tanpa nomor')}</strong><p>{origin.addressLine}<br/>{origin.regionNames?.subdistrict?`${origin.regionNames.subdistrict}, `:''}{origin.regionNames?.district?`${origin.regionNames.district}, `:''}{origin.city} {origin.postalCode}</p><Link href="/profile?tab=shipping">{t('Change address','Ubah alamat')}</Link></div>:<div className="checkout-address-empty"><p>{t('Add an address and delivery contact before checkout.','Tambahkan alamat dan kontak pengiriman sebelum checkout.')}</p><Link className="button secondary" href="/profile?tab=shipping">{t('Set delivery address','Atur alamat pengiriman')}</Link></div>}
        <div className="checkout-quote-row"><div className="checkout-section-title"><Truck size={18}/><div><h2>{t('Delivery service','Layanan pengiriman')}</h2><p>{t('Live options from the seller’s enabled couriers.','Opsi langsung dari kurir aktif penjual.')}</p></div></div><button type="button" className="button secondary" disabled={quoting||!origin} onClick={()=>void loadQuotes()}>{quoting?t('Checking…','Memeriksa…'):t('Get shipping rates','Hitung ongkir')}</button></div>
        {rates.length>0&&<div className="checkout-rate-list">{rates.map(rate=>{const key=`${rate.courier_code}:${rate.courier_service_code}`;return <label key={key} className={selectedRate===key?'is-selected':''}><input type="radio" name="shipping-rate" value={key} checked={selectedRate===key} onChange={()=>setSelectedRate(key)}/><span><strong>{courierName(rate.courier_name)} · {rate.courier_service_name}</strong><small>{rate.duration||t('Delivery estimate provided by courier','Estimasi dari kurir')}</small></span><b>{formatMoney(rate.price,listing.currency)}</b></label>})}</div>}
        {error&&<p className="checkout-error" role="alert">{error}</p>}
        {!checkoutAvailable&&<p className="checkout-config-unavailable">{t('Online payment is not enabled for Market orders yet.','Pembayaran online belum diaktifkan untuk pesanan Market.')}</p>}
        <button type="button" className="button checkout-pay-button" disabled={!currentRate||submitting||!checkoutAvailable} onClick={startCheckout}>{submitting?t('Preparing payment…','Menyiapkan pembayaran…'):t('Continue to payment','Lanjut ke pembayaran')}</button>
      </section>
    </div>
  </main>
}
