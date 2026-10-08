'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import {formatMoney} from '@/packages/domain';
import {useAccount} from '@/lib/client';
import {toast} from 'sonner';

type Plan={available:boolean;amount:number|null;standardAmount:number|null;durationDays:number|null;introOffer:boolean;introOfferEndsAt:string|null;introOfferSpotsRemaining:number|null;maxActiveListings:number;freeMaxActiveListings:number;freeDurationDays:number;commissionPercent:number;freeCommissionPercent:number;buyerFeePercent:number;freeBuyerFeePercent:number;shippingVouchersPerMonth:number;shippingVoucherMinSubtotal:number;shippingVoucherSharePercent:number;shippingVoucherCap:number;canAutoRenew:boolean;freeCanAutoRenew:boolean;currency:'IDR'};
type MembershipOrder={id:string;status:string;amount:number;currency:string;createdAt:string;paidAt:string|null};

export function ProCheckout(){
  const router=useRouter();
  const {data:account,loading:accountLoading}=useAccount();
  const [planLoading,setPlanLoading]=useState(true);
  const [plan,setPlan]=useState<Plan>();
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  const [membershipOrders,setMembershipOrders]=useState<MembershipOrder[]>([]);
  const [monthlySales,setMonthlySales]=useState('0');
  const [monthlyPurchases,setMonthlyPurchases]=useState('0');
  const [averageDelivery,setAverageDelivery]=useState('10000');
  const [voucherCount,setVoucherCount]=useState('0');
  const [id,setId]=useState(false);

  useEffect(()=>{const sync=()=>setId(window.localStorage.getItem('vivreplay-locale')==='ID');const change=(event:Event)=>setId((event as CustomEvent<'EN'|'ID'>).detail==='ID');sync();window.addEventListener('vivreplay:locale',change);return()=>window.removeEventListener('vivreplay:locale',change)},[]);
  const t=(en:string,idText:string)=>id?idText:en;

  useEffect(()=>{
    if(accountLoading)return;
    let active=true;
    setPlanLoading(true);
    fetch('/api/checkout/pro',{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error('Market Pro is temporarily unavailable.');
      const result=await response.json() as Plan;
      if(active)setPlan(result);
    }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Market Pro is temporarily unavailable.')}).finally(()=>{if(active)setPlanLoading(false)});
    return()=>{active=false};
  },[accountLoading,account?.profile?.id]);

  useEffect(()=>{
    if(accountLoading||!account)return;
    let active=true;
    fetch('/api/checkout/pro/orders',{cache:'no-store'}).then(async response=>{
      if(!response.ok)return;
      const result=await response.json() as {orders?:MembershipOrder[]};
      if(active)setMembershipOrders(result.orders??[]);
    }).catch(()=>{});
    return()=>{active=false};
  },[accountLoading,account?.profile?.id]);

  const phone=String(account?.profile?.phone??'').replace(/[\s().-]/g,'');
  const hasPhone=/^\+?[0-9]{8,16}$/.test(phone);
  const begin=async()=>{
    if(!hasPhone){router.push('/profile');return;}
    setError('');setSubmitting(true);
    try{
      const response=await fetch('/api/checkout/pro',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({introOffer:Boolean(plan?.introOffer)})});
      const result=await response.json() as {checkoutUrl?:string;error?:string};
      if(!response.ok||!result.checkoutUrl)throw new Error(result.error??'Market Pro is temporarily unavailable.');
      router.push(result.checkoutUrl);
    }catch(cause){const message=cause instanceof Error?cause.message:'Market Pro is temporarily unavailable.';setError(message);toast.error(message)}finally{setSubmitting(false)}
  };

  if(accountLoading||planLoading)return <main className="page vivre-checkout-page pro-checkout-page"><div className="checkout-loading"><i/><span>{t('Loading Market Pro…','Memuat Market Pro…')}</span></div></main>;
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
  const alreadyPro=String(account?.profile?.tier??'free').toLowerCase()==='pro';
  const numberValue=(value:string)=>Math.max(0,Math.min(1_000_000_000_000,Number(value)||0));
  const sellerSavings=Math.round(numberValue(monthlySales)*Math.max(0,(plan?.freeCommissionPercent??1.5)-(plan?.commissionPercent??0.75))/100);
  const buyerSavings=Math.round(numberValue(monthlyPurchases)*Math.max(0,(plan?.freeBuyerFeePercent??0.75)-(plan?.buyerFeePercent??0.5))/100);
  const voucherSavings=Math.min(Math.max(0,Math.floor(Number(voucherCount)||0)),plan?.shippingVouchersPerMonth??2)*Math.min(Math.round(numberValue(averageDelivery)*(plan?.shippingVoucherSharePercent??50)/100),plan?.shippingVoucherCap??5000);
  const totalEstimatedSavings=sellerSavings+buyerSavings+voucherSavings;
  const estimatedAfterPlan=totalEstimatedSavings-(plan?.amount??plan?.standardAmount??0);
  const introEndLabel=plan?.introOfferEndsAt?new Intl.DateTimeFormat(id?'id-ID':'en-US',{dateStyle:'long',timeZone:'Asia/Jakarta'}).format(new Date(plan.introOfferEndsAt)):'';
  const moneyInput=(value:string,setValue:(next:string)=>void,label:string)=><label>{label}<input inputMode="numeric" type="number" min="0" step="100000" value={value} onChange={event=>setValue(event.target.value)} /></label>;
  const savingsCalculator=<details className="pro-savings-calculator">
    <summary><span><strong>{t('Estimate your monthly savings','Hitung perkiraan hemat per bulan')}</strong><small>{t('Try it with your usual Market activity.','Coba dengan aktivitas Market bulanan Anda.')}</small></span><span className="pro-calculator-toggle" aria-hidden="true">+</span></summary>
    <div className="pro-calculator-body">
      <div className="pro-calculator-inputs">
        {moneyInput(monthlySales,setMonthlySales,t('Cards you sell (IDR)','Nilai kartu yang dijual (IDR)'))}
        {moneyInput(monthlyPurchases,setMonthlyPurchases,t('Cards you buy (IDR)','Nilai kartu yang dibeli (IDR)'))}
        {moneyInput(averageDelivery,setAverageDelivery,t('Average delivery per eligible order','Rata-rata ongkir per pesanan yang memenuhi syarat'))}
        <label>{t('Vouchers you expect to use','Voucher yang diperkirakan dipakai')}<select value={voucherCount} onChange={event=>setVoucherCount(event.target.value)}>{Array.from({length:(plan?.shippingVouchersPerMonth??2)+1},(_,index)=><option key={index} value={index}>{index}</option>)}</select></label>
      </div>
      <dl className="pro-calculator-results">
        <div><dt>{t('Lower seller fees','Hemat biaya penjual')}</dt><dd>{formatMoney(sellerSavings,'IDR')}</dd></div>
        <div><dt>{t('Lower buyer fees','Hemat biaya pembeli')}</dt><dd>{formatMoney(buyerSavings,'IDR')}</dd></div>
        <div><dt>{t('Estimated vouchers','Perkiraan voucher')}</dt><dd>{formatMoney(voucherSavings,'IDR')}</dd></div>
        <div className="pro-calculator-total"><dt>{t('Estimated net benefit','Perkiraan manfaat bersih')}</dt><dd className={estimatedAfterPlan>=0?'is-positive':'is-negative'}>{estimatedAfterPlan>=0?'+':''}{formatMoney(estimatedAfterPlan,'IDR')}</dd></div>
      </dl>
      <small>{t('Estimate only. Vouchers require a card subtotal of at least IDR 200,000; actual delivery savings depend on the order.','Perkiraan saja. Voucher berlaku untuk subtotal kartu minimal IDR 200.000; hemat ongkir mengikuti biaya pesanan.')}</small>
    </div>
  </details>;

  const paymentDate=(value:string)=>new Intl.DateTimeFormat(id?'id-ID':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(`${value.replace(' ','T')}Z`));
  const membershipStatus=(status:string)=>status==='PAID'?t('Paid','Dibayar'):status==='PENDING_PAYMENT'?t('Awaiting payment','Menunggu pembayaran'):status==='EXPIRED'?t('Expired','Kedaluwarsa'):status==='CANCELLED'?t('Cancelled','Dibatalkan'):status==='PAYMENT_REVIEW'?t('Under review','Sedang diperiksa'):t('Processing','Diproses');

  return <main className="page vivre-checkout-page pro-checkout-page">
    <header className="pro-checkout-heading"><h1>Market Pro</h1><p>{t('Lower fees, more room to list, and delivery vouchers.','Biaya lebih rendah, batas listing lebih tinggi, dan voucher ongkir.')}</p></header>
    <div className="pro-checkout-grid">
      <section className="pro-benefits-panel" aria-labelledby="pro-comparison-title">
        <div className="pro-panel-heading"><div><h2 id="pro-comparison-title">{t('Free vs Pro','Gratis vs Pro')}</h2></div></div>
        <div className="pro-comparison-wrap"><table className="pro-comparison-table"><thead><tr><th scope="col">{t('What you get','Manfaat')}</th><th scope="col">{freeLabel}</th><th scope="col">{proLabel}</th></tr></thead><tbody>{rows.map(row=><tr key={row.label}><th scope="row">{row.label}</th><td>{row.free}</td><td>{row.pro}</td></tr>)}</tbody></table></div>
        <p className="pro-voucher-note">{t(`On card orders of ${formatMoney(plan?.shippingVoucherMinSubtotal??200000,'IDR')} or more, your ${plan?.shippingVouchersPerMonth??2} monthly vouchers each cover ${plan?.shippingVoucherSharePercent??50}% of delivery, up to ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')}. Applied automatically.`,`Untuk pesanan kartu minimal ${formatMoney(plan?.shippingVoucherMinSubtotal??200000,'IDR')}, ${plan?.shippingVouchersPerMonth??2} voucher bulanan masing-masing memotong ongkir ${plan?.shippingVoucherSharePercent??50}% hingga ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')}. Digunakan otomatis.`)}</p>
      </section>
      <aside className="pro-purchase-panel" aria-label={t('Market Pro price','Harga Market Pro')}>
        {plan?.available&&plan.amount&&plan.durationDays?<><p className="pro-purchase-price">{formatMoney(plan.amount,'IDR')}<small>{t(`/ ${plan.durationDays} days`,`/ ${plan.durationDays} hari`)}</small></p>{plan.introOffer?<><p className="pro-intro-price-note">{t(`${formatMoney(plan.amount,'IDR')} for your first ${plan.durationDays} days, then ${formatMoney(plan.standardAmount??24900,'IDR')} per 30 days. Renew manually.`,`${formatMoney(plan.amount,'IDR')} untuk ${plan.durationDays} hari pertama, lalu ${formatMoney(plan.standardAmount??24900,'IDR')} per 30 hari. Perpanjang manual.`)}</p><p className="pro-intro-limit-note">{t(`New members only · until ${introEndLabel} or the first 100 memberships, whichever comes first.`,`Khusus anggota baru · sampai ${introEndLabel} atau 100 keanggotaan pertama, mana yang lebih dulu.`)}</p></>:<p className="pro-purchase-caption">{t(`30-day membership. Renew manually when you want.`,`Keanggotaan 30 hari. Perpanjang manual saat Anda mau.`)}</p>}
          {!account?<button className="button pro-purchase-button" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}>{t('Sign in to continue','Masuk untuk melanjutkan')}</button>:alreadyPro?<div className="pro-current-state"><strong>{t('You already have Pro','Akun Anda sudah Pro')}</strong><p>{t('Your Pro membership is active.','Keanggotaan Pro Anda aktif.')}</p><Link className="button secondary pro-purchase-button" href="/profile">{t('Open Profile','Buka Profil')}</Link></div>:hasPhone?<button className="button pro-purchase-button" disabled={submitting} onClick={begin}>{submitting?t('Opening payment…','Membuka pembayaran…'):t('Get Market Pro','Dapatkan Market Pro')}</button>:<div className="pro-phone-required"><p>{t('Add a phone number to your profile before checkout.','Tambahkan nomor telepon di profil sebelum checkout.')}</p><Link className="button pro-purchase-button" href="/profile">{t('Add phone number','Tambahkan nomor telepon')}</Link></div>}
          <small className="pro-payment-note">{t('Your membership starts when payment clears.','Keanggotaan Anda aktif setelah pembayaran diterima.')}</small>
          {savingsCalculator}
        </>:<div className="pro-coming-soon"><strong>{t('Membership checkout is unavailable','Pembayaran keanggotaan tidak tersedia')}</strong><p>{t('Please try again later.','Silakan coba lagi nanti.')}</p></div>}
        {error&&<p className="checkout-error" role="alert">{error}</p>}
        <Link className="pro-back-link" href="/market">{t('Back to Market','Kembali ke Market')}</Link>
      </aside>
    </div>
    {!!membershipOrders.length&&<section className="pro-billing-history" aria-labelledby="pro-billing-title"><h2 id="pro-billing-title">{t('Membership payments','Pembayaran keanggotaan')}</h2><div>{membershipOrders.map(order=><Link className="pro-billing-row" href={`/checkout/order/${encodeURIComponent(order.id)}`} key={order.id}><span><strong>{paymentDate(order.paidAt??order.createdAt)}</strong><small>{membershipStatus(order.status)}</small></span><b>{formatMoney(order.amount,order.currency)}</b><span className="pro-billing-action">{order.status==='PENDING_PAYMENT'?t('Pay now','Bayar'):t('View payment','Lihat pembayaran')}</span></Link>)}</div></section>}
  </main>;
}
