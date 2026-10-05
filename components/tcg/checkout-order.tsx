'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {CheckCircleIcon as CheckCircle,ClockIcon as Clock,ShieldCheckIcon as ShieldCheck,PackageIcon as Package,ArrowSquareOutIcon as ExternalLink} from '@phosphor-icons/react';
import {formatMoney} from '@/packages/domain';
import {useAccount} from '@/lib/client';
import {TurnstileField,turnstileEnabled,turnstileHeaders} from './turnstile-field';
import {PushNotificationPrompt} from './push-notification-settings';

type Order={id:string;kind:'MARKET'|'PRO';status:string;title:string;items:Array<{printingId:string;quantity:number}>;details:Record<string,unknown>;checkoutUrl:string|null;trackingUrl:string|null;waybillId:string|null;subtotal:number;shippingFee:number;amount:number;currency:string;expiresAt:string|null};

export function CheckoutOrder(){
  const params=useParams<{id:string}>();
  const {data:account,loading:accountLoading}=useAccount();
  const [order,setOrder]=useState<Order>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [turnstileToken,setTurnstileToken]=useState('');
  const [turnstileResetKey,setTurnstileResetKey]=useState(0);
  const [id,setId]=useState(false);
  useEffect(()=>{const sync=()=>setId(window.localStorage.getItem('vivreplay-locale')==='ID');const change=(event:Event)=>setId((event as CustomEvent<'EN'|'ID'>).detail==='ID');sync();window.addEventListener('vivreplay:locale',change);return()=>window.removeEventListener('vivreplay:locale',change)},[]);
  const t=(en:string,idText:string)=>id?idText:en;
  const href=(path:string)=>id?(path==='/'?'/id':`/id${path}`):path;
  useEffect(()=>{let alive=true;let timer:number|undefined;const poll=async()=>{try{const response=await fetch(`/api/checkout/order/${encodeURIComponent(params.id)}`,{cache:'no-store'});const result=await response.json() as Order&{error?:string};if(!response.ok)throw new Error(result.error??'Order status could not be loaded.');if(!alive)return;setOrder(result);if(result.status==='PENDING_PAYMENT')timer=window.setTimeout(poll,5000)}catch(cause){if(alive)setError(cause instanceof Error?cause.message:'Order status could not be loaded.')}};if(account)void poll();return()=>{alive=false;if(timer)window.clearTimeout(timer)}},[account,params.id]);

  const beginPayment=async()=>{
    if(turnstileEnabled&&!turnstileToken){setError(t('Complete the security check first.','Selesaikan pemeriksaan keamanan terlebih dahulu.'));return}
    setBusy(true);setError('');
    try{
      const response=await fetch(`/api/checkout/order/${encodeURIComponent(params.id)}/instrument`,{method:'POST',headers:{'content-type':'application/json',...turnstileHeaders(turnstileToken)},body:'{}'});
      const result=await response.json() as {checkoutUrl?:string;error?:string};
      if(!response.ok||!result.checkoutUrl)throw new Error(result.error??t('Secure payment could not be opened.','Halaman pembayaran aman tidak dapat dibuka.'));
      window.location.assign(result.checkoutUrl);
    }catch(cause){setError(cause instanceof Error?cause.message:t('Secure payment could not be opened.','Halaman pembayaran aman tidak dapat dibuka.'));setBusy(false)}
    finally{setTurnstileToken('');setTurnstileResetKey(value=>value+1)}
  };

  if(accountLoading)return <main className="page vivre-checkout-page"><div className="checkout-loading"><i/><span>{t('Loading payment status…','Memuat status pembayaran…')}</span></div></main>;
  if(!account)return <main className="page vivre-checkout-page"><section className="checkout-message"><ShieldCheck size={24}/><h1>{t('Sign in to view this checkout','Masuk untuk melihat checkout ini')}</h1><p>{t('Order and payment status are only available to the account that started checkout.','Status pesanan dan pembayaran hanya tersedia untuk akun yang memulai checkout.')}</p><button className="button" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}>{t('Sign in','Masuk')}</button></section></main>;
  if(!order)return <main className="page vivre-checkout-page"><section className="checkout-message"><h1>{t('Checkout could not be loaded','Checkout tidak dapat dimuat')}</h1><p>{error||t('Refresh the page to check the payment status again.','Muat ulang halaman untuk memeriksa status pembayaran.')}</p><Link className="button secondary" href={href('/market')}>{t('Return to Market','Kembali ke Market')}</Link></section></main>;

  const paid=order.status==='PAID';const shipped=order.status==='SHIPPED';
  const received=order.status==='RECEIVED';
  const confirmReceived=async()=>{setBusy(true);setError('');try{const response=await fetch(`/api/checkout/order/${encodeURIComponent(order.id)}`,{method:'POST'});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error??t('Delivery confirmation could not be saved.','Konfirmasi penerimaan tidak dapat disimpan.'));setOrder({...order,status:'RECEIVED'});}catch(cause){setError(cause instanceof Error?cause.message:t('Delivery confirmation could not be saved.','Konfirmasi penerimaan tidak dapat disimpan.'))}finally{setBusy(false)}};
  const locale=id?'id-ID':'en-US';
  const title=order.kind==='MARKET'?order.title:t('VivrePlay Market Pro','Market Pro VivrePlay');

  return <main className="page vivre-checkout-page">
    <header className="checkout-page-heading"><div><p className="eyebrow">VIVREPLAY CHECKOUT</p><h1>{paid?t('Payment complete','Pembayaran berhasil'):order.status==='PENDING_PAYMENT'?t('Complete your payment','Selesaikan pembayaran'):t('Checkout update','Pembaruan checkout')}</h1><p>{title}</p></div><span className="checkout-secure"><ShieldCheck size={15}/>{t('Secure payment by iPaymu','Pembayaran aman melalui iPaymu')}</span></header>
    {order.kind==='MARKET'&&(paid||shipped||received)?<section className="checkout-panel checkout-result">{received?<CheckCircle size={44}/>:<Package size={44}/>}<h2>{received?t('Delivery confirmed','Penerimaan dikonfirmasi'):shipped?t('Your order is on its way','Pesanan sedang dikirim'):t('Payment confirmed','Pembayaran dikonfirmasi')}</h2><p>{received?t('Your delivered cards are now in your private Vault.','Kartu yang diterima sudah masuk ke koleksi pribadi Anda.'):shipped?t('The seller shipped your cards. Track the parcel below, then confirm delivery when it arrives.','Penjual telah mengirim kartu. Lacak paket di bawah, lalu konfirmasi setelah diterima.'):t('The seller still needs to arrange shipping. You can follow the shipment from Market orders.','Penjual perlu mengatur pengiriman. Pantau statusnya di menu pesanan Market.')}</p>{shipped&&<div className="checkout-tracking-summary">{order.waybillId&&<strong>{t('Tracking number','Nomor resi')}: {order.waybillId}</strong>}{order.trackingUrl&&<a href={order.trackingUrl} target="_blank" rel="noreferrer">{t('Track with courier','Lacak melalui kurir')}<ExternalLink size={14}/></a>}</div>}<PushNotificationPrompt language={id?'ID':'EN'} message="order"/>{received?<Link className="button" href={href('/vault')}>{t('View your Vault','Lihat koleksi')}</Link>:shipped?<button className="button" disabled={busy} onClick={confirmReceived}>{busy?t('Saving…','Menyimpan…'):t('I received the cards · Add to Vault','Saya menerima kartu · Tambahkan ke koleksi')}</button>:<Link className="button" href={href('/market?activity=orders')}>{t('View Market orders','Lihat pesanan Market')}</Link>}<Link className="button secondary" href={href('/market')}>{t('Return to Market','Kembali ke Market')}</Link></section>:paid?<section className="checkout-panel checkout-result"><CheckCircle size={44}/><h2>{t('Market Pro is active','Market Pro aktif')}</h2><p>{t('Your Market Pro membership has been added to your account.','Keanggotaan Market Pro sudah ditambahkan ke akun Anda.')}</p><Link className="button" href={href('/profile')}>{t('Go to profile','Buka profil')}</Link></section>:order.status!=='PENDING_PAYMENT'?<section className="checkout-panel checkout-result"><Clock size={40}/><h2>{t('Payment is','Status pembayaran')}{' '}{order.status.toLowerCase().replaceAll('_',' ')}</h2><p>{t('This order can no longer be paid. Any card reservation has been released.','Pesanan ini tidak dapat dibayar lagi. Reservasi kartu telah dilepas.')}</p><Link className="button secondary" href={href(order.kind==='MARKET'?'/market':'/checkout/pro')}>{t('Continue to VivrePlay','Lanjutkan ke VivrePlay')}</Link></section>:<div className="checkout-layout"><section className="checkout-panel checkout-payment-panel"><h2>{t('Pay securely with iPaymu','Bayar dengan aman melalui iPaymu')}</h2><p className="checkout-provider-copy">{t('Choose QRIS, bank transfer, or an e-wallet on the secure iPaymu payment page.','Pilih QRIS, transfer bank, atau dompet digital di halaman pembayaran iPaymu yang aman.')}</p>{order.kind==='MARKET'&&<PushNotificationPrompt language={id?'ID':'EN'} message="order"/>}<TurnstileField onToken={setTurnstileToken} resetKey={turnstileResetKey}/><button className="button checkout-pay-button" disabled={busy} onClick={beginPayment}>{busy?t('Opening iPaymu…','Membuka iPaymu…'):order.checkoutUrl?<>{t('Continue to payment','Lanjutkan pembayaran')}<ExternalLink size={16}/></>:<>{t('Continue to iPaymu','Lanjutkan ke iPaymu')}<ExternalLink size={16}/></>}</button>{order.checkoutUrl&&<a className="checkout-resume-link" href={order.checkoutUrl} rel="noreferrer">{t('Open payment page in a new tab','Buka halaman pembayaran di tab baru')}</a>}</section>
      <aside className="checkout-panel checkout-order-summary"><h2>{t('Order summary','Ringkasan pesanan')}</h2>{order.kind==='MARKET'&&<div className="checkout-payment-lines">{order.items.map(item=><div key={item.printingId}><span>{item.printingId} × {item.quantity}</span></div>)}<div><span>{t('Cards','Kartu')}</span><b>{formatMoney(order.subtotal,'IDR')}</b></div><div><span>{t('Delivery','Pengiriman')}</span><b>{formatMoney(order.shippingFee,'IDR')}</b></div></div>}<div className="checkout-grand-total"><span>{t('Total','Total')}</span><strong>{formatMoney(order.amount,order.currency)}</strong></div><p className="checkout-expiry">{t('Payment window closes','Batas waktu pembayaran')}{' '}{order.expiresAt?new Date(`${order.expiresAt.replace(' ','T')}Z`).toLocaleString(locale):t('in 24 hours','dalam 24 jam')}.</p></aside></div>}
    {error&&<p className="checkout-error" role="alert">{error}</p>}
  </main>;
}
