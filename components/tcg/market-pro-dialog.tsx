'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {CrownIcon as Crown} from '@phosphor-icons/react';
import {formatMoney} from '@/packages/domain';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';

type PlanPreview={
  available:boolean;
  amount:number|null;
  standardAmount:number|null;
  durationDays:number|null;
  introOffer:boolean;
  maxActiveListings:number;
  freeMaxActiveListings:number;
  freeDurationDays:number;
  commissionPercent:number;
  freeCommissionPercent:number;
  buyerFeePercent:number;
  freeBuyerFeePercent:number;
  shippingVouchersPerMonth:number;
  shippingVoucherMinSubtotal:number;
  shippingVoucherSharePercent:number;
  shippingVoucherCap:number;
};

export function MarketProDialog({locale,member=false}:{locale:'EN'|'ID';member?:boolean}){
  const [open,setOpen]=useState(false);
  const [plan,setPlan]=useState<PlanPreview|null>(null);
  const [loading,setLoading]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const isId=locale==='ID';
  const t=(en:string,id:string)=>isId?id:en;

  useEffect(()=>{
    if(!open||loaded)return;
    let active=true;
    setLoading(true);
    fetch('/api/checkout/pro',{cache:'no-store'})
      .then(async response=>{
        if(!response.ok)throw new Error('Plan unavailable');
        const result=await response.json() as PlanPreview;
        if(active)setPlan(result);
      })
      .catch(()=>{if(active)setPlan(null)})
      .finally(()=>{if(active){setLoading(false);setLoaded(true)}});
    return()=>{active=false};
  },[open,loaded]);

  if(member)return null;

  const rows=[
    {label:t('Active listings','Listing aktif'),free:(plan?.freeMaxActiveListings??25).toLocaleString(isId?'id-ID':'en-US'),pro:(plan?.maxActiveListings??2500).toLocaleString(isId?'id-ID':'en-US')},
    {label:t('Listing period','Masa listing'),free:`${plan?.freeDurationDays??7} ${t('days','hari')}`,pro:`${plan?.durationDays??30} ${t('days','hari')}`},
    {label:t('Seller fee','Biaya penjual'),free:`${plan?.freeCommissionPercent??1.5}%`,pro:`${plan?.commissionPercent??0.75}%`},
    {label:t('Buyer fee','Biaya pembeli'),free:`${plan?.freeBuyerFeePercent??0.75}%`,pro:`${plan?.buyerFeePercent??0.5}%`},
    {label:t('Delivery vouchers','Voucher ongkir'),free:'—',pro:`${plan?.shippingVouchersPerMonth??2} ${t('per month','per bulan')}`},
  ];
  const amount=plan?.amount;

  return <>
    <button type="button" className="market-pro-nav-link" aria-label={t('Market Pro','Market Pro')} onClick={()=>setOpen(true)}><Crown size={15} aria-hidden="true"/><span className="market-pro-nav-long">Market Pro</span><span className="market-pro-nav-short">Pro</span></button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="market-pro-dialog">
        <DialogHeader className="market-pro-dialog-heading">
          <span className="market-pro-dialog-mark"><Crown size={19}/></span>
          <DialogTitle>Market Pro</DialogTitle>
          <DialogDescription>{t('Lower fees, more listings, and delivery vouchers.','Biaya lebih rendah, lebih banyak listing, dan voucher ongkir.')}</DialogDescription>
        </DialogHeader>
        <div className="market-pro-dialog-price">
          {loading?<span className="market-pro-dialog-loading" aria-live="polite">{t('Loading price…','Memuat harga…')}</span>:amount!==null&&amount!==undefined?<><strong>{formatMoney(amount,'IDR')}</strong><span>{t(`/ ${plan?.durationDays??30} days`,`/ ${plan?.durationDays??30} hari`)}</span>{plan?.introOffer&&plan.standardAmount!==null&&<small>{t(`First ${plan.durationDays??30} days, then ${formatMoney(plan.standardAmount,'IDR')} per 30 days.`,`30 hari pertama, lalu ${formatMoney(plan.standardAmount,'IDR')} per 30 hari.`)}</small>}</>:<span>{t('Plan details unavailable','Detail paket tidak tersedia')}</span>}
        </div>
        <div className="market-pro-dialog-table-wrap"><table className="market-pro-dialog-table"><thead><tr><th>{t('Benefit','Manfaat')}</th><th>{t('Free','Gratis')}</th><th>Pro</th></tr></thead><tbody>{rows.map(row=><tr key={row.label}><th scope="row">{row.label}</th><td>{row.free}</td><td>{row.pro}</td></tr>)}</tbody></table></div>
        <p className="market-pro-dialog-note">{t(`Each voucher covers ${plan?.shippingVoucherSharePercent??50}% of delivery, up to ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')}, on card orders of ${formatMoney(plan?.shippingVoucherMinSubtotal??200000,'IDR')} or more.`,`Setiap voucher memotong ${plan?.shippingVoucherSharePercent??50}% ongkir hingga ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')} untuk pesanan kartu minimal ${formatMoney(plan?.shippingVoucherMinSubtotal??200000,'IDR')}.`)}</p>
        <Link className="button market-pro-dialog-join" href="/checkout/pro" onClick={()=>setOpen(false)}>{plan?.available===false?t('View plan','Lihat paket'):t('Join Market Pro','Gabung Market Pro')}</Link>
      </DialogContent>
    </Dialog>
  </>;
}
