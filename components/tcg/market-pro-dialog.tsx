'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
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
  buyerFeeCap:number;
  shippingVouchersPerMonth:number;
  shippingVoucherMinSubtotal:number;
  shippingVoucherSharePercent:number;
  shippingVoucherCap:number;
};

export function MarketProDialog({locale,member=false,profile=null,accountLoading=false}:{locale:'EN'|'ID';member?:boolean;profile?:Record<string,unknown>|null;accountLoading?:boolean}){
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [plan,setPlan]=useState<PlanPreview|null>(null);
  const [loading,setLoading]=useState(false);
  const [joining,setJoining]=useState(false);
  const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);
  const isId=locale==='ID';
  const t=(en:string,id:string)=>isId?id:en;
  const route=(path:string)=>isId?`/id${path}`:path;

  const join=async()=>{
    if(!profile){
      setError(t('Sign in to continue.','Masuk untuk melanjutkan.'));
      window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));
      return;
    }
    const phone=String(profile.phone??'').replace(/[\s().-]/g,'');
    if(!/^\+?[0-9]{8,16}$/.test(phone)){
      setOpen(false);
      router.push(route('/profile'));
      return;
    }
    setJoining(true);setError('');
    try{
      const response=await fetch('/api/checkout/pro',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({introOffer:Boolean(plan?.introOffer)})});
      const result=await response.json() as {checkoutUrl?:string;error?:string};
      if(!response.ok||!result.checkoutUrl)throw new Error(result.error??t('Market Pro checkout is unavailable.','Checkout Market Pro tidak tersedia.'));
      setOpen(false);
      router.push(result.checkoutUrl.startsWith('/')?route(result.checkoutUrl):result.checkoutUrl);
    }catch(cause){setError(cause instanceof Error?cause.message:t('Market Pro checkout is unavailable.','Checkout Market Pro tidak tersedia.'))}
    finally{setJoining(false)}
  };

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
    {label:t('Seller fee','Biaya penjual'),free:`${plan?.freeCommissionPercent??0.75}%`,pro:`${plan?.commissionPercent??0.5}%`},
    {label:t('Buyer fee','Biaya pembeli'),free:`${plan?.freeBuyerFeePercent??1.5}%`,pro:`${plan?.buyerFeePercent??0.75}%`},
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
        <p className="market-pro-dialog-note">{t('Buyer fee caps: IDR 75,000 up to IDR 5m; IDR 150,000 up to IDR 10m; IDR 300,000 up to IDR 20m; IDR 500,000 up to IDR 50m; IDR 750,000 up to IDR 100m; IDR 1m up to IDR 250m; IDR 1.5m above.','Batas biaya pembeli: IDR 75.000 hingga IDR 5 juta; IDR 150.000 hingga IDR 10 juta; IDR 300.000 hingga IDR 20 juta; IDR 500.000 hingga IDR 50 juta; IDR 750.000 hingga IDR 100 juta; IDR 1 juta hingga IDR 250 juta; IDR 1,5 juta di atasnya.')}</p>
        <p className="market-pro-dialog-note">{t(`Each voucher covers ${plan?.shippingVoucherSharePercent??50}% of delivery, up to ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')}, on card orders of ${formatMoney(plan?.shippingVoucherMinSubtotal??200000,'IDR')} or more.`,`Setiap voucher memotong ${plan?.shippingVoucherSharePercent??50}% ongkir hingga ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')} untuk pesanan kartu minimal ${formatMoney(plan?.shippingVoucherMinSubtotal??200000,'IDR')}.`)}</p>
        {error&&<p className="checkout-error" role="alert">{error}</p>}
        {profile&&!/^\+?[0-9]{8,16}$/.test(String(profile.phone??'').replace(/[\s().-]/g,''))?<Link className="button market-pro-dialog-join" href={route('/profile')} onClick={()=>setOpen(false)}>{t('Add phone number','Tambahkan nomor telepon')}</Link>:<button type="button" className="button market-pro-dialog-join" disabled={joining||loading||accountLoading||plan?.available===false||amount==null} onClick={()=>void join()}>{joining?t('Opening checkout…','Membuka checkout…'):!profile&&!accountLoading?t('Sign in to join','Masuk untuk bergabung'):t('Join Market Pro','Gabung Market Pro')}</button>}
      </DialogContent>
    </Dialog>
  </>;
}
