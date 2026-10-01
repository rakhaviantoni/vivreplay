'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {CheckCircleIcon as CheckCircle,ClockIcon as Clock,ShieldCheckIcon as ShieldCheck} from '@phosphor-icons/react';
import {formatMoney} from '@/packages/domain';
import {useAccount} from '@/lib/client';

type Order={id:string;kind:'MARKET'|'PRO';status:string;title:string;items:Array<{printingId:string;quantity:number}>;details:Record<string,unknown>;subtotal:number;shippingFee:number;amount:number;currency:string;expiresAt:string|null};
type Instrument={method:string;channel:string;paymentNo:string;paymentName:string;total:number;fee:number;expiresAt:string|null;url:string|null;qrString:string|null};
export function CheckoutOrder(){
  const params=useParams<{id:string}>();
  const {data:account,loading:accountLoading}=useAccount();
  const [order,setOrder]=useState<Order>();
  const [instrument,setInstrument]=useState<Instrument>();
  const [method,setMethod]=useState<'qris'|'va'|'ewallet'>('qris');
  const [channel,setChannel]=useState('mpm');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{let alive=true;let timer:number|undefined;const poll=async()=>{try{const response=await fetch(`/api/checkout/order/${encodeURIComponent(params.id)}`,{cache:'no-store'});const result=await response.json() as Order&{error?:string};if(!response.ok)throw new Error(result.error??'Order status could not be loaded.');if(!alive)return;setOrder(result);if(result.status==='PENDING_PAYMENT')timer=window.setTimeout(poll,5000)}catch(cause){if(alive)setError(cause instanceof Error?cause.message:'Order status could not be loaded.')}};if(account)void poll();return()=>{alive=false;if(timer)window.clearTimeout(timer)}},[account,params.id]);
  const createInstrument=async()=>{setBusy(true);setError('');try{const response=await fetch(`/api/checkout/order/${encodeURIComponent(params.id)}/instrument`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,channel})});const result=await response.json() as {instrument?:Instrument;error?:string};if(!response.ok||!result.instrument)throw new Error(result.error??'Payment method could not be prepared.');setInstrument(result.instrument)}catch(cause){setError(cause instanceof Error?cause.message:'Payment method could not be prepared.')}finally{setBusy(false)}};
  useEffect(()=>{
    if(!instrument?.qrString)return;
    const render=()=>{const target=document.getElementById('vivreplay-payment-qr');const qr=(window as unknown as {QRCode?:new(target:HTMLElement,options:Record<string,unknown>)=>unknown}).QRCode;if(!target||!qr)return false;target.replaceChildren();new qr(target,{text:instrument.qrString,width:224,height:224,colorDark:'#18272e',colorLight:'#ffffff',correctLevel:1});return true};
    if(render())return;
    let script=document.querySelector<HTMLScriptElement>('script[data-vivreplay-qr]');
    const created=!script;
    if(!script){script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';script.dataset.vivreplayQr='true';document.head.appendChild(script)}
    script.addEventListener('load',render);
    return()=>{script?.removeEventListener('load',render);if(created)script?.remove()};
  },[instrument]);
  if(accountLoading)return <main className="page vivre-checkout-page"><div className="checkout-loading"><i/><span>Loading payment status…</span></div></main>;
  if(!account)return <main className="page vivre-checkout-page"><section className="checkout-message"><ShieldCheck size={24}/><h1>Sign in to view this checkout</h1><p>Order and payment status are only available to the account that started checkout.</p><button className="button" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}>Sign in</button></section></main>;
  if(!order)return <main className="page vivre-checkout-page"><section className="checkout-message"><h1>Checkout could not be loaded</h1><p>{error||'Refresh the page to check the payment status again.'}</p><Link className="button secondary" href="/market">Return to Market</Link></section></main>;
  const paid=order.status==='PAID';
  return <main className="page vivre-checkout-page"><header className="checkout-page-heading"><div><p className="eyebrow">VIVREPLAY CHECKOUT</p><h1>{paid?'Payment complete':order.status==='PENDING_PAYMENT'?'Complete your payment':'Checkout update'}</h1><p>{order.kind==='MARKET'?order.title:'VivrePlay Pro membership'}</p></div><span className="checkout-secure"><ShieldCheck size={15}/>Secure payment</span></header>
    {paid?<section className="checkout-panel checkout-result"><CheckCircle size={44}/><h2>{order.kind==='MARKET'?'Your order is confirmed':'VivrePlay Pro is active'}</h2><p>{order.kind==='MARKET'?'Payment confirmed. The seller will prepare your selected cards.':'Your Pro membership has been added to your account.'}</p><Link className="button" href={order.kind==='MARKET'?'/market':'/profile'}>{order.kind==='MARKET'?'Return to Market':'Go to profile'}</Link></section>:order.status!=='PENDING_PAYMENT'?<section className="checkout-panel checkout-result"><Clock size={40}/><h2>Payment is {order.status.toLowerCase().replaceAll('_',' ')}</h2><p>This order can no longer be paid. Your reserved cards have been released.</p><Link className="button secondary" href={order.kind==='MARKET'?'/market':'/checkout/pro'}>Continue to VivrePlay</Link></section>:<div className="checkout-layout"><section className="checkout-panel checkout-payment-panel"><h2>Choose a payment method</h2><div className="checkout-method-tabs"><button className={method==='qris'?'is-selected':''} onClick={()=>{setMethod('qris');setChannel('mpm');setInstrument(undefined)}}>QRIS</button><button className={method==='va'?'is-selected':''} onClick={()=>{setMethod('va');setChannel('bca');setInstrument(undefined)}}>Virtual account</button><button className={method==='ewallet'?'is-selected':''} onClick={()=>{setMethod('ewallet');setChannel('dana');setInstrument(undefined)}}>E-wallet</button></div><div className="checkout-channel-list">{(method==='va'?[['bca','BCA'],['bni','BNI'],['bri','BRI'],['mandiri','Mandiri'],['cimb','CIMB'],['permata','Permata'],['bsi','BSI']]:method==='ewallet'?[['dana','DANA'],['shopeepay','ShopeePay']]:[['mpm','QRIS']]).map(([value,label])=><label key={value} className={channel===value?'is-selected':''}><input type="radio" name="payment-channel" checked={channel===value} onChange={()=>{setChannel(value);setInstrument(undefined)}}/><span>{label}</span></label>)}</div>{instrument? <div className="checkout-instrument">{instrument.qrString?<><p>Scan this QRIS code in your payment app.</p><div id="vivreplay-payment-qr"/></>:<><p>Transfer using these details:</p><strong>{instrument.paymentNo}</strong><span>{instrument.paymentName}</span></>}{instrument.url&&<a className="button" href={instrument.url} target="_blank" rel="noreferrer">Open payment app</a>}<small>Amount {formatMoney(instrument.total,'IDR')} · status refreshes automatically</small></div>:<button className="button checkout-pay-button" disabled={busy} onClick={createInstrument}>{busy?'Preparing payment…':'Create payment instructions'}</button>}</section>
      <aside className="checkout-panel checkout-order-summary"><h2>Order summary</h2>{order.kind==='MARKET'&&<div className="checkout-payment-lines">{order.items.map(item=><div key={item.printingId}><span>{item.printingId} × {item.quantity}</span></div>)}<div><span>Cards</span><b>{formatMoney(order.subtotal,'IDR')}</b></div><div><span>Delivery</span><b>{formatMoney(order.shippingFee,'IDR')}</b></div></div>}<div className="checkout-grand-total"><span>Total</span><strong>{formatMoney(order.amount,'IDR')}</strong></div><p className="checkout-expiry">Payment window closes {order.expiresAt?new Date(`${order.expiresAt.replace(' ','T')}Z`).toLocaleString():'in 24 hours'}.</p></aside></div>}
    {error&&<p className="checkout-error" role="alert">{error}</p>}
  </main>;
}
