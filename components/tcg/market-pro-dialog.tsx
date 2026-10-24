'use client';

import Link from '@/components/ui/localized-link';
import {useLocalizedRouter as useRouter} from '@/lib/use-localized-router';
import {useEffect,useState} from 'react';
import {CrownIcon as Crown} from '@phosphor-icons/react';
import {formatMoney} from '@/packages/domain';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL} from '@/lib/market/policy';
import {MarketPaymentMethodPicker,defaultPaymentOptions,estimatePaymentFee,type PaymentMethod,type PaymentOption} from '@/components/tcg/market-payment-method-picker';
import {MarketIntroOfferProgress} from '@/components/tcg/market-intro-offer-progress';
import {MarketMembershipComparison} from '@/components/tcg/market-membership-comparison';

type PlanPreview={
  available:boolean;
  paymentChannels?:PaymentOption[];
  amount:number|null;
  standardAmount:number|null;
  durationDays:number|null;
  annualAmount:number;
  annualDurationDays:number;
  introOffer:boolean;
  introOfferEndsAt:string|null;
  introOfferLimit:number|null;
  introOfferSpotsRemaining:number|null;
  maxActiveListings:number;
  freeMaxActiveListings:number;
  annualMaxActiveListings:number;
  freeDurationDays:number;
  annualDurationDaysForListings:number;
  freeListingLimits:{maxListingCopies:number;maxCopiesPerCard:number;maxCardTypes:number};
  monthlyListingLimits:{maxListingCopies:number;maxCopiesPerCard:number;maxCardTypes:number};
  annualListingLimits:{maxListingCopies:number;maxCopiesPerCard:number;maxCardTypes:number};
  commissionPercent:number;
  freeCommissionPercent:number;
  buyerFeePercent:number;
  freeBuyerFeePercent:number;
  buyerFeeCap:number;
  buyerFeeMinimum:number;
  sellerFeeMinimum:number;
  shippingVouchersPerMonth:number;
  shippingVouchersPerYear:number;
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
  const [planError,setPlanError]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [selectedPayment,setSelectedPayment]=useState<{method:PaymentMethod;channel:string}>({method:'qris',channel:'mpm'});
  const [billingPeriod,setBillingPeriod]=useState<'monthly'|'yearly'>('monthly');
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
      const response=await fetch('/api/checkout/pro',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({billingPeriod,introOffer:billingPeriod==='monthly'&&Boolean(plan?.introOffer),paymentMethod:selectedPayment.method,paymentChannel:selectedPayment.channel})});
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
    fetch('/api/checkout/pro',{cache:'no-store'})
      .then(async response=>{
        if(!response.ok)throw new Error('Plan unavailable');
        const result=await response.json() as PlanPreview;
        if(active){setPlan(result);const options=Array.isArray(result.paymentChannels)?result.paymentChannels:defaultPaymentOptions;const preferred=options.find(option=>option.method==='qris')??options[0];if(preferred)setSelectedPayment({method:preferred.method,channel:preferred.channel})}
      })
      .catch(()=>{if(active){setPlan(null);setPlanError(true)}})
      .finally(()=>{if(active){setLoading(false);setLoaded(true)}});
    return()=>{active=false};
  },[open,loaded]);

  const amount=billingPeriod==='yearly'?plan?.annualAmount:plan?.amount;
  const annualSavings=Math.max(0,(plan?.standardAmount??plan?.amount??24900)*12-(plan?.annualAmount??249000));
  const monthlyStandardAmount=plan?.standardAmount??plan?.amount??24900;
  const annualSavingsPercent=monthlyStandardAmount>0?Math.round(annualSavings/(monthlyStandardAmount*12)*100):0;
  const paymentOptions=Array.isArray(plan?.paymentChannels)?plan.paymentChannels:defaultPaymentOptions;
  const selectedPaymentOption=paymentOptions.find(option=>option.method===selectedPayment.method&&option.channel===selectedPayment.channel);
  const paymentFee=estimatePaymentFee(selectedPaymentOption,amount??0);
  const introLimit=plan?.introOfferLimit??null;
  const phone=String(profile?.phone??'').replaceAll(' ','').replaceAll('(','').replaceAll(')','').replaceAll('.','').replaceAll('-','');
  const phoneDigits=phone.startsWith('+')?phone.slice(1):phone;
  const hasValidPhone=phoneDigits.length>=8&&phoneDigits.length<=16&&[...phoneDigits].every(character=>character>='0'&&character<='9');

  return <>
    <button type="button" className="market-pro-nav-link" aria-label={t('Market Pro','Market Pro')} onClick={()=>{setBillingPeriod(member?'yearly':'monthly');if(!loaded)setLoading(true);setOpen(true)}}><Crown size={15} aria-hidden="true"/><span className="market-pro-nav-long">{member?t('Extend Pro','Perpanjang Pro'):t('Market Pro','Market Pro')}</span><span className="market-pro-nav-short">Pro</span></button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="market-pro-dialog">
        <DialogHeader className="market-pro-dialog-heading">
          <div className="market-pro-dialog-heading-copy">
            <DialogTitle>Market Pro</DialogTitle>
          </div>
        </DialogHeader>
        <div className="market-pro-dialog-price" aria-busy={loading}>
          {loading ? (
            <>
              <span className="market-pro-price-skeleton" aria-hidden="true"><i/><i/><i/></span>
              <span className="sr-only" role="status">{t('Loading Market Pro price','Memuat harga Market Pro')}</span>
            </>
          ) : amount !== null && amount !== undefined ? (
            <>
              <div className="market-pro-billing-toggle" role="group" aria-label={t('Membership period','Masa keanggotaan')}>
                <button type="button" aria-pressed={billingPeriod==='monthly'} disabled={member} onClick={()=>setBillingPeriod('monthly')}>{t('Monthly','Bulanan')}</button>
                <button type="button" aria-pressed={billingPeriod==='yearly'} onClick={()=>setBillingPeriod('yearly')}>{member?t('Extend for a year','Perpanjang setahun'):t('Annual','Tahunan')}</button>
              </div>
              <strong>{formatMoney(amount,'IDR')}</strong>
              <span>{billingPeriod==='yearly'?t('/ year','/ tahun'):t('/ month','/ bulan')}</span>
              {billingPeriod==='yearly'?<small><s>{formatMoney(monthlyStandardAmount*12,'IDR')}</s> <b className="market-membership-savings">{t(`Save ${formatMoney(annualSavings,'IDR')} (${annualSavingsPercent}%) vs 12 monthly payments`,`Hemat ${formatMoney(annualSavings,'IDR')} (${annualSavingsPercent}%) dibandingkan 12 pembayaran bulanan`)}</b>{t(`. Use ${plan?.shippingVouchersPerYear??24} vouchers any time during the year; unused vouchers expire when membership ends.`,`. Gunakan ${plan?.shippingVouchersPerYear??24} voucher kapan saja selama setahun; sisa voucher kedaluwarsa saat masa aktif berakhir.`)}</small>:plan?.introOffer && plan.standardAmount !== null ? <small>{t(`Intro price for ${plan.durationDays??30} days, then ${formatMoney(plan.standardAmount,'IDR')} every 30 days. Renew manually.`,`Harga promo ${plan.durationDays??30} hari, lalu ${formatMoney(plan.standardAmount,'IDR')} tiap 30 hari. Perpanjang manual.`)}</small>:null}
              {billingPeriod==='monthly'&&introLimit&&<MarketIntroOfferProgress compact limit={introLimit} remaining={plan?.introOfferSpotsRemaining} endsAt={plan?.introOfferEndsAt} locale={locale}/>}
            </>
          ) : (
            <span className="market-pro-dialog-plan-error" role="status">
              {t('Plan details could not load.','Detail paket gagal dimuat.')}
              {planError ? (
                <button type="button" onClick={()=>{setPlanError(false);setLoading(true);setLoaded(false)}}>
                  {t('Try again','Coba lagi')}
                </button>
              ) : null}
            </span>
          )}
        </div>
        <div className="market-pro-dialog-table-wrap"><MarketMembershipComparison locale={locale} selectedPeriod={billingPeriod} freeListings={plan?.freeMaxActiveListings??10} monthlyListings={plan?.maxActiveListings??500} annualListings={plan?.annualMaxActiveListings??1000} freeDays={plan?.freeDurationDays??7} proDays={plan?.durationDays??30} freeBundle={plan?.freeListingLimits??{maxListingCopies:51,maxCopiesPerCard:4,maxCardTypes:51}} monthlyBundle={plan?.monthlyListingLimits??{maxListingCopies:75,maxCopiesPerCard:10,maxCardTypes:75}} annualBundle={plan?.annualListingLimits??{maxListingCopies:100,maxCopiesPerCard:20,maxCardTypes:100}} freeFee={plan?.freeCommissionPercent??1.5} proFee={plan?.commissionPercent??0.75} buyerMinimum={plan?.buyerFeeMinimum??2_000} sellerMinimum={plan?.sellerFeeMinimum??1_000} monthlyVouchers={plan?.shippingVouchersPerMonth??2} annualVouchers={plan?.shippingVouchersPerYear??24} loading={loading}/></div>
        {loading?<div className="market-pro-note-skeleton" aria-hidden="true"><i/><i/></div>:<p className="market-pro-dialog-note">{t(`${plan?.shippingVoucherSharePercent??50}% off delivery, up to ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')} per voucher on card orders of ${formatMoney(plan?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,'IDR')} or more.`,`Diskon ongkir ${plan?.shippingVoucherSharePercent??50}%, maksimal ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')} per voucher untuk pesanan kartu minimal ${formatMoney(plan?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,'IDR')}.`)}</p>}
        {profile&&hasValidPhone&&amount!=null&&<><MarketPaymentMethodPicker layout="compact" locale={locale} options={paymentOptions} amount={amount} selectedMethod={selectedPayment.method} selectedChannel={selectedPayment.channel} onChange={(method,channel)=>setSelectedPayment({method,channel})}/>{paymentFee>0&&<p className="pro-dialog-payment-total">{t('Estimated total','Perkiraan total')}: <strong>{formatMoney(amount+paymentFee,'IDR')}</strong></p>}</>}
        {error&&<p className="checkout-error" role="alert">{error}</p>}
        {profile&&member&&<p className="market-pro-member-note">{t('Your current membership stays active. The annual term will be added after it ends.','Keanggotaan Anda tetap aktif. Masa tahunan ditambahkan setelah masa aktif saat ini berakhir.')}</p>}
        {profile&&!hasValidPhone?<Link className="button market-pro-dialog-join" href={route('/profile')} onClick={()=>setOpen(false)}>{t('Add phone number','Tambahkan nomor telepon')}</Link>:<button type="button" className="button market-pro-dialog-join" disabled={joining||loading||accountLoading||plan?.available===false||amount==null||Boolean(profile&&!selectedPaymentOption)} onClick={()=>void join()}>{joining?t('Opening checkout…','Membuka checkout…'):!profile&&!accountLoading?t('Sign in to join','Masuk untuk bergabung'):member?t('Extend annual membership','Perpanjang paket tahunan'):billingPeriod==='yearly'?t('Get Market Pro Annual','Pilih Market Pro Tahunan'):t('Join Market Pro','Gabung Market Pro')}</button>}
      </DialogContent>
    </Dialog>
  </>;
}
