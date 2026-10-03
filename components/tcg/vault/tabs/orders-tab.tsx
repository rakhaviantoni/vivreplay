'use client';

import {useEffect,useState} from 'react';
import {toast} from 'sonner';

type Order={id:string;kind:string;status:string;amount:number;currency:string;createdAt:string;role:'buyer'|'seller';listingTitle:string|null};
const money=(amount:number,currency:string)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:currency||'IDR',maximumFractionDigits:0}).format(amount);
export function OrdersTab({language}:{language:'EN'|'ID'}){
  const id=language==='ID';const [orders,setOrders]=useState<Order[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
  useEffect(()=>{let alive=true;setLoading(true);setError('');fetch('/api/checkout/orders/mine',{cache:'no-store'}).then(async response=>{const data=await response.json() as {orders?:Order[];error?:string};if(!response.ok)throw new Error(data.error||'Orders could not be loaded.');if(alive)setOrders(data.orders??[])}).catch(reason=>{if(alive){const message=reason instanceof Error?reason.message:'Orders could not be loaded.';setError(message);toast.error(message)}}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[retry]);
  if(loading)return <section className="vault-listings-panel" aria-busy="true"><p>{id?'Memuat pesanan…':'Loading orders…'}</p></section>;
  if(error)return <div className="vault-listings-empty" role="alert"><strong>{id?'Pesanan tidak dapat dimuat':'Orders could not be loaded'}</strong><span>{error}</span><button type="button" className="vault-btn vault-btn-secondary" onClick={()=>setRetry(value=>value+1)}>{id?'Coba lagi':'Try again'}</button></div>;
  if(!orders.length)return <div className="vault-listings-empty"><strong>{id?'Belum ada pesanan':'No orders yet'}</strong><span>{id?'Pesanan Market yang Anda beli atau proses akan muncul di sini.':'Market purchases and orders you fulfill will appear here.'}</span></div>;
  return <div className="vault-listings-list">{orders.map(order=><article className="vault-listing-row" key={order.id}><div className="vault-listing-main"><div className="vault-listing-title-row"><h3>{order.listingTitle|| (order.kind==='PRO'?'Market Pro':'Market order')}</h3><span className={`vault-listing-status is-${order.status.toLowerCase()}`}>{order.status.replaceAll('_',' ')}</span></div><p>{id?(order.role==='buyer'?'Pembelian':'Pesanan penjual'):(order.role==='buyer'?'Purchase':'Seller order')} · {new Date(`${order.createdAt.replace(' ','T')}Z`).toLocaleString(id?'id-ID':'en-US')}</p></div><strong className="vault-listing-price">{money(order.amount,order.currency)}</strong></article>)}</div>;
}
