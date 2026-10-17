'use client';

import Image from 'next/image';
import {useEffect,useMemo,useState} from 'react';
import {ArrowClockwiseIcon as Refresh,FloppyDiskIcon as Save,WarningCircleIcon as Warning} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {paymentMethodLabel,type PaymentMethod,type PaymentOption} from '@/components/tcg/market-payment-method-picker';

type PaymentMethodsResponse={channels:PaymentOption[];disabledChannels:string[];configured:boolean;providerAvailable:boolean};
const methodOrder:PaymentMethod[]=['qris','va','ewallet','cc','paylater','cstore'];
const methodLabels:Record<PaymentMethod,string>={qris:'QRIS',va:'Bank transfer',ewallet:'E-wallet',cc:'Credit or debit card',paylater:'Pay later',cstore:'Convenience store'};
const keyOf=(option:PaymentOption)=>`${option.method}:${option.channel}`;

export function PaymentMethodsManager(){
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [configured,setConfigured]=useState(false);
  const [providerAvailable,setProviderAvailable]=useState(false);
  const [channels,setChannels]=useState<PaymentOption[]>([]);
  const [savedDisabled,setSavedDisabled]=useState<string[]>([]);
  const [disabled,setDisabled]=useState<string[]>([]);

  const load=async()=>{
    setLoading(true);
    try{
      const response=await fetch('/api/admin/payment-methods',{cache:'no-store'});
      const result=await response.json() as PaymentMethodsResponse&{error?:string};
      if(!response.ok)throw new Error(result.error??'Could not load payment methods.');
      const values=Array.isArray(result.disabledChannels)?result.disabledChannels:[];
      setChannels(Array.isArray(result.channels)?result.channels:[]);
      setDisabled(values);setSavedDisabled(values);
      setConfigured(Boolean(result.configured));setProviderAvailable(Boolean(result.providerAvailable));
    }catch(error){toast.error(error instanceof Error?error.message:'Could not load payment methods.')}
    finally{setLoading(false)}
  };

  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[]);

  const groups=useMemo(()=>methodOrder.map(method=>({method,channels:channels.filter(channel=>channel.method===method)})).filter(group=>group.channels.length),[channels]);
  const changed=disabled.length!==savedDisabled.length||disabled.some(item=>!savedDisabled.includes(item));
  const toggle=(key:string)=>setDisabled(current=>current.includes(key)?current.filter(item=>item!==key):[...current,key]);
  const save=async()=>{
    setSaving(true);
    try{
      const response=await fetch('/api/admin/payment-methods',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({disabledChannels:disabled})});
      const result=await response.json() as {success?:boolean;disabledChannels?:string[];error?:string};
      if(!response.ok||!result.success)throw new Error(result.error??'Payment methods could not be saved.');
      const values=Array.isArray(result.disabledChannels)?result.disabledChannels:disabled;
      setDisabled(values);setSavedDisabled(values);toast.success('Payment methods updated.');
    }catch(error){toast.error(error instanceof Error?error.message:'Payment methods could not be saved.')}
    finally{setSaving(false)}
  };

  return <section className="admin-payment-methods">
      <header className="admin-payment-methods-header"><div><h2>Available payment methods</h2><p>Only channels iPaymu reports as active and online are listed.</p><span className={`admin-payment-connection${providerAvailable?' is-connected':''}`}><i/>{providerAvailable?'Connected':'Unavailable'}</span></div><button type="button" className="admin-refresh" onClick={()=>void load()} disabled={loading}><Refresh size={15} className={loading?'spin':''}/>Refresh</button></header>
      {!configured&&!loading?<p className="admin-payment-methods-message"><Warning size={17}/>iPaymu payment settings are not available, so its channels could not be loaded.</p>:null}
      {configured&&!providerAvailable&&!loading?<p className="admin-payment-methods-message"><Warning size={17}/>iPaymu channels could not be loaded. Refresh to try again.</p>:null}
      {loading?<div className="admin-payment-methods-skeleton" aria-label="Loading payment methods"><i/><i/><i/></div>:groups.map(group=><section className="admin-payment-group" key={group.method}>
        <h3>{methodLabels[group.method]}</h3>
        <div>{group.channels.map(channel=>{const key=keyOf(channel);const active=!disabled.includes(key);return <div className="admin-payment-channel-row" key={key}>
          {channel.logo?<Image src={channel.logo} alt="" width={44} height={36} unoptimized/>:<span className="admin-payment-channel-mark">{paymentMethodLabel(channel.method,'EN').slice(0,2).toUpperCase()}</span>}
          <span className="admin-payment-channel-name"><strong>{channel.name}</strong><small>{channel.feeType==='PERCENT'?`${channel.fee}% fee`:`${new Intl.NumberFormat('id-ID').format(channel.fee)} IDR fee`}{channel.additionalFee>0?` plus ${new Intl.NumberFormat('id-ID').format(channel.additionalFee)} IDR`:''}</small></span>
          <button type="button" className="admin-payment-toggle" role="switch" aria-checked={active} aria-label={`${active?'Disable':'Enable'} ${channel.name}`} onClick={()=>toggle(key)} disabled={saving}><span/></button>
        </div>})}</div>
      </section>)}
      {!loading&&providerAvailable&&!groups.length?<p className="admin-payment-methods-message"><Warning size={17}/>iPaymu has no active payment channels for this account.</p>:null}
      <footer className="admin-payment-methods-footer"><span>{disabled.length?`${disabled.length} ${disabled.length===1?'channel':'channels'} turned off`:groups.length?'All available channels are on':' '}</span><button type="button" className="admin-refresh admin-payment-save" onClick={()=>void save()} disabled={!changed||saving||!configured}>{saving?'Saving…':<><Save size={15}/>Save changes</>}</button></footer>
    </section>;
}
