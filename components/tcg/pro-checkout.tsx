'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import {CheckIcon as Check,SparkleIcon as Sparkle,StorefrontIcon as Store} from '@phosphor-icons/react';
import {formatMoney} from '@/packages/domain';
import {useAccount} from '@/lib/client';
import {toast} from 'sonner';

type Plan={available:boolean;amount:number|null;durationDays:number|null;maxActiveListings:number;commissionPercent:number;canAutoRenew:boolean;currency:'IDR'};

export function ProCheckout(){
  const router=useRouter();
  const {data:account,loading:accountLoading}=useAccount();
  const [planLoading,setPlanLoading]=useState(true);
  const [plan,setPlan]=useState<Plan>();
  const [name,setName]=useState('');
  const [phone,setPhone]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');

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

  if(accountLoading||planLoading)return <main className="page vivre-checkout-page pro-checkout-page"><div className="checkout-loading"><i/><span>Loading Market Pro…</span></div></main>;
  if(!account)return <main className="page vivre-checkout-page pro-checkout-page"><section className="pro-signin-card"><span className="pro-icon"><Store size={20}/></span><p className="eyebrow">VIVREPLAY MARKET</p><h1>Market Pro</h1><p>Sign in to view seller membership and checkout.</p><button className="button" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}>Sign in</button></section></main>;

  const benefits=[
    {title:`${plan?.durationDays??14}-day listing window`,detail:'Keep active listings visible for longer.'},
    {title:`Up to ${(plan?.maxActiveListings??500).toLocaleString()} active listings`,detail:'Manage more of your collection on Market.'},
    {title:`${plan?.commissionPercent??0}% seller fee`,detail:'Applied to completed Market sales; the buyer fee is shown separately at checkout.'},
    {title:plan?.canAutoRenew?'Automatic renewal option':'Manual one-click renewal',detail:'Choose how your listings stay active.'},
  ];

  return <main className="page vivre-checkout-page pro-checkout-page">
    <header className="pro-checkout-heading"><div className="pro-checkout-mark"><span className="pro-icon"><Store size={20}/></span><span className="pro-badge"><Sparkle size={12}/> PRO</span></div><p className="eyebrow">VIVREPLAY MARKET</p><h1>Market Pro</h1><p>More room to sell, longer listings, and seller tools.</p></header>
    <div className="pro-checkout-grid">
      <section className="pro-benefits-panel"><div className="pro-panel-heading"><div><span className="eyebrow">SELLER BENEFITS</span><h2>Built for your Market listings</h2></div><span className="pro-policy-live"><span/>Current policy</span></div><div className="pro-benefit-grid">{benefits.map(item=><article className="pro-benefit" key={item.title}><span><Check size={14}/></span><div><strong>{item.title}</strong><p>{item.detail}</p></div></article>)}</div><p className="pro-market-scope">Market Pro adds longer listing windows, higher seller limits, and listing tools. It doesn’t change card library or gameplay features.</p></section>
      <section className="pro-purchase-panel"><div className="pro-purchase-top"><span>MARKET PRO PLAN</span><Sparkle size={18}/></div>{plan?.available&&plan.amount&&plan.durationDays?<><p className="pro-purchase-price">{formatMoney(plan.amount,'IDR')}<small>/{plan.durationDays} days</small></p><p className="pro-purchase-caption">One plan period. Membership starts after successful payment.</p><div className="pro-purchase-fields"><label>Name<input value={name} placeholder={account.profile.display_name??''} onChange={event=>setName(event.target.value)} autoComplete="name"/></label><label>Mobile number<input value={phone} onChange={event=>setPhone(event.target.value)} autoComplete="tel" inputMode="tel" placeholder="+62…"/></label></div><button className="button pro-purchase-button" disabled={submitting||!(name.trim()||account.profile.display_name)||phone.replace(/\D/g,'').length<8} onClick={begin}>{submitting?'Opening secure checkout…':'Continue to payment'}</button></>:<div className="pro-coming-soon"><span className="pro-coming-soon-mark"><Sparkle size={16}/></span><strong>Market Pro is coming soon</strong><p>Membership checkout will appear here when available.</p></div>}{error&&<p className="checkout-error" role="alert">{error}</p>}<Link href="/market">Back to Market</Link></section>
    </div>
  </main>;
}
