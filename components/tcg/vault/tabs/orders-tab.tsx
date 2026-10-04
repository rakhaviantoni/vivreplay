'use client';

import {useCallback,useEffect,useState} from 'react';
import {ArrowCounterClockwiseIcon as Refresh} from '@phosphor-icons/react';
import {MarketActivityEmpty,MarketActivityLoading,MarketCardStack,type MarketActivityCard} from '@/components/tcg/vault/tabs/market-activity-state';

type Order={id:string;kind:string;status:string;amount:number;currency:string;createdAt:string;expiresAt:string|null;role:'buyer'|'seller';listingTitle:string|null;cards:MarketActivityCard[]};
const money=(amount:number,currency:string)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:currency||'IDR',maximumFractionDigits:0}).format(amount);
const dateLabel=(value:string,id:boolean)=>new Intl.DateTimeFormat(id?'id-ID':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(`${value.replace(' ','T')}Z`));
export function OrdersTab({language}:{language:'EN'|'ID'}){
  const id=language==='ID';
  const [orders,setOrders]=useState<Order[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const refresh=useCallback(async()=>{setLoading(true);setError('');try{const response=await fetch('/api/checkout/orders/mine',{cache:'no-store'});const data=await response.json() as {orders?:Order[];error?:string};if(!response.ok)throw new Error(data.error||(id?'Pesanan tidak dapat dimuat.':'Orders could not be loaded.'));setOrders(data.orders??[])}catch(reason){setError(reason instanceof Error?reason.message:(id?'Pesanan tidak dapat dimuat.':'Orders could not be loaded.'))}finally{setLoading(false)}},[id]);
  // Initial loading is represented by the initial state; manual refreshes toggle it later.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void refresh()},[refresh]);
  if(loading)return <MarketActivityLoading kind="orders" label={id?'Memuat pesanan…':'Loading your orders…'}/>;
  return <section className="market-activity-panel" aria-label={id?'Pesanan Market':'Market orders'}>
    <div className="market-activity-toolbar"><p>{id?'Pembelian dan pesanan penjual. Checkout yang belum dibayar berakhir setelah 24 jam.':'Purchases and seller orders. Unpaid checkouts expire after 24 hours.'}</p><button type="button" className="market-activity-refresh" onClick={()=>void refresh()}><Refresh size={15}/>{id?'Muat ulang':'Refresh'}</button></div>
    {error&&<div className="market-activity-error" role="alert"><span>{error}</span><button type="button" onClick={()=>void refresh()}>{id?'Coba lagi':'Try again'}</button></div>}
    {!orders.length?<MarketActivityEmpty title={id?'Belum ada pesanan':'No orders yet'} description={id?'Pembelian dan pesanan penjual akan muncul di sini.':'Your purchases and seller orders will appear here.'}/>:<div className="market-activity-list">{orders.map(order=>{
      const expired=order.status==='PENDING_PAYMENT'&&order.expiresAt&&new Date(`${order.expiresAt.replace(' ','T')}Z`).getTime()<=Date.now();
      const status=expired?'EXPIRED':order.status;
      return <article className="market-activity-row market-order-row" key={order.id}>
      <MarketCardStack cards={order.cards??[]}/>
      <div className="market-activity-row-main"><div className="market-activity-row-title"><span className={`market-order-role is-${order.role}`}>{id?(order.role==='buyer'?'Pembelian':'Penjualan'):(order.role==='buyer'?'Purchase':'Sale')}</span><span className={`vault-listing-status is-${status.toLowerCase()}`}>{status.replaceAll('_',' ')}</span></div><h3>{order.listingTitle||(order.kind==='PRO'?'Market Pro':'Market order')}</h3><p>{dateLabel(order.createdAt,id)}</p>{status==='PENDING_PAYMENT'&&order.expiresAt&&<small>{id?'Bayar sebelum ':'Payment due '}{dateLabel(order.expiresAt,id)}</small>}</div>
      <strong className="market-activity-price">{money(order.amount,order.currency)}</strong>
    </article>})}</div>}
  </section>;
}
