'use client';

import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowCounterClockwiseIcon as Refresh,CaretDownIcon as CaretDown,PackageIcon as Package,TruckIcon as Truck,CheckCircleIcon as CheckCircle,ArrowSquareOutIcon as ExternalLink} from '@phosphor-icons/react';
import {OrderReview} from '@/components/tcg/market-reputation';
import {formatMoney} from '@/packages/domain';
import {MarketActivityEmpty,MarketActivityLoading,MarketCardStack,type MarketActivityCard} from '@/components/tcg/vault/tabs/market-activity-state';

type OrderItem={printingId:string;quantity:number;unitAmount?:number;condition?:string;card?:{name:string;code:string;language:string;variant:string;rarity:string;imageUrl:string|null}|null};
type ShippingInfo={recipientName?:string;addressLine?:string;city?:string;postalCode?:string;phone?:string;label?:string;courierName?:string;courierServiceName?:string;waybillId?:string|null;trackingUrl?:string|null}|null;
type OrderDetail={id:string;status:string;viewerRole:'buyer'|'seller';items:OrderItem[];shipping:ShippingInfo;subtotal:number;shippingFee:number;amount:number;currency:string;sellerNetAmount:number|null;marketFeePercent:number;marketSellerTier:'free'|'pro'|null;marketStandardFeePercent:number|null;paymentFee:number|null;expiresAt:string|null};
type Order={id:string;kind:string;status:string;amount:number;subtotal:number;sellerNetAmount:number|null;currency:string;createdAt:string;expiresAt:string|null;role:'buyer'|'seller';listingTitle:string|null;printingId:string|null;shippingStatus:string|null;trackingId:string|null;waybillId:string|null;trackingUrl:string|null;trackingStatus:string|null;shippingFee:number;cards:MarketActivityCard[];marketFeePercent:number;marketSellerTier:'free'|'pro';marketStandardFeePercent:number|null;marketProSavings:number};
type Tracking={status?:string;history?:Array<{status?:string;note?:string;updated_at?:string}>};
const money=(amount:number,currency:string)=>formatMoney(amount,currency||'IDR');
const dateLabel=(value:string,id:boolean)=>new Intl.DateTimeFormat(id?'id-ID':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(`${value.replace(' ','T')}Z`));
const safeDate=(value:string|null,id:boolean)=>value?dateLabel(value,id):'';

export function OrdersTab({language,initialOrderId}:{language:'EN'|'ID';initialOrderId?:string|null}){
  const id=language==='ID';
  const [orders,setOrders]=useState<Order[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [now,setNow]=useState(0);
  const [expanded,setExpanded]=useState('');const [details,setDetails]=useState<Record<string,OrderDetail>>({});const [detailBusy,setDetailBusy]=useState('');const [detailError,setDetailError]=useState('');
  const [shipmentOrder,setShipmentOrder]=useState('');const [shipmentBusy,setShipmentBusy]=useState('');const [confirmBusy,setConfirmBusy]=useState('');const [tracking,setTracking]=useState<Record<string,Tracking>>({});
  const focusedOrder=useRef('');
  const refresh=useCallback(async(silent=false)=>{if(!silent){setLoading(true);setError('')}try{const response=await fetch('/api/checkout/orders/mine',{cache:'no-store'});const data=await response.json() as {orders?:Order[];error?:string};if(!response.ok)throw new Error(data.error||(id?'Pesanan tidak dapat dimuat.':'Orders could not be loaded.'));setNow(Date.now());setOrders(data.orders??[])}catch(reason){if(!silent)setError(reason instanceof Error?reason.message:(id?'Pesanan tidak dapat dimuat.':'Orders could not be loaded.'))}finally{if(!silent)setLoading(false)}},[id]);
  // Initial loading is represented by the initial state; manual refreshes toggle it later.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void refresh()},[refresh]);
  useEffect(()=>{const timer=window.setInterval(()=>void refresh(true),10_000);return()=>window.clearInterval(timer)},[refresh]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),60_000);return()=>window.clearInterval(timer)},[]);
  const loadDetails=async(orderId:string)=>{setDetailBusy(orderId);setDetailError('');try{const response=await fetch(`/api/checkout/order/${encodeURIComponent(orderId)}`,{cache:'no-store'});const data=await response.json() as OrderDetail&{error?:string};if(!response.ok)throw new Error(data.error||(id?'Detail pesanan tidak dapat dimuat.':'Order details could not be loaded.'));setDetails(current=>({...current,[orderId]:data}))}catch(reason){setDetailError(reason instanceof Error?reason.message:(id?'Detail pesanan tidak dapat dimuat.':'Order details could not be loaded.'))}finally{setDetailBusy('')}};
  const toggleDetails=(orderId:string)=>{if(expanded===orderId){setExpanded('');setDetailError('');return}setExpanded(orderId);if(!details[orderId])void loadDetails(orderId)};
  useEffect(()=>{if(!loading&&initialOrderId&&focusedOrder.current!==initialOrderId){focusedOrder.current=initialOrderId;document.getElementById(`market-order-${initialOrderId}`)?.scrollIntoView({behavior:'smooth',block:'center'});setExpanded(initialOrderId);if(!details[initialOrderId])void loadDetails(initialOrderId)}},[initialOrderId,loading]);
  const arrangeShipping=async(orderId:string)=>{setShipmentBusy(orderId);setDetailError('');try{const response=await fetch(`/api/checkout/order/${encodeURIComponent(orderId)}/shipment`,{method:'POST'});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||(id?'Pengiriman tidak dapat dibuat.':'Shipment could not be created.'));setShipmentOrder('');await refresh(true);await loadDetails(orderId)}catch(reason){setDetailError(reason instanceof Error?reason.message:(id?'Pengiriman tidak dapat dibuat.':'Shipment could not be created.'))}finally{setShipmentBusy('')}};
  const loadTracking=async(orderId:string)=>{try{const response=await fetch(`/api/checkout/order/${encodeURIComponent(orderId)}/tracking`,{cache:'no-store'});const data=await response.json() as {tracking?:Tracking;error?:string};if(!response.ok)throw new Error(data.error||(id?'Status pengiriman tidak dapat dimuat.':'Tracking could not be loaded.'));setTracking(current=>({...current,[orderId]:data.tracking??{}}))}catch(reason){setDetailError(reason instanceof Error?reason.message:(id?'Status pengiriman tidak dapat dimuat.':'Tracking could not be loaded.'))}};
  const confirmReceived=async(orderId:string)=>{setConfirmBusy(orderId);setDetailError('');try{const response=await fetch(`/api/checkout/order/${encodeURIComponent(orderId)}`,{method:'POST'});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||(id?'Penerimaan pesanan tidak dapat disimpan.':'Delivery confirmation could not be saved.'));await refresh(true);await loadDetails(orderId)}catch(reason){setDetailError(reason instanceof Error?reason.message:(id?'Penerimaan pesanan tidak dapat disimpan.':'Delivery confirmation could not be saved.'))}finally{setConfirmBusy('')}};
  if(loading)return <MarketActivityLoading kind="orders" label={id?'Memuat pesanan…':'Loading your orders…'}/>;
  const statusLabels:Record<string,string>=id?{PENDING_PAYMENT:'Menunggu pembayaran',PROCESSING:'Diproses',PAID:'Dibayar',SHIPPED:'Dikirim',RECEIVED:'Diterima',COMPLETED:'Selesai',CANCELLED:'Dibatalkan',EXPIRED:'Kedaluwarsa'}:{PENDING_PAYMENT:'Pending payment',PROCESSING:'Processing',PAID:'Paid',SHIPPED:'Shipped',RECEIVED:'Received',COMPLETED:'Completed',CANCELLED:'Cancelled',EXPIRED:'Expired'};
  return <section className="market-activity-panel" aria-label={id?'Pesanan Market':'Market orders'}>
    <div className="market-activity-toolbar"><p>{id?'Pembelian dan penjualan Anda. Checkout yang belum dibayar berakhir setelah 24 jam.':'Your purchases and sales. Unpaid checkouts expire after 24 hours.'}</p><button type="button" className="market-activity-refresh" onClick={()=>void refresh()}><Refresh size={15}/>{id?'Muat ulang':'Refresh'}</button></div>
    {error&&<div className="market-activity-error" role="alert"><span>{error}</span><button type="button" onClick={()=>void refresh()}>{id?'Coba lagi':'Try again'}</button></div>}
    {!orders.length?<MarketActivityEmpty title={id?'Belum ada pesanan':'No orders yet'} description={id?'Pembelian dan penjualan akan muncul di sini.':'Your purchases and sales will appear here.'}/>:<div className="market-activity-list">{orders.map(order=>{
      const expired=order.status==='PENDING_PAYMENT'&&order.expiresAt&&new Date(`${order.expiresAt.replace(' ','T')}Z`).getTime()<=now;
      const status=expired?'EXPIRED':order.status;const isExpanded=expanded===order.id;const detail=details[order.id];const feeAmount=Math.max(0,order.subtotal-(order.sellerNetAmount??order.subtotal));
      return <article id={`market-order-${order.id}`} className={`market-activity-row market-order-row${initialOrderId===order.id?' is-targeted':''}${isExpanded?' is-expanded':''}`} key={order.id}>
        <div className="market-order-summary" role="button" tabIndex={0} aria-expanded={isExpanded} onClick={()=>toggleDetails(order.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleDetails(order.id)}}}>
          <MarketCardStack cards={order.cards??[]}/>
          <div className="market-activity-row-main"><div className="market-activity-row-title"><span className={`market-activity-badge market-order-role is-${order.role}`}>{id?(order.role==='buyer'?'Pembelian':'Penjualan'):(order.role==='buyer'?'Purchase':'Sale')}</span><span className={`vault-listing-status is-${status.toLowerCase().replaceAll('_','-')}`}>{statusLabels[status]??status}</span></div><h3>{order.listingTitle||(order.kind==='PRO'?'Market Pro':id?'Pesanan Market':'Market order')}</h3><p>{dateLabel(order.createdAt,id)}</p>{status==='PENDING_PAYMENT'&&order.expiresAt&&<small>{id?'Bayar sebelum ':'Payment due '}{dateLabel(order.expiresAt,id)}</small>}</div>
          <div className="market-order-total"><small>{id?(order.role==='buyer'?'Total pesanan':'Dibayar pembeli'):(order.role==='buyer'?'Order total':'Buyer paid')}</small><strong>{money(order.amount,order.currency)}</strong><span className="market-order-expand-label">{isExpanded?(id?'Tutup':'Close'):(id?'Detail':'Details')}<CaretDown size={15}/></span></div>
        </div>
        {isExpanded&&<div className="market-order-details">
          {detailBusy===order.id&&!detail&&<p className="market-order-detail-loading">{id?'Memuat detail pesanan…':'Loading order details…'}</p>}
          {detailError&&<div className="market-activity-error" role="alert"><span>{detailError}</span><button type="button" onClick={()=>void loadDetails(order.id)}>{id?'Coba lagi':'Try again'}</button></div>}
          {detail&&<>
            <div className="market-order-detail-items"><h4>{id?'Kartu':'Cards'}</h4>{detail.items.map((item,index)=><div className="market-order-detail-item" key={`${item.printingId}-${index}`}>
              {item.card?.imageUrl?<img src={item.card.imageUrl} alt=""/>:<span className="market-order-detail-placeholder"/>}
              <div><strong>{item.card?.name??item.printingId}</strong><small>{item.card?.code??item.printingId}{item.card?.rarity?` · ${item.card.rarity}`:''}{item.card?.language?` · ${item.card.language}`:''}{item.condition?` · ${item.condition}`:''} × {item.quantity}</small></div>
              <b>{money((item.unitAmount??0)*item.quantity,detail.currency)}</b>
            </div>)}</div>
            <div className="market-order-ledger"><h4>{id?'Rincian pembayaran':'Payment breakdown'}</h4>
              <div><span>{id?'Subtotal kartu':'Cards subtotal'}</span><b>{money(detail.subtotal,detail.currency)}</b></div>
              {detail.shippingFee>0&&<div><span>{id?'Pengiriman':'Delivery'}</span><b>{money(detail.shippingFee,detail.currency)}</b></div>}
              {order.role==='buyer'&&detail.paymentFee!==null&&<div><span>{id?'Biaya QRIS, ditanggung VivrePlay':'QRIS fee, covered by VivrePlay'}</span><b>{money(detail.paymentFee,detail.currency)}</b></div>}
              {order.role==='seller'&&order.kind==='MARKET'&&<>
                <div><span>{id?`Biaya Market (${order.marketFeePercent}%)`:`Market fee (${order.marketFeePercent}%)`}</span><b>{money(feeAmount,detail.currency)}</b></div>
                {order.marketSellerTier==='pro'&&order.marketProSavings>0&&<p>{id?`Pro menghemat ${money(order.marketProSavings,detail.currency)} dari biaya ${order.marketStandardFeePercent}%`:`Pro saved you ${money(order.marketProSavings,detail.currency)} at the standard ${order.marketStandardFeePercent}% fee`}</p>}
                <div className="market-order-ledger-total"><span>{id?'Anda terima':'You receive'}</span><b>{money(detail.sellerNetAmount??detail.subtotal,detail.currency)}</b></div>
              </>}
              {order.role==='buyer'&&<div className="market-order-ledger-total"><span>{id?'Total dibayar':'Total paid'}</span><b>{money(detail.amount,detail.currency)}</b></div>}
            </div>
            {detail.shipping&&<div className="market-order-shipping-detail"><h4>{id?'Pengiriman':'Delivery'}</h4><p>{detail.shipping.courierName}{detail.shipping.courierServiceName?` · ${detail.shipping.courierServiceName}`:''}</p>{detail.shipping.addressLine&&<p>{detail.shipping.recipientName}<br/>{detail.shipping.addressLine}<br/>{detail.shipping.city} {detail.shipping.postalCode}{detail.shipping.phone?` · ${detail.shipping.phone}`:''}</p>}{(detail.shipping.waybillId||detail.shipping.trackingUrl)&&<div className="market-order-tracking">{detail.shipping.waybillId&&<strong>{id?'Resi':'Tracking number'}: {detail.shipping.waybillId}</strong>}{detail.shipping.trackingUrl&&<a href={detail.shipping.trackingUrl} target="_blank" rel="noreferrer">{id?'Lacak paket':'Track parcel'}<ExternalLink size={14}/></a>}</div>}</div>}
            <div className="market-order-detail-actions">
              {order.role==='buyer'&&status==='PENDING_PAYMENT'&&<Link className="button" href={`/checkout/order/${encodeURIComponent(order.id)}`}>{id?'Lanjutkan pembayaran':'Continue to payment'}</Link>}
              {order.role==='seller'&&status==='PENDING_PAYMENT'&&<span>{id?'Menunggu pembayaran pembeli':'Waiting for buyer payment'}</span>}
              {order.role==='seller'&&status==='PAID'&&<button type="button" className="button" disabled={shipmentBusy===order.id} onClick={()=>shipmentOrder===order.id?void arrangeShipping(order.id):setShipmentOrder(order.id)}><Package size={15}/>{shipmentBusy===order.id?(id?'Menyiapkan…':'Preparing…'):shipmentOrder===order.id?(id?'Buat pengiriman':'Create shipment'):(id?'Atur pengiriman':'Arrange shipping')}</button>}
              {(status==='SHIPPED'||order.trackingId)&&<button type="button" className="button secondary" onClick={()=>void loadTracking(order.id)}><Truck size={15}/>{id?'Perbarui pelacakan':'Refresh tracking'}</button>}
              {order.role==='buyer'&&status==='SHIPPED'&&<button type="button" className="button" disabled={confirmBusy===order.id} onClick={()=>void confirmReceived(order.id)}><CheckCircle size={15}/>{confirmBusy===order.id?(id?'Menyimpan…':'Saving…'):(id?'Konfirmasi diterima':'Confirm delivery')}</button>}
              {order.role==='seller'&&(status==='SHIPPED'||order.trackingId)&&<a href={`/api/checkout/order/${encodeURIComponent(order.id)}/label`} target="_blank" rel="noreferrer">{id?'Cetak label':'Print label'}<ExternalLink size={14}/></a>}
            </div>
            {tracking[order.id]&&<div className="market-order-tracking-history">{tracking[order.id].status&&<strong>{tracking[order.id].status}</strong>}{tracking[order.id].history?.map((event,index)=><small key={`${event.updated_at}-${index}`}>{safeDate(event.updated_at??null,id)} {event.status||event.note}</small>)}</div>}
            {order.kind==='MARKET'&&['RECEIVED','COMPLETED'].includes(status)&&<OrderReview orderId={order.id} role={order.role} language={language}/>}
          </>}
        </div>}
      </article>})}</div>}
  </section>;
}
