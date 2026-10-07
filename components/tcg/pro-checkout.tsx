'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import {formatMoney} from '@/packages/domain';
import {useAccount} from '@/lib/client';
import {toast} from 'sonner';

type Plan={available:boolean;amount:number|null;durationDays:number|null;maxActiveListings:number;freeMaxActiveListings:number;freeDurationDays:number;commissionPercent:number;freeCommissionPercent:number;buyerFeePercent:number;freeBuyerFeePercent:number;shippingVouchersPerMonth:number;shippingVoucherMinSubtotal:number;shippingVoucherSharePercent:number;shippingVoucherCap:number;canAutoRenew:boolean;freeCanAutoRenew:boolean;currency:'IDR'};

export function ProCheckout(){
  const router=useRouter();
  const {data:account,loading:accountLoading}=useAccount();
  const [planLoading,setPlanLoading]=useState(true);
  const [plan,setPlan]=useState<Plan>();
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  const [id,setId]=useState(false);

  useEffect(()=>{const sync=()=>setId(window.localStorage.getItem('vivreplay-locale')==='ID');const change=(event:Event)=>setId((event as CustomEvent<'EN'|'ID'>).detail==='ID');sync();window.addEventListener('vivreplay:locale',change);return()=>window.removeEventListener('vivreplay:locale',change)},[]);
  const t=(en:string,idText:string)=>id?idText:en;

  useEffect(()=>{
    fetch('/api/checkout/pro').then(async response=>{
      if(!response.ok)throw new Error('Market Pro is temporarily unavailable.');
      setPlan(await response.json() as Plan);
    }).catch(cause=>setError(cause instanceof Error?cause.message:'Market Pro is temporarily unavailable.')).finally(()=>setPlanLoading(false));
  },[]);

  const phone=String(account?.profile?.phone??'').replace(/[\s().-]/g,'');
  const hasPhone=/^\+?[0-9]{8,16}$/.test(phone);
  const begin=async()=>{
    if(!hasPhone){router.push('/profile');return;}
    setError('');setSubmitting(true);
    try{
      const response=await fetch('/api/checkout/pro',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
      const result=await response.json() as {checkoutUrl?:string;error?:string};
      if(!response.ok||!result.checkoutUrl)throw new Error(result.error??'Market Pro is temporarily unavailable.');
      router.push(result.checkoutUrl);
    }catch(cause){const message=cause instanceof Error?cause.message:'Market Pro is temporarily unavailable.';setError(message);toast.error(message)}finally{setSubmitting(false)}
  };

  if(accountLoading||planLoading)return <main className="page vivre-checkout-page pro-checkout-page"><div className="checkout-loading"><i/><span>{t('Loading Market Pro…','Memuat Market Pro…')}</span></div></main>;
  if(!account)return <main className="page vivre-checkout-page pro-checkout-page"><section className="pro-signin-card"><p className="eyebrow">MARKET MEMBERSHIP</p><h1>Market Pro</h1><p>{t('Sign in to compare plans and upgrade your account.','Masuk untuk membandingkan paket dan meningkatkan akun.')}</p><button className="button" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}>{t('Sign in','Masuk')}</button></section></main>;

  const freeLabel=t('Free','Gratis');
  const proLabel='Pro';
  const rows=[
    {label:t('Active listings','Listing aktif'),free:(plan?.freeMaxActiveListings??25).toLocaleString(id?'id-ID':'en-US'),pro:(plan?.maxActiveListings??2500).toLocaleString(id?'id-ID':'en-US')},
    {label:t('Listing period','Masa listing'),free:`${plan?.freeDurationDays??7} ${t('days','hari')}`,pro:`${plan?.durationDays??30} ${t('days','hari')}`},
    {label:t('Seller fee','Biaya penjual'),free:`${plan?.freeCommissionPercent??1.5}%`,pro:`${plan?.commissionPercent??0.75}%`},
    {label:t('Buyer fee','Biaya pembeli'),free:`${plan?.freeBuyerFeePercent??0.75}%`,pro:`${plan?.buyerFeePercent??0.5}%`},
    {label:t('Shipping vouchers','Voucher ongkir'),free:t('—','—'),pro:`${plan?.shippingVouchersPerMonth??2} ${t('per month','per bulan')}`},
    {label:t('Listing auto-renewal','Perpanjangan listing otomatis'),free:plan?.freeCanAutoRenew?t('Automatic','Otomatis'):t('Manual','Manual'),pro:plan?.canAutoRenew?t('Automatic','Otomatis'):t('Manual','Manual')},
  ];
  const alreadyPro=String(account.profile.tier??'free').toLowerCase()==='pro';

  return <main className="page vivre-checkout-page pro-checkout-page">
    <header className="pro-checkout-heading"><h1>Market Pro</h1><p>{t('Lower fees, more room to list, and delivery vouchers.','Biaya lebih rendah, batas listing lebih tinggi, dan voucher ongkir.')}</p></header>
    <div className="pro-checkout-grid">
      <section className="pro-benefits-panel" aria-labelledby="pro-comparison-title">
        <div className="pro-panel-heading"><div><h2 id="pro-comparison-title">{t('Free vs Pro','Gratis vs Pro')}</h2></div></div>
        <div className="pro-comparison-wrap"><table className="pro-comparison-table"><thead><tr><th scope="col">{t('What you get','Manfaat')}</th><th scope="col">{freeLabel}</th><th scope="col">{proLabel}</th></tr></thead><tbody>{rows.map(row=><tr key={row.label}><th scope="row">{row.label}</th><td>{row.free}</td><td>{row.pro}</td></tr>)}</tbody></table></div>
        <p className="pro-voucher-note">{t(`Each voucher takes ${plan?.shippingVoucherSharePercent??50}% off delivery, up to ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')}, on orders with at least ${formatMoney(plan?.shippingVoucherMinSubtotal??200000,'IDR')} in cards.`,`Setiap voucher memotong ongkir ${plan?.shippingVoucherSharePercent??50}%, maksimal ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')}, untuk pesanan dengan nilai kartu minimal ${formatMoney(plan?.shippingVoucherMinSubtotal??200000,'IDR')}.`)}</p>
        <p className="pro-market-scope">{t('Pro works for buying and selling. Vouchers are applied automatically to eligible orders.','Pro berlaku saat membeli maupun menjual. Voucher otomatis dipakai pada pesanan yang memenuhi syarat.')}</p>
      </section>
      <aside className="pro-purchase-panel" aria-label={t('Market Pro price','Harga Market Pro')}>
        <p className="pro-purchase-kicker">{t('30-day membership','Keanggotaan 30 hari')}</p>
        {plan?.available&&plan.amount&&plan.durationDays?<><p className="pro-purchase-price">{formatMoney(plan.amount,'IDR')}<small>/{plan.durationDays} {t('days','hari')}</small></p><p className="pro-purchase-caption">{t(`One-time payment for ${plan.durationDays} days.`,`Bayar sekali untuk ${plan.durationDays} hari.`)}</p>
          {alreadyPro?<div className="pro-current-state"><strong>{t('You already have Pro','Akun Anda sudah Pro')}</strong><p>{t('Your Pro membership is active.','Keanggotaan Pro Anda aktif.')}</p><Link className="button secondary pro-purchase-button" href="/profile">{t('Open Profile','Buka Profil')}</Link></div>:hasPhone?<button className="button pro-purchase-button" disabled={submitting} onClick={begin}>{submitting?t('Opening payment…','Membuka pembayaran…'):t('Get Market Pro','Dapatkan Market Pro')}</button>:<div className="pro-phone-required"><p>{t('Add a phone number to your profile before checkout.','Tambahkan nomor telepon di profil sebelum checkout.')}</p><Link className="button pro-purchase-button" href="/profile">{t('Add phone number','Tambahkan nomor telepon')}</Link></div>}
          <small className="pro-payment-note">{t('Your membership starts when payment clears.','Keanggotaan Anda aktif setelah pembayaran diterima.')}</small>
        </>:<div className="pro-coming-soon"><strong>{t('Membership checkout is unavailable','Pembayaran keanggotaan tidak tersedia')}</strong><p>{t('Please try again later.','Silakan coba lagi nanti.')}</p></div>}
        {error&&<p className="checkout-error" role="alert">{error}</p>}
        <Link className="pro-back-link" href="/market">{t('Back to Market','Kembali ke Market')}</Link>
      </aside>
    </div>
  </main>;
}
