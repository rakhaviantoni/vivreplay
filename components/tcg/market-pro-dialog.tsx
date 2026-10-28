'use client';

import Link from '@/components/ui/localized-link';
import {useLocalizedRouter as useRouter} from '@/lib/use-localized-router';
import {useEffect,useState} from 'react';
import {ArrowSquareOutIcon as ExternalLink,CheckIcon as Check,CopySimpleIcon as Copy,CrownIcon as Crown} from '@phosphor-icons/react';
import {formatMoney} from '@/packages/domain';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL} from '@/lib/market/policy';
import {MarketPaymentMethodPicker,defaultPaymentOptions,estimatePaymentFee,paymentInstrumentLabel,type PaymentMethod,type PaymentOption} from '@/components/tcg/market-payment-method-picker';
import {MarketIntroOfferProgress} from '@/components/tcg/market-intro-offer-progress';
import {MarketMembershipComparison} from '@/components/tcg/market-membership-comparison';

type PlanPreview={
  available:boolean;
  paymentChannels?:PaymentOption[];
  paymentChannelStatus?:'not_configured'|'provider_unavailable'|'settings_unavailable'|'no_active_channels'|'all_disabled'|'ready';
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
  freeProductStock:number;
  monthlyProductStock:number;
  annualProductStock:number;
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

type ProHistoryOrder={id:string;status:string;amount:number;currency:string;createdAt:string;paidAt:string|null;billingPeriod:'monthly'|'yearly';paymentMethod:string|null;paymentChannel:string|null;paymentName:string|null;paymentCreated:boolean;expiresAt:string|null;selectedMethod:string|null;selectedChannel:string|null};
type ProPaymentView={id:string;status:string;paymentMethod:string|null;paymentName:string|null;paymentNo:string|null;paymentInstructionsUrl:string|null;paymentQrImage:string|null;checkoutUrl:string|null;paymentFee:number|null;paymentTotal:number;amount:number;currency:string;paymentNeedsHelp:boolean};

export function MarketProDialog({locale,member=false,profile=null,accountLoading=false}:{locale:'EN'|'ID';member?:boolean;profile?:Record<string,unknown>|null;accountLoading?:boolean}){
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [plan,setPlan]=useState<PlanPreview|null>(null);
  const [loading,setLoading]=useState(false);
  const [joining,setJoining]=useState(false);
  const [error,setError]=useState('');
  const [planError,setPlanError]=useState(false);
  const [planRefreshKey,setPlanRefreshKey]=useState(0);
  const [pendingLoading,setPendingLoading]=useState(false);
  const [pendingOrder,setPendingOrder]=useState<{id:string;status:string;amount:number;currency:string;billingPeriod:'monthly'|'yearly';paymentMethod:string|null;paymentChannel:string|null;paymentName:string|null;selectedMethod:string|null;selectedChannel:string|null;paymentCreated:boolean;expiresAt:string|null}|null>(null);
  const [planHistory,setPlanHistory]=useState<ProHistoryOrder[]>([]);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [paymentView,setPaymentView]=useState<ProPaymentView|null>(null);
  const [paymentViewLoading,setPaymentViewLoading]=useState(false);
  const [copiedPaymentNo,setCopiedPaymentNo]=useState(false);
  const [selectedPayment,setSelectedPayment]=useState<{method:PaymentMethod;channel:string}>({method:'qris',channel:'mpm'});
  const [billingPeriod,setBillingPeriod]=useState<'monthly'|'yearly'>('monthly');
  const isId=locale==='ID';
  const t=(en:string,id:string)=>isId?id:en;
  const route=(path:string)=>isId?`/id${path}`:path;

  const openPayment=async(orderId:string,createInstrument:boolean)=>{
    setPaymentViewLoading(true);setError('');setPaymentView(null);
    try{
      if(createInstrument){
        const instrumentResponse=await fetch(`/api/checkout/order/${encodeURIComponent(orderId)}/instrument`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({paymentMethod:selectedPayment.method,paymentChannel:selectedPayment.channel})});
        const instrument=await instrumentResponse.json() as {error?:string};
        if(!instrumentResponse.ok)throw new Error(instrument.error??t('Payment could not be started.','Pembayaran tidak dapat dimulai.'));
      }
      const response=await fetch(`/api/checkout/order/${encodeURIComponent(orderId)}`,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
      const order=await response.json() as ProPaymentView&{error?:string};
      if(!response.ok)throw new Error(order.error??t('Payment details could not be loaded.','Detail pembayaran tidak dapat dimuat.'));
      setPaymentView(order);
    }catch(cause){setError(cause instanceof Error?cause.message:t('Payment details could not be loaded.','Detail pembayaran tidak dapat dimuat.'))}
    finally{setPaymentViewLoading(false)}
  };

  const join=async()=>{
    if(pendingOrder?.paymentCreated){await openPayment(pendingOrder.id,false);return}
    if(!profile){
      setError(t('Sign in to continue.','Masuk untuk melanjutkan.'));
      window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));
      return;
    }
    const phone=String(profile.phone??'').replace(/[\s().-]/g,'');
    if(!pendingOrder&&!/^\+?[0-9]{5,15}$/.test(phone)){
      setOpen(false);
      router.push(route('/profile'));
      return;
    }
    setJoining(true);setError('');
    try{
      const response=await fetch('/api/checkout/pro',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({billingPeriod,introOffer:billingPeriod==='monthly'&&Boolean(plan?.introOffer),paymentMethod:selectedPayment.method,paymentChannel:selectedPayment.channel})});
      const result=await response.json() as {id?:string;error?:string};
      if(!response.ok||!result.id)throw new Error(result.error??t('Market Pro checkout is unavailable.','Checkout Market Pro tidak tersedia.'));
      await openPayment(result.id,true);
    }catch(cause){setError(cause instanceof Error?cause.message:t('Market Pro checkout is unavailable.','Checkout Market Pro tidak tersedia.'))}
    finally{setJoining(false)}
  };

  useEffect(()=>{
    if(!open)return;
    let active=true;
    setLoading(true);
    setPlanError(false);
    fetch('/api/checkout/pro',{cache:'no-store'})
      .then(async response=>{
        if(!response.ok)throw new Error('Plan unavailable');
        const result=await response.json() as PlanPreview;
        if(active){setPlan(result);const options=Array.isArray(result.paymentChannels)?result.paymentChannels:defaultPaymentOptions;const preferred=options.find(option=>option.method==='qris')??options[0];if(preferred)setSelectedPayment(current=>options.some(option=>option.method===current.method&&option.channel===current.channel)?current:{method:preferred.method,channel:preferred.channel})}
      })
      .catch(()=>{if(active){setPlan(null);setPlanError(true)}})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[open,planRefreshKey]);

  useEffect(()=>{
    if(!open)return;
    if(!profile){setPendingOrder(null);setPendingLoading(false);return}
    let active=true;
    setPendingLoading(true);setHistoryLoading(true);
    fetch('/api/checkout/pro/orders',{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error('Could not load pending plan payments');
      const result=await response.json() as {orders?:ProHistoryOrder[]};
      const pending=(result.orders??[]).find(order=>order.status==='PENDING_PAYMENT')??null;
      if(active){setPlanHistory(result.orders??[]);setPendingOrder(pending);if(pending){setBillingPeriod(pending.billingPeriod);if(!pending.paymentCreated&&pending.selectedMethod&&pending.selectedChannel)setSelectedPayment({method:pending.selectedMethod as PaymentMethod,channel:pending.selectedChannel})}}
    }).catch(()=>{if(active){setPendingOrder(null);setPlanHistory([])}}).finally(()=>{if(active){setPendingLoading(false);setHistoryLoading(false)}});
    return()=>{active=false};
  },[open,profile?.id]);

  const amount=pendingOrder?.amount??(billingPeriod==='yearly'?plan?.annualAmount:plan?.amount);
  const annualSavings=Math.max(0,(plan?.standardAmount??plan?.amount??24900)*12-(plan?.annualAmount??249000));
  const monthlyStandardAmount=plan?.standardAmount??plan?.amount??24900;
  const annualSavingsPercent=monthlyStandardAmount>0?Math.round(annualSavings/(monthlyStandardAmount*12)*100):0;
  const paymentOptions=Array.isArray(plan?.paymentChannels)?plan.paymentChannels:defaultPaymentOptions;
  const selectedPaymentOption=paymentOptions.find(option=>option.method===selectedPayment.method&&option.channel===selectedPayment.channel);
  const paymentAmount=pendingOrder?.amount??amount??0;
  const paymentFee=estimatePaymentFee(selectedPaymentOption,paymentAmount);
  const introLimit=plan?.introOfferLimit??null;
  const phone=String(profile?.phone??'').replaceAll(' ','').replaceAll('(','').replaceAll(')','').replaceAll('.','').replaceAll('-','');
  const phoneDigits=phone.startsWith('+')?phone.slice(1):phone;
  const hasValidPhone=phoneDigits.length>=5&&phoneDigits.length<=15&&[...phoneDigits].every(character=>character>='0'&&character<='9');

  return <>
    <button type="button" className="market-pro-nav-link" aria-label={t('Market Pro','Market Pro')} onClick={()=>{setBillingPeriod(member?'yearly':'monthly');setLoading(true);setOpen(true)}}><Crown size={15} aria-hidden="true"/><span className="market-pro-nav-long">{member?t('Extend Pro','Perpanjang Pro'):t('Market Pro','Market Pro')}</span><span className="market-pro-nav-short">Pro</span></button>
    <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value){setPaymentView(null);setError('')}}}>
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
              <div className="market-pro-billing-toggle" role="group" aria-label={t('Membership period','Masa keanggotaan')} hidden={Boolean(pendingOrder)}>
                <button type="button" aria-pressed={billingPeriod==='monthly'} disabled={member} onClick={()=>setBillingPeriod('monthly')}>{t('Monthly','Bulanan')}</button>
                <button type="button" aria-pressed={billingPeriod==='yearly'} onClick={()=>setBillingPeriod('yearly')}>{member?t('Extend for a year','Perpanjang setahun'):t('Annual','Tahunan')}</button>
              </div>
              <strong>{formatMoney(amount,'IDR')}</strong>
              <span>{billingPeriod==='yearly'?t('/ year','/ tahun'):t('/ month','/ bulan')}</span>
              {!pendingOrder&&billingPeriod==='yearly'?<small><s>{formatMoney(monthlyStandardAmount*12,'IDR')}</s> <b className="market-membership-savings">{t(`Save ${formatMoney(annualSavings,'IDR')} (${annualSavingsPercent}%) vs 12 monthly payments`,`Hemat ${formatMoney(annualSavings,'IDR')} (${annualSavingsPercent}%) dibandingkan 12 pembayaran bulanan`)}</b>{t(`. Use ${plan?.shippingVouchersPerYear??24} vouchers any time during the year; unused vouchers expire when membership ends.`,`. Gunakan ${plan?.shippingVouchersPerYear??24} voucher kapan saja selama setahun; sisa voucher kedaluwarsa saat masa aktif berakhir.`)}</small>:!pendingOrder&&plan?.introOffer&&plan.standardAmount!==null?<small>{t(`Intro price for ${plan.durationDays??30} days, then ${formatMoney(plan.standardAmount,'IDR')} every 30 days. Renew manually.`,`Harga promo ${plan.durationDays??30} hari, lalu ${formatMoney(plan.standardAmount,'IDR')} tiap 30 hari. Perpanjang manual.`)}</small>:null}
              {!pendingOrder&&billingPeriod==='monthly'&&introLimit&&<MarketIntroOfferProgress compact limit={introLimit} remaining={plan?.introOfferSpotsRemaining} endsAt={plan?.introOfferEndsAt} locale={locale}/>}
            </>
          ) : (
            <span className="market-pro-dialog-plan-error" role="status">
              {t('Plan details could not load.','Detail paket gagal dimuat.')}
              {planError ? (
                <button type="button" onClick={()=>{setPlanError(false);setLoading(true);setPlanRefreshKey(value=>value+1)}}>
                  {t('Try again','Coba lagi')}
                </button>
              ) : null}
            </span>
          )}
        </div>
        {!pendingOrder&&<div className="market-pro-dialog-table-wrap"><MarketMembershipComparison locale={locale} selectedPeriod={billingPeriod} freeListings={plan?.freeMaxActiveListings??10} monthlyListings={plan?.maxActiveListings??500} annualListings={plan?.annualMaxActiveListings??1000} freeDays={plan?.freeDurationDays??7} proDays={plan?.durationDays??30} freeBundle={plan?.freeListingLimits??{maxListingCopies:51,maxCopiesPerCard:4,maxCardTypes:51}} monthlyBundle={plan?.monthlyListingLimits??{maxListingCopies:75,maxCopiesPerCard:10,maxCardTypes:75}} annualBundle={plan?.annualListingLimits??{maxListingCopies:100,maxCopiesPerCard:20,maxCardTypes:100}} freeProductStock={plan?.freeProductStock??10} monthlyProductStock={plan?.monthlyProductStock??50} annualProductStock={plan?.annualProductStock??99} freeFee={plan?.freeCommissionPercent??1.5} proFee={plan?.commissionPercent??0.75} buyerMinimum={plan?.buyerFeeMinimum??2_000} sellerMinimum={plan?.sellerFeeMinimum??1_000} monthlyVouchers={plan?.shippingVouchersPerMonth??2} annualVouchers={plan?.shippingVouchersPerYear??24} loading={loading}/></div>}
        {!pendingOrder&&(loading?<div className="market-pro-note-skeleton" aria-hidden="true"><i/><i/></div>:<p className="market-pro-dialog-note">{t(`${plan?.shippingVoucherSharePercent??50}% off delivery, up to ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')} per voucher on card orders of ${formatMoney(plan?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,'IDR')} or more.`,`Diskon ongkir ${plan?.shippingVoucherSharePercent??50}%, maksimal ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')} per voucher untuk pesanan kartu minimal ${formatMoney(plan?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,'IDR')}.`)}</p>)}
        {pendingOrder&&!pendingOrder.paymentCreated&&<section className="market-pro-pending-payment market-pro-pending-checkout">
          <div className="market-pro-pending-copy"><strong>{t('Finish your Market Pro checkout','Selesaikan checkout Market Pro')}</strong><span>{t(`${pendingOrder.billingPeriod==='yearly'?'Annual':'Monthly'} plan, ${formatMoney(pendingOrder.amount,pendingOrder.currency||'IDR')}. Choose how you’d like to pay.`,`${pendingOrder.billingPeriod==='yearly'?'Paket tahunan':'Paket bulanan'}, ${formatMoney(pendingOrder.amount,pendingOrder.currency||'IDR')}. Pilih metode pembayaran.`)}</span></div>
          {profile&&<MarketPaymentMethodPicker layout="compact" locale={locale} options={paymentOptions} unavailableReason={plan?.paymentChannelStatus} amount={paymentAmount} selectedMethod={selectedPayment.method} selectedChannel={selectedPayment.channel} loading={loading||pendingLoading} onChange={(method,channel)=>setSelectedPayment({method,channel})}/>}
          {paymentFee>0&&<p className="pro-dialog-payment-total">{t('Estimated total','Perkiraan total')}: <strong>{formatMoney(paymentAmount+paymentFee,'IDR')}</strong></p>}
        </section>}
        {pendingOrder?.paymentCreated&&!paymentView&&<div className="market-pro-pending-payment" role="status"><strong>{t('Payment is ready','Pembayaran siap')}</strong><span>{t(`Continue your ${paymentInstrumentLabel(pendingOrder.paymentMethod,pendingOrder.paymentName,locale)} payment for ${formatMoney(pendingOrder.amount,pendingOrder.currency||'IDR')}.`,`Lanjutkan pembayaran ${pendingOrder.paymentName??pendingOrder.paymentChannel??'yang dipilih'} sebesar ${formatMoney(pendingOrder.amount,pendingOrder.currency||'IDR')}.`)}</span></div>}
        {paymentViewLoading&&<div className="market-pro-payment-loading" role="status" aria-live="polite"><i/><span>{t('Loading payment details','Memuat detail pembayaran')}</span></div>}
        {paymentView&&!paymentViewLoading&&<section className="market-pro-payment-view" aria-label={t('Payment details','Detail pembayaran')}>
          <div className="market-pro-payment-view-heading"><span><Check size={16}/></span><div><strong>{t('Payment details','Detail pembayaran')}</strong><small>{paymentInstrumentLabel(paymentView.paymentMethod,paymentView.paymentName,locale)}</small></div></div>
          {paymentView.paymentNeedsHelp?<p>{t('We found this payment, but could not restore its details. Contact support before starting another payment.','Pembayaran ditemukan, tetapi detailnya tidak dapat dipulihkan. Hubungi dukungan sebelum memulai pembayaran lain.')}</p>:paymentView.paymentQrImage?<img className="market-pro-payment-qr" src={paymentView.paymentQrImage} alt={t('QRIS payment code','Kode pembayaran QRIS')}/>:paymentView.paymentNo?<div className="market-pro-payment-number"><span><small>{paymentView.paymentName??t('Payment number','Nomor pembayaran')}</small><strong>{paymentView.paymentNo}</strong></span><button type="button" onClick={async()=>{await navigator.clipboard?.writeText(paymentView.paymentNo??'');setCopiedPaymentNo(true);window.setTimeout(()=>setCopiedPaymentNo(false),1600)}}>{copiedPaymentNo?<Check size={16}/>:<Copy size={16}/>}<span>{copiedPaymentNo?t('Copied','Disalin'):t('Copy','Salin')}</span></button></div>:paymentView.checkoutUrl?<>{paymentView.paymentMethod==='cc'&&<p>{t('Enter your card details on the secure payment page.','Masukkan detail kartu di halaman pembayaran yang aman.')}</p>}<a className="button market-pro-payment-open" href={paymentView.checkoutUrl} target="_blank" rel="noreferrer">{paymentView.paymentMethod==='cc'?t('Continue to card payment','Lanjutkan ke pembayaran kartu'):t('Open payment page','Buka halaman pembayaran')}<ExternalLink size={15}/></a></>:<p>{t('This payment is being prepared. Refresh the order if it does not appear shortly.','Pembayaran sedang disiapkan. Muat ulang pesanan jika belum muncul.')}</p>}
          {Number(paymentView.paymentFee)>0&&<div className="market-pro-payment-fee"><span>{t('Payment fee','Biaya pembayaran')}</span><strong>{formatMoney(paymentView.paymentFee??0,paymentView.currency||'IDR')}</strong></div>}<div className="market-pro-payment-total"><span>{t('Total to pay','Total pembayaran')}</span><strong>{formatMoney(paymentView.paymentTotal??paymentView.amount,paymentView.currency||'IDR')}</strong></div>
          {paymentView.paymentInstructionsUrl&&<a className="market-pro-payment-instructions" href={paymentView.paymentInstructionsUrl} target="_blank" rel="noreferrer">{t('Payment instructions','Petunjuk pembayaran')}<ExternalLink size={13}/></a>}
        </section>}
        {paymentView&&!paymentViewLoading&&<button type="button" className="market-pro-history-link" onClick={()=>setPaymentView(null)}>{t('Done','Selesai')}</button>}
        {!paymentView&&!pendingOrder&&profile&&hasValidPhone&&amount!=null&&<><MarketPaymentMethodPicker layout="compact" locale={locale} options={paymentOptions} unavailableReason={plan?.paymentChannelStatus} amount={paymentAmount} selectedMethod={selectedPayment.method} selectedChannel={selectedPayment.channel} loading={loading||pendingLoading} onChange={(method,channel)=>setSelectedPayment({method,channel})}/>{paymentFee>0&&<p className="pro-dialog-payment-total">{t('Estimated total','Perkiraan total')}: <strong>{formatMoney(paymentAmount+paymentFee,'IDR')}</strong></p>}</>}
        {error&&<p className="checkout-error" role="alert">{error}</p>}
        {profile&&member&&<p className="market-pro-member-note">{t('Your current membership stays active. The annual term will be added after it ends.','Keanggotaan Anda tetap aktif. Masa tahunan ditambahkan setelah masa aktif saat ini berakhir.')}</p>}
        {!paymentView&&(profile&&!pendingOrder&&!hasValidPhone?<Link className="button market-pro-dialog-join" href={route('/profile')} onClick={()=>setOpen(false)}>{t('Add phone number','Tambahkan nomor telepon')}</Link>:<button type="button" className="button market-pro-dialog-join" disabled={joining||loading||pendingLoading||paymentViewLoading||accountLoading||plan?.available===false||(amount==null&&!pendingOrder)||Boolean(profile&&!pendingOrder?.paymentCreated&&!selectedPaymentOption)} onClick={()=>void join()}>{joining||paymentViewLoading?t('Starting payment…','Memulai pembayaran…'):pendingOrder?.paymentCreated?t('Continue payment','Lanjutkan pembayaran'):pendingOrder?t('Continue to payment','Lanjut ke pembayaran'):!profile&&!accountLoading?t('Sign in to join','Masuk untuk bergabung'):member?t('Extend Pro','Perpanjang Pro'):billingPeriod==='yearly'?t('Get Market Pro Annual','Pilih Market Pro Tahunan'):t('Get Market Pro','Pilih Market Pro')}</button>)}
        {profile&&<section className="market-pro-dialog-history"><h3>{t('Plan history','Riwayat paket')}</h3>{historyLoading?<div className="market-pro-history-skeleton" aria-hidden="true"><i/><i/></div>:planHistory.length?<div className="market-pro-history-list">{planHistory.slice(0,5).map(order=><article className="market-pro-history-row" key={order.id}><span><strong>{order.billingPeriod==='yearly'?t('Annual plan','Paket tahunan'):t('Monthly plan','Paket bulanan')}</strong><small>{new Intl.DateTimeFormat(isId?'id-ID':'en-US',{dateStyle:'medium'}).format(new Date(order.createdAt))}</small></span><b className={`is-${order.status.toLowerCase()}`}>{order.status==='PAID'?t('Paid','Dibayar'):order.status==='PENDING_PAYMENT'?t('Awaiting payment','Menunggu pembayaran'):order.status==='EXPIRED'?t('Expired','Kedaluwarsa'):order.status==='CANCELLED'?t('Cancelled','Dibatalkan'):order.status}</b><strong>{formatMoney(order.amount,order.currency||'IDR')}</strong>{order.status==='PENDING_PAYMENT'&&<button type="button" onClick={()=>{setPaymentView(null);setOpen(true);if(order.paymentCreated)void openPayment(order.id,false);else{setPendingOrder(order);setError('')}}}>{t('Continue','Lanjutkan')}</button>}</article>)}</div>:<p>{t('Your Market Pro payments will appear here.','Pembayaran Market Pro akan muncul di sini.')}</p>}</section>}
      </DialogContent>
    </Dialog>
  </>;
}
