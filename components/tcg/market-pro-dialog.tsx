'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import {CrownIcon as Crown} from '@phosphor-icons/react';
import {formatMoney} from '@/packages/domain';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {BuyerFeeInfo,SellerFeeInfo} from '@/components/tcg/market-buyer-fee-cap-table';
import {MARKET_BUYER_FEE_MINIMUM,MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL} from '@/lib/market/policy';
import {MarketPaymentMethodPicker,defaultPaymentOptions,estimatePaymentFee,type PaymentMethod,type PaymentOption} from '@/components/tcg/market-payment-method-picker';

type PlanPreview={
  available:boolean;
  paymentChannels?:PaymentOption[];
  amount:number|null;
  standardAmount:number|null;
  durationDays:number|null;
  introOffer:boolean;
  introOfferEndsAt:string|null;
  introOfferLimit:number|null;
  maxActiveListings:number;
  freeMaxActiveListings:number;
  freeDurationDays:number;
  commissionPercent:number;
  freeCommissionPercent:number;
  buyerFeePercent:number;
  freeBuyerFeePercent:number;
  buyerFeeCap:number;
  buyerFeeMinimum:number;
  sellerFeeMinimum:number;
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
  const [planError,setPlanError]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [selectedPayment,setSelectedPayment]=useState<{method:PaymentMethod;channel:string}>({method:'qris',channel:'mpm'});
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
      const response=await fetch('/api/checkout/pro',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({introOffer:Boolean(plan?.introOffer),paymentMethod:selectedPayment.method,paymentChannel:selectedPayment.channel})});
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
        if(active){setPlan(result);const options=result.paymentChannels?.length?result.paymentChannels:defaultPaymentOptions;const preferred=options.find(option=>option.method==='qris')??options[0];if(preferred)setSelectedPayment({method:preferred.method,channel:preferred.channel})}
      })
      .catch(()=>{if(active){setPlan(null);setPlanError(true)}})
      .finally(()=>{if(active){setLoading(false);setLoaded(true)}});
    return()=>{active=false};
  },[open,loaded]);

  if(member)return null;

  const rows=[
    {key:'listings',label:t('Active listings','Listing aktif'),free:(plan?.freeMaxActiveListings??25).toLocaleString(isId?'id-ID':'en-US'),pro:(plan?.maxActiveListings??2500).toLocaleString(isId?'id-ID':'en-US')},
    {key:'period',label:t('Listing period','Masa listing'),free:`${plan?.freeDurationDays??7} ${t('days','hari')}`,pro:`${plan?.durationDays??30} ${t('days','hari')}`},
    {key:'seller-fee',label:<span className="buyer-fee-row-label">{t('Seller fee','Biaya penjual')}<SellerFeeInfo locale={isId?'id':'en'} minimumFee={plan?.sellerFeeMinimum} freePercent={plan?.freeCommissionPercent??1.25} proPercent={plan?.commissionPercent??0.75}/></span>,free:`${plan?.freeCommissionPercent??1.25}%`,pro:`${plan?.commissionPercent??0.75}%`},
    {key:'buyer-fee',label:<span className="buyer-fee-row-label">{t('Buyer fee','Biaya pembeli')}<BuyerFeeInfo locale={isId?'id':'en'} minimumFee={plan?.buyerFeeMinimum??MARKET_BUYER_FEE_MINIMUM}/></span>,free:`${plan?.freeBuyerFeePercent??1.5}%`,pro:`${plan?.buyerFeePercent??0.75}%`},
    {key:'vouchers',label:t('Delivery vouchers','Voucher ongkir'),free:'—',pro:`${plan?.shippingVouchersPerMonth??2} ${t('per month','per bulan')}`},
  ];
  const amount=plan?.amount;
  const paymentOptions=plan?.paymentChannels?.length?plan.paymentChannels:defaultPaymentOptions;
  const selectedPaymentOption=paymentOptions.find(option=>option.method===selectedPayment.method&&option.channel===selectedPayment.channel)??paymentOptions.find(option=>option.method==='qris')??paymentOptions[0];
  const paymentFee=estimatePaymentFee(selectedPaymentOption,amount??0);
  const introEndLabel=plan?.introOfferEndsAt?new Intl.DateTimeFormat(isId?'id-ID':'en-US',{dateStyle:'long',timeZone:'Asia/Jakarta'}).format(new Date(plan.introOfferEndsAt)):'';
  const introLimit=plan?.introOfferLimit??null;
  const phone=String(profile?.phone??'').replaceAll(' ','').replaceAll('(','').replaceAll(')','').replaceAll('.','').replaceAll('-','');
  const phoneDigits=phone.startsWith('+')?phone.slice(1):phone;
  const hasValidPhone=phoneDigits.length>=8&&phoneDigits.length<=16&&[...phoneDigits].every(character=>character>='0'&&character<='9');

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
          {loading ? (
            <span className="market-pro-dialog-loading" aria-live="polite">
              {t('Loading price…','Memuat harga…')}
            </span>
          ) : amount !== null && amount !== undefined ? (
            <>
              <strong>{formatMoney(amount,'IDR')}</strong>
              <span>{t(`/ ${plan?.durationDays??30} days`,`/ ${plan?.durationDays??30} hari`)}</span>
              {plan?.introOffer && plan.standardAmount !== null ? (
                <><small>{t(`First ${plan.durationDays??30} days, then ${formatMoney(plan.standardAmount,'IDR')} per 30 days.`,`Harga ini berlaku ${plan.durationDays??30} hari, lalu ${formatMoney(plan.standardAmount,'IDR')} per 30 hari.`)}</small>{(introLimit||introEndLabel)&&<small>{introLimit&&introEndLabel?t(`Limited to ${introLimit} checkouts until ${introEndLabel}.`,`Maksimal ${introLimit} checkout sampai ${introEndLabel}.`):introLimit?t(`Limited to ${introLimit} checkouts.`,`Maksimal ${introLimit} checkout.`):t(`Available until ${introEndLabel}.`,`Berlaku sampai ${introEndLabel}.`)}</small>}</>
              ) : null}
            </>
          ) : (
            <span className="market-pro-dialog-plan-error" role="status">
              {t('Plan details could not load.','Detail paket gagal dimuat.')}
              {planError ? (
                <button type="button" onClick={()=>{setPlanError(false);setLoaded(false)}}>
                  {t('Try again','Coba lagi')}
                </button>
              ) : null}
            </span>
          )}
        </div>
        <div className="market-pro-dialog-table-wrap"><table className="market-pro-dialog-table"><thead><tr><th>{t('Benefit','Manfaat')}</th><th>{t('Free','Gratis')}</th><th>Pro</th></tr></thead><tbody>{rows.map(row=><tr key={row.key}><th scope="row">{row.label}</th><td>{row.free}</td><td>{row.pro}</td></tr>)}</tbody></table></div>
        <p className="market-pro-dialog-note">{t(`Each voucher takes ${plan?.shippingVoucherSharePercent??50}% off delivery, up to ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')}, on card orders of ${formatMoney(plan?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,'IDR')} or more.`,`Setiap voucher memotong ${plan?.shippingVoucherSharePercent??50}% ongkir, maksimal ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')}, untuk pesanan kartu minimal ${formatMoney(plan?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,'IDR')}.`)}</p>
        {profile&&hasValidPhone&&amount!=null&&<><MarketPaymentMethodPicker locale={locale} options={paymentOptions} amount={amount} selectedMethod={selectedPayment.method} selectedChannel={selectedPayment.channel} onChange={(method,channel)=>setSelectedPayment({method,channel})}/>{paymentFee>0&&<p className="pro-dialog-payment-total">{t('Estimated total','Perkiraan total')}: <strong>{formatMoney(amount+paymentFee,'IDR')}</strong></p>}</>}
        {error&&<p className="checkout-error" role="alert">{error}</p>}
        {profile&&!hasValidPhone?<Link className="button market-pro-dialog-join" href={route('/profile')} onClick={()=>setOpen(false)}>{t('Add phone number','Tambahkan nomor telepon')}</Link>:<button type="button" className="button market-pro-dialog-join" disabled={joining||loading||accountLoading||plan?.available===false||amount==null} onClick={()=>void join()}>{joining?t('Opening checkout…','Membuka checkout…'):!profile&&!accountLoading?t('Sign in to join','Masuk untuk bergabung'):t('Join Market Pro','Gabung Market Pro')}</button>}
      </DialogContent>
    </Dialog>
  </>;
}
