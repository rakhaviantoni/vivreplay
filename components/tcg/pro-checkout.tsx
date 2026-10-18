'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import {formatMoney} from '@/packages/domain';
import {calculateBuyerServiceFee,calculateSellerServiceFee,MARKET_BUYER_FEE_MINIMUM,MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL} from '@/lib/market/policy';
import {MarketServiceFeeInfo} from '@/components/tcg/market-buyer-fee-cap-table';
import {useAccount} from '@/lib/client';
import {toast} from 'sonner';
import {MarketPaymentMethodPicker,defaultPaymentOptions,estimatePaymentFee,type PaymentMethod,type PaymentOption} from '@/components/tcg/market-payment-method-picker';

type Plan={available:boolean;paymentChannels?:PaymentOption[];amount:number|null;standardAmount:number|null;durationDays:number|null;annualAmount:number;annualDurationDays:number;introOffer:boolean;introOfferEndsAt:string|null;introOfferLimit:number|null;introOfferSpotsRemaining:number|null;maxActiveListings:number;freeMaxActiveListings:number;freeDurationDays:number;commissionPercent:number;freeCommissionPercent:number;sellerFeeMinimum:number;buyerFeePercent:number;freeBuyerFeePercent:number;buyerFeeCap:number;buyerFeeMinimum:number;shippingVouchersPerMonth:number;shippingVouchersPerYear:number;shippingVoucherMinSubtotal:number;shippingVoucherSharePercent:number;shippingVoucherCap:number;canAutoRenew:boolean;freeCanAutoRenew:boolean;currency:'IDR'};
type MembershipOrder={id:string;status:string;amount:number;currency:string;createdAt:string;paidAt:string|null};

export function ProCheckout(){
  const router=useRouter();
  const {data:account,loading:accountLoading}=useAccount();
  const [planLoading,setPlanLoading]=useState(true);
  const [plan,setPlan]=useState<Plan>();
  const [submitting,setSubmitting]=useState(false);
  const [selectedPayment,setSelectedPayment]=useState<{method:PaymentMethod;channel:string}>({method:'qris',channel:'mpm'});
  const [billingPeriod,setBillingPeriod]=useState<'monthly'|'yearly'>('monthly');
  const [error,setError]=useState('');
  const [membershipOrders,setMembershipOrders]=useState<MembershipOrder[]>([]);
  const [monthlySales,setMonthlySales]=useState('0');
  const [monthlySaleCount,setMonthlySaleCount]=useState('2');
  const [monthlyPurchases,setMonthlyPurchases]=useState('0');
  const [monthlyPurchaseCount,setMonthlyPurchaseCount]=useState('2');
  const [averageDelivery,setAverageDelivery]=useState('10000');
  const [voucherCount,setVoucherCount]=useState('0');
  const [id,setId]=useState(false);

  useEffect(()=>{const sync=()=>setId(window.localStorage.getItem('vivreplay-locale')==='ID');const change=(event:Event)=>setId((event as CustomEvent<'EN'|'ID'>).detail==='ID');sync();window.addEventListener('vivreplay:locale',change);return()=>window.removeEventListener('vivreplay:locale',change)},[]);
  const t=(en:string,idText:string)=>id?idText:en;

  useEffect(()=>{
    if(accountLoading)return;
    let active=true;
    fetch('/api/checkout/pro',{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error('Market Pro is temporarily unavailable.');
      const result=await response.json() as Plan;
      if(active){setPlan(result);if(String(account?.profile?.tier??'free').toLowerCase()==='pro')setBillingPeriod('yearly');const options=Array.isArray(result.paymentChannels)?result.paymentChannels:defaultPaymentOptions;const preferred=options.find(option=>option.method==='qris')??options[0];if(preferred)setSelectedPayment({method:preferred.method,channel:preferred.channel})}
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
    if(alreadyPro&&billingPeriod!=='yearly'){setError(t('Choose Pro+ yearly to extend your current membership.','Pilih Pro+ tahunan untuk memperpanjang keanggotaan Anda.'));return;}
    if(!selectedPaymentOption){setError(t('Choose an available payment method to continue.','Pilih metode pembayaran yang tersedia untuk melanjutkan.'));return;}
    setError('');setSubmitting(true);
    try{
      const response=await fetch('/api/checkout/pro',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({billingPeriod,introOffer:billingPeriod==='monthly'&&Boolean(plan?.introOffer),paymentMethod:selectedPayment.method,paymentChannel:selectedPayment.channel})});
      const result=await response.json() as {checkoutUrl?:string;error?:string};
      if(!response.ok||!result.checkoutUrl)throw new Error(result.error??'Market Pro is temporarily unavailable.');
      router.push(result.checkoutUrl);
    }catch(cause){const message=cause instanceof Error?cause.message:'Market Pro is temporarily unavailable.';setError(message);toast.error(message)}finally{setSubmitting(false)}
  };

  if(accountLoading||planLoading)return <main className="page vivre-checkout-page pro-checkout-page"><div className="checkout-loading"><i/><span>{t('Loading Market Pro…','Memuat Market Pro…')}</span></div></main>;
  const freeLabel=t('Free','Gratis');
  const proLabel='Pro';
  const rows=[
    {key:'listings',label:t('Active listings','Listing aktif'),free:(plan?.freeMaxActiveListings??25).toLocaleString(id?'id-ID':'en-US'),pro:(plan?.maxActiveListings??2500).toLocaleString(id?'id-ID':'en-US')},
    {key:'period',label:t('Listing period','Masa listing'),free:`${plan?.freeDurationDays??7} ${t('days','hari')}`,pro:`${plan?.durationDays??30} ${t('days','hari')}`},
    {key:'service-fee',label:<span className="buyer-fee-row-label">{t('Market service fee','Biaya layanan Market')}<MarketServiceFeeInfo locale={id?'id':'en'} freePercent={plan?.freeCommissionPercent??1.5} proPercent={plan?.commissionPercent??0.75} buyerMinimum={plan?.buyerFeeMinimum??2_000} sellerMinimum={plan?.sellerFeeMinimum??1_000}/></span>,free:`${plan?.freeCommissionPercent??1.5}%`,pro:`${plan?.commissionPercent??0.75}%`},
    {key:'vouchers',label:t('Shipping vouchers','Voucher ongkir'),free:t('—','—'),pro:billingPeriod==='yearly'?`${plan?.shippingVouchersPerYear??24} ${t('during the year','selama setahun')}`:`${plan?.shippingVouchersPerMonth??2} ${t('per month','per bulan')}`},
    {key:'renewal',label:t('Listing auto-renewal','Perpanjangan listing otomatis'),free:plan?.freeCanAutoRenew?t('Automatic','Otomatis'):t('Manual','Manual'),pro:plan?.canAutoRenew?t('Automatic','Otomatis'):t('Manual','Manual')},
  ];
  const alreadyPro=String(account?.profile?.tier??'free').toLowerCase()==='pro';
  const selectedAmount=billingPeriod==='yearly'?(plan?.annualAmount??null):plan?.amount;
  const selectedDuration=billingPeriod==='yearly'?(plan?.annualDurationDays??365):plan?.durationDays;
  const selectedIntro=billingPeriod==='monthly'&&Boolean(plan?.introOffer);
  const paymentOptions=Array.isArray(plan?.paymentChannels)?plan.paymentChannels:defaultPaymentOptions;
  const selectedPaymentOption=paymentOptions.find(option=>option.method===selectedPayment.method&&option.channel===selectedPayment.channel);
  const paymentFee=estimatePaymentFee(selectedPaymentOption,selectedAmount??0);
  const paymentTotal=(selectedAmount??0)+paymentFee;
  const numberValue=(value:string)=>Math.max(0,Math.min(1_000_000_000_000,Number(value)||0));
  const saleCount=Math.max(1,Math.min(100,Math.floor(Number(monthlySaleCount)||1)));
  const averageSaleSubtotal=numberValue(monthlySales)/saleCount;
  const sellerSavings=saleCount*Math.max(0,calculateSellerServiceFee(averageSaleSubtotal,plan?.freeCommissionPercent??1.5,plan?.sellerFeeMinimum)-calculateSellerServiceFee(averageSaleSubtotal,plan?.commissionPercent??0.75,plan?.sellerFeeMinimum));
  const purchaseCount=Math.max(1,Math.min(100,Math.floor(Number(monthlyPurchaseCount)||1)));
  const averagePurchaseSubtotal=numberValue(monthlyPurchases)/purchaseCount;
  const buyerSavings=purchaseCount*Math.max(0,calculateBuyerServiceFee(averagePurchaseSubtotal,plan?.freeCommissionPercent??1.5,plan?.buyerFeeMinimum??MARKET_BUYER_FEE_MINIMUM)-calculateBuyerServiceFee(averagePurchaseSubtotal,plan?.commissionPercent??0.75,plan?.buyerFeeMinimum??MARKET_BUYER_FEE_MINIMUM));
  const voucherLimit=billingPeriod==='yearly'?(plan?.shippingVouchersPerYear??24):(plan?.shippingVouchersPerMonth??2);
  const voucherSavings=Math.min(Math.max(0,Math.floor(Number(voucherCount)||0)),voucherLimit)*Math.min(Math.round(numberValue(averageDelivery)*(plan?.shippingVoucherSharePercent??100)/100),plan?.shippingVoucherCap??10000);
  const estimateMultiplier=billingPeriod==='yearly'?12:1;
  const displayedSellerSavings=sellerSavings*estimateMultiplier;
  const displayedBuyerSavings=buyerSavings*estimateMultiplier;
  const totalEstimatedSavings=displayedSellerSavings+displayedBuyerSavings+voucherSavings;
  const estimatedAfterPlan=totalEstimatedSavings-(billingPeriod==='yearly'?(plan?.annualAmount??0):(plan?.amount??plan?.standardAmount??0));
  const introEndLabel=plan?.introOfferEndsAt?new Intl.DateTimeFormat(id?'id-ID':'en-US',{dateStyle:'long',timeZone:'Asia/Jakarta'}).format(new Date(plan.introOfferEndsAt)):'';
  const introLimit=plan?.introOfferLimit??null;
  const introSpotsRemaining=plan?.introOfferSpotsRemaining??null;
  const introClaimed=introLimit&&introSpotsRemaining!==null?Math.max(0,introLimit-introSpotsRemaining):0;
  const moneyInput=(value:string,setValue:(next:string)=>void,label:string)=><label>{label}<input inputMode="numeric" type="number" min="0" step="100000" value={value} onChange={event=>setValue(event.target.value)} /></label>;

  const paymentDate=(value:string)=>new Intl.DateTimeFormat(id?'id-ID':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(`${value.replace(' ','T')}Z`));
  const membershipStatus=(status:string)=>status==='PAID'?t('Paid','Dibayar'):status==='PENDING_PAYMENT'?t('Awaiting payment','Menunggu pembayaran'):status==='EXPIRED'?t('Expired','Kedaluwarsa'):status==='CANCELLED'?t('Cancelled','Dibatalkan'):status==='PAYMENT_REVIEW'?t('Under review','Sedang diperiksa'):t('Processing','Diproses');

  return <main className="page vivre-checkout-page pro-checkout-page">
    <header className="pro-checkout-heading"><h1>Market Pro</h1><p>{t('Lower fees, more room to list, and delivery vouchers.','Biaya lebih rendah, batas listing lebih tinggi, dan voucher ongkir.')}</p></header>
    <div className="pro-checkout-grid">
      <section className="pro-benefits-panel" aria-labelledby="pro-comparison-title">
        <div className="pro-panel-heading"><div><h2 id="pro-comparison-title">{t('Free vs Pro','Gratis vs Pro')}</h2></div></div>
        <div className="pro-comparison-wrap"><table className="pro-comparison-table"><thead><tr><th scope="col">{t('What you get','Manfaat')}</th><th scope="col">{freeLabel}</th><th scope="col">{proLabel}</th></tr></thead><tbody>{rows.map(row=><tr key={row.key}><th scope="row">{row.label}</th><td>{row.free}</td><td>{row.pro}</td></tr>)}</tbody></table></div>
        <p className="pro-voucher-note">{billingPeriod==='yearly'?t(`Pro+ includes ${plan?.shippingVouchersPerYear??24} vouchers for the full 365-day term. Use them any time; unused vouchers expire when the plan ends. Each covers ${plan?.shippingVoucherSharePercent??50}% of delivery, up to ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')}, on card orders of ${formatMoney(plan?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,'IDR')} or more.`,`Pro+ mencakup ${plan?.shippingVouchersPerYear??24} voucher selama 365 hari. Gunakan kapan saja; sisa voucher kedaluwarsa saat paket berakhir. Setiap voucher menanggung ${plan?.shippingVoucherSharePercent??50}% ongkir, maksimal ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')}, untuk pesanan kartu minimal ${formatMoney(plan?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,'IDR')}.`):t(`Monthly Pro includes ${plan?.shippingVouchersPerMonth??2} vouchers per calendar month. Unused vouchers expire at month end. Each covers ${plan?.shippingVoucherSharePercent??50}% of delivery, up to ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')} each, on card orders of ${formatMoney(plan?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,'IDR')} or more.`,`Pro bulanan mendapat ${plan?.shippingVouchersPerMonth??2} voucher setiap bulan kalender. Sisa voucher kedaluwarsa pada akhir bulan. Setiap voucher menanggung ${plan?.shippingVoucherSharePercent??50}% ongkir, maksimal ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')}, untuk pesanan kartu minimal ${formatMoney(plan?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,'IDR')}.`)}</p>
        <section className="pro-savings-calculator" aria-labelledby="pro-calculator-title">
          <header><h3 id="pro-calculator-title">{billingPeriod==='yearly'?t('Estimate your yearly savings','Hitung perkiraan hemat per tahun'):t('Estimate your monthly savings','Hitung perkiraan hemat per bulan')}</h3><p>{t('Use your typical monthly Market activity.','Masukkan perkiraan aktivitas Market bulanan Anda.')}</p></header>
          <div className="pro-calculator-inputs">
            {moneyInput(monthlySales,setMonthlySales,t('Cards you sell (IDR)','Nilai kartu yang dijual (IDR)'))}
            <label>{t('Sales per month','Jumlah pesanan jual per bulan')}<input inputMode="numeric" type="number" min="1" max="100" step="1" value={monthlySaleCount} onChange={event=>setMonthlySaleCount(event.target.value)} /></label>
            {moneyInput(monthlyPurchases,setMonthlyPurchases,t('Cards you buy (IDR)','Nilai kartu yang dibeli (IDR)'))}
            <label>{t('Purchase orders per month','Jumlah pesanan beli per bulan')}<input inputMode="numeric" type="number" min="1" max="100" step="1" value={monthlyPurchaseCount} onChange={event=>setMonthlyPurchaseCount(event.target.value)} /></label>
            {moneyInput(averageDelivery,setAverageDelivery,t('Average delivery per eligible order','Rata-rata ongkir per pesanan yang memenuhi syarat'))}
            <label>{billingPeriod==='yearly'?t('Vouchers used this year','Voucher yang dipakai tahun ini'):t('Vouchers used this month','Voucher yang dipakai bulan ini')}<select value={voucherCount} onChange={event=>setVoucherCount(event.target.value)}>{Array.from({length:voucherLimit+1},(_,index)=><option key={index} value={index}>{index}</option>)}</select></label>
          </div>
          <dl className="pro-calculator-results">
            <div><dt>{t('Savings on sales','Penghematan saat menjual')}</dt><dd>{formatMoney(displayedSellerSavings,'IDR')}</dd></div>
            <div><dt>{t('Savings on purchases','Penghematan saat membeli')}</dt><dd>{formatMoney(displayedBuyerSavings,'IDR')}</dd></div>
            <div><dt>{t('Estimated vouchers','Perkiraan voucher')}</dt><dd>{formatMoney(voucherSavings,'IDR')}</dd></div>
            <div className="pro-calculator-total"><dt>{billingPeriod==='yearly'?t('After annual price','Setelah harga tahunan'):t('After monthly price','Setelah harga bulanan')}</dt><dd className={estimatedAfterPlan>=0?'is-positive':'is-negative'}>{estimatedAfterPlan>=0?'+':''}{formatMoney(estimatedAfterPlan,'IDR')}</dd></div>
          </dl>
          <small>{billingPeriod==='yearly'?t('Buying and selling savings use your monthly activity multiplied by 12. Voucher savings use the number you expect to spend from the annual pool.','Penghematan jual beli memakai aktivitas bulanan dikalikan 12. Penghematan voucher dihitung dari jumlah yang akan dipakai dari kuota tahunan.') : t('Estimate uses your monthly card totals divided across each order. Unused monthly vouchers expire at month end.','Perkiraan memakai total kartu bulanan yang dibagi ke setiap pesanan. Voucher bulanan yang tidak dipakai kedaluwarsa pada akhir bulan.')}</small>
          {plan?.introOffer&&<small>{t(`Estimate uses the launch price of ${formatMoney(plan.amount??19900,'IDR')}.`,`Perkiraan memakai harga promo ${formatMoney(plan.amount??19900,'IDR')}.`)}</small>}
        </section>
      </section>
      <aside className="pro-purchase-panel" aria-label={t('Market Pro price','Harga Market Pro')}>
        {plan?.available&&selectedAmount&&selectedDuration?<><div className="market-pro-billing-toggle" role="group" aria-label={t('Membership period','Masa keanggotaan')}><button type="button" aria-pressed={billingPeriod==='monthly'} disabled={alreadyPro} onClick={()=>setBillingPeriod('monthly')}>{t('Monthly','Bulanan')}</button><button type="button" aria-pressed={billingPeriod==='yearly'} onClick={()=>setBillingPeriod('yearly')}>{alreadyPro?t('Extend for a year','Perpanjang setahun'):t('Pro+ yearly','Pro+ tahunan')}</button></div><p className="pro-purchase-price">{formatMoney(selectedIntro?plan.amount??selectedAmount:selectedAmount,'IDR')}<small>{t(`/ ${selectedDuration} days`,`/ ${selectedDuration} hari`)}</small></p>{billingPeriod==='yearly'?<p className="pro-purchase-caption">{t(`One payment for 365 days. The launch price applies to monthly Pro only. Your ${plan.shippingVouchersPerYear} vouchers are available throughout the year and expire with the plan.`,`Satu pembayaran untuk 365 hari. Harga promo hanya berlaku untuk Pro bulanan. ${plan.shippingVouchersPerYear} voucher dapat digunakan sepanjang tahun dan sisa voucher kedaluwarsa bersama paket.`)}{Math.max(0,(plan.standardAmount??plan.amount??0)*12-(plan.annualAmount??0))>0?` ${t(`Save ${formatMoney((plan.standardAmount??plan.amount??0)*12-(plan.annualAmount??0),'IDR')} compared with monthly billing.`,`Hemat ${formatMoney((plan.standardAmount??plan.amount??0)*12-(plan.annualAmount??0),'IDR')} dibandingkan pembayaran bulanan.`)}`:''}</p>:selectedIntro?<><p className="pro-intro-price-note">{t(`Intro price for ${plan.durationDays} days. Then ${formatMoney(plan.standardAmount??24900,'IDR')} per 30 days. Renew manually.`,`Harga perkenalan berlaku ${plan.durationDays} hari. Setelah itu ${formatMoney(plan.standardAmount??24900,'IDR')} per 30 hari. Perpanjangan dilakukan manual.`)}</p>{introLimit&&<div className="pro-intro-limit-note"><div><span>{t(`${introClaimed} of ${introLimit} intro memberships claimed`,`${introClaimed} dari ${introLimit} keanggotaan harga perkenalan terpakai`)}</span>{introSpotsRemaining!==null&&<strong>{t(`${introSpotsRemaining} left`,`tersisa ${introSpotsRemaining}`)}</strong>}</div><progress max={introLimit} value={introClaimed} aria-label={t(`${introClaimed} of ${introLimit} intro memberships claimed`,`${introClaimed} dari ${introLimit} keanggotaan harga perkenalan terpakai`)}/>{introEndLabel&&<small>{t(`Offer ends ${introEndLabel}`,`Promo berakhir ${introEndLabel}`)}</small>}</div>}{!introLimit&&introEndLabel&&<p className="pro-intro-limit-note">{t(`Offer ends ${introEndLabel}.`,`Promo berakhir ${introEndLabel}.`)}</p>}</>:<p className="pro-purchase-caption">{t(`${selectedDuration}-day membership. Renew manually when you want.`,`Keanggotaan ${selectedDuration} hari. Perpanjangan dilakukan manual.`)}</p>}
          {account&&(!alreadyPro||billingPeriod==='yearly')&&hasPhone&&<><MarketPaymentMethodPicker locale={id?'ID':'EN'} options={paymentOptions} amount={selectedAmount} selectedMethod={selectedPayment.method} selectedChannel={selectedPayment.channel} onChange={(method,channel)=>setSelectedPayment({method,channel})}/>{paymentFee>0&&<div className="pro-payment-total"><span>{t('Estimated payment fee','Perkiraan biaya pembayaran')}</span><strong>{formatMoney(paymentFee,'IDR')}</strong><span>{t('Estimated total','Perkiraan total')}</span><strong>{formatMoney(paymentTotal,'IDR')}</strong></div>}</>}
          {!account?<button className="button pro-purchase-button" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}>{t('Sign in to continue','Masuk untuk melanjutkan')}</button>:alreadyPro?<div className="pro-current-state"><strong>{t('You already have Pro','Akun Anda sudah Pro')}</strong><p>{t('Your current membership stays active. The annual term starts after it ends.','Keanggotaan saat ini tetap aktif. Masa tahunan dimulai setelah masa tersebut berakhir.')}</p>{hasPhone&&<button className="button pro-purchase-button" disabled={submitting||!selectedPaymentOption} onClick={begin}>{submitting?t('Opening payment…','Membuka pembayaran…'):t('Extend with Pro+ yearly','Perpanjang dengan Pro+ tahunan')}</button>}</div>:hasPhone?<button className="button pro-purchase-button" disabled={submitting||!selectedPaymentOption} onClick={begin}>{submitting?t('Opening payment…','Membuka pembayaran…'):billingPeriod==='yearly'?t('Get Pro+ yearly','Pilih Pro+ tahunan'):t('Get Market Pro','Dapatkan Market Pro')}</button>:<div className="pro-phone-required"><p>{t('Add a phone number to your profile before checkout.','Tambahkan nomor telepon di profil sebelum checkout.')}</p><Link className="button pro-purchase-button" href="/profile">{t('Add phone number','Tambahkan nomor telepon')}</Link></div>}
          <small className="pro-payment-note">{t('Your membership starts when payment clears.','Keanggotaan Anda aktif setelah pembayaran diterima.')}</small>
        </>:<div className="pro-coming-soon"><strong>{t('Membership checkout is unavailable','Pembayaran keanggotaan tidak tersedia')}</strong><p>{t('Please try again later.','Silakan coba lagi nanti.')}</p></div>}
        {error&&<p className="checkout-error" role="alert">{error}</p>}
        <Link className="pro-back-link" href="/market">{t('Back to Market','Kembali ke Market')}</Link>
      </aside>
    </div>
    {!!membershipOrders.length&&<section className="pro-billing-history" id="membership-payments" aria-labelledby="pro-billing-title"><h2 id="pro-billing-title">{t('Membership payments','Pembayaran keanggotaan')}</h2><div>{membershipOrders.map(order=><Link className="pro-billing-row" href={`/checkout/order/${encodeURIComponent(order.id)}`} key={order.id}><span><strong>{paymentDate(order.paidAt??order.createdAt)}</strong><small>{membershipStatus(order.status)}</small></span><b>{formatMoney(order.amount,order.currency)}</b><span className="pro-billing-action">{order.status==='PENDING_PAYMENT'?t('Pay now','Bayar'):t('View payment','Lihat pembayaran')}</span></Link>)}</div></section>}
  </main>;
}
