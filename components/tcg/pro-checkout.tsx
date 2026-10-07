'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import {CheckIcon as Check,SparkleIcon as Sparkle,StorefrontIcon as Store} from '@phosphor-icons/react';
import {formatMoney} from '@/packages/domain';
import {useAccount} from '@/lib/client';
import {toast} from 'sonner';

type Plan={available:boolean;amount:number|null;durationDays:number|null;maxActiveListings:number;commissionPercent:number;freeCommissionPercent:number;buyerFeePercent:number;freeBuyerFeePercent:number;shippingVouchersPerMonth:number;shippingVoucherMinSubtotal:number;shippingVoucherSharePercent:number;shippingVoucherCap:number;canAutoRenew:boolean;currency:'IDR'};

export function ProCheckout(){
  const router=useRouter();
  const {data:account,loading:accountLoading}=useAccount();
  const [planLoading,setPlanLoading]=useState(true);
  const [plan,setPlan]=useState<Plan>();
  const [name,setName]=useState('');
  const [phone,setPhone]=useState('');
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

  const begin=async()=>{
    setError('');setSubmitting(true);
    try{
      const response=await fetch('/api/checkout/pro',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:name.trim()||account?.profile.display_name||'',phone})});
      const result=await response.json() as {checkoutUrl?:string;error?:string};
      if(!response.ok||!result.checkoutUrl)throw new Error(result.error==='VivrePlay Pro checkout is not configured yet.'?'Market Pro is temporarily unavailable.':result.error??'Market Pro is temporarily unavailable.');
      router.push(result.checkoutUrl);
    }catch(cause){const message=cause instanceof Error?cause.message:'Market Pro is temporarily unavailable.';setError(message);toast.error(message)}finally{setSubmitting(false)}
  };

  if(accountLoading||planLoading)return <main className="page vivre-checkout-page pro-checkout-page"><div className="checkout-loading"><i/><span>{t('Loading Market Pro…','Memuat Market Pro…')}</span></div></main>;
  if(!account)return <main className="page vivre-checkout-page pro-checkout-page"><section className="pro-signin-card"><span className="pro-icon"><Store size={20}/></span><p className="eyebrow">VIVREPLAY MARKET</p><h1>Market Pro</h1><p>{t('Sign in to view the plan and continue to checkout.','Masuk untuk melihat paket dan melanjutkan ke pembayaran.')}</p><button className="button" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}>{t('Sign in','Masuk')}</button></section></main>;

  const benefits=[
    {title:t(`${plan?.durationDays??30}-day listing window`,`Listing aktif selama ${plan?.durationDays??30} hari`),detail:t('Keep active listings visible for longer.','Listing tetap tampil lebih lama.'),},
    {title:t(`Up to ${(plan?.maxActiveListings??2500).toLocaleString()} active listings`,`Hingga ${(plan?.maxActiveListings??2500).toLocaleString()} listing aktif`),detail:t('Manage more of your collection on Market.','Kelola lebih banyak kartu di Market.')},
    {title:t(`${plan?.commissionPercent??0}% seller fee`,`Biaya penjual ${plan?.commissionPercent??0}%`),detail:t(`Free accounts pay ${plan?.freeCommissionPercent??1.5}% on completed sales.`,`Akun gratis dikenai ${plan?.freeCommissionPercent??1.5}% untuk penjualan yang selesai.`)},
    {title:t(`${plan?.buyerFeePercent??0.5}% buyer fee`,`Biaya pembeli ${plan?.buyerFeePercent??0.5}%`),detail:t(`Free accounts pay ${plan?.freeBuyerFeePercent??0.75}%. Applies when you buy with this same account.`,`Akun gratis dikenai ${plan?.freeBuyerFeePercent??0.75}%. Berlaku saat Anda membeli dengan akun ini.`)},
    {title:t(`${plan?.shippingVouchersPerMonth??2} delivery vouchers each month`,`${plan?.shippingVouchersPerMonth??2} voucher ongkir setiap bulan`),detail:t(`Save ${plan?.shippingVoucherSharePercent??50}% of delivery, up to ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')} per order on purchases of ${formatMoney(plan?.shippingVoucherMinSubtotal??200000,'IDR')} or more.`,`Hemat ${plan?.shippingVoucherSharePercent??50}% ongkir, maksimal ${formatMoney(plan?.shippingVoucherCap??5000,'IDR')} per pesanan dengan belanja minimal ${formatMoney(plan?.shippingVoucherMinSubtotal??200000,'IDR')}.`)},
    {title:plan?.canAutoRenew?t('Automatic listing renewal','Perpanjangan listing otomatis'):t('Manual one-click renewal','Perpanjangan listing sekali klik'),detail:t('Keep eligible listings active without republishing them.','Perpanjang listing yang memenuhi syarat tanpa menerbitkannya ulang.')},
  ];

  return <main className="page vivre-checkout-page pro-checkout-page">
    <header className="pro-checkout-heading"><div className="pro-checkout-mark"><span className="pro-icon"><Store size={20}/></span><span className="pro-badge"><Sparkle size={12}/> PRO</span></div><p className="eyebrow">VIVREPLAY MARKET</p><h1>Market Pro</h1><p>{t('One membership for buying and selling on Market.','Satu keanggotaan untuk membeli dan menjual di Market.')}</p></header>
    <div className="pro-checkout-grid">
      <section className="pro-benefits-panel"><div className="pro-panel-heading"><div><span className="eyebrow">{t('BUYER + SELLER BENEFITS','MANFAAT PEMBELI + PENJUAL')}</span><h2>{t('One plan for your Market account','Satu paket untuk akun Market Anda')}</h2></div></div><div className="pro-benefit-grid">{benefits.map(item=><article className="pro-benefit" key={item.title}><span><Check size={14}/></span><div><strong>{item.title}</strong><p>{item.detail}</p></div></article>)}</div><p className="pro-market-scope">{t('One Market Pro membership covers purchases and sales on this account. Vouchers apply automatically at checkout on eligible orders; unused monthly vouchers do not roll over.','Satu keanggotaan Market Pro berlaku untuk pembelian dan penjualan dari akun ini. Voucher otomatis digunakan saat checkout yang memenuhi syarat; voucher yang tidak terpakai tidak dibawa ke bulan berikutnya.')}</p></section>
      <section className="pro-purchase-panel"><div className="pro-purchase-top"><span>{t('MARKET PRO','MARKET PRO')}</span><Sparkle size={18}/></div>{plan?.available&&plan.amount&&plan.durationDays?<><p className="pro-purchase-price">{formatMoney(plan.amount,'IDR')}<small>/{plan.durationDays} {id?'hari':'days'}</small></p><p className="pro-purchase-caption">{t('Membership starts after successful payment.','Keanggotaan dimulai setelah pembayaran berhasil.')}</p><div className="pro-purchase-fields"><label>{t('Name','Nama')}<input value={name} placeholder={account.profile.display_name??''} onChange={event=>setName(event.target.value)} autoComplete="name"/></label><label>{t('Mobile number','Nomor ponsel')}<input value={phone} onChange={event=>setPhone(event.target.value)} autoComplete="tel" inputMode="tel" placeholder="+62…"/></label></div><button className="button pro-purchase-button" disabled={submitting||!(name.trim()||account.profile.display_name)||phone.replace(/\D/g,'').length<8} onClick={begin}>{submitting?t('Opening checkout…','Membuka pembayaran…'):t('Continue to payment','Lanjut ke pembayaran')}</button></>:<div className="pro-coming-soon"><span className="pro-coming-soon-mark"><Sparkle size={16}/></span><strong>{t('Market Pro is temporarily unavailable','Market Pro sementara tidak tersedia')}</strong><p>{t('Please try again later.','Silakan coba lagi nanti.')}</p></div>}{error&&<p className="checkout-error" role="alert">{error}</p>}<Link href="/market">{t('Back to Market','Kembali ke Market')}</Link></section>
    </div>
  </main>;
}
