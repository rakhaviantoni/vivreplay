'use client';

import {formatMoney} from '@/packages/domain';

export type PaymentMethod='va'|'cstore'|'qris'|'cc'|'paylater'|'ewallet';
export type PaymentOption={method:PaymentMethod;channel:string;name:string;logo:string;fee:number;feeType:'FLAT'|'PERCENT';additionalFee:number};

export const defaultPaymentOptions:PaymentOption[]=[{method:'qris',channel:'mpm',name:'QRIS',logo:'',fee:0,feeType:'FLAT',additionalFee:0}];

export function estimatePaymentFee(option:PaymentOption|undefined,amount:number){
  if(!option||option.method==='qris')return 0;
  return Math.max(0,Math.round((option.feeType==='PERCENT'?amount*option.fee/100:option.fee)+option.additionalFee));
}

export function paymentMethodLabel(method:PaymentMethod,locale:'EN'|'ID'){
  const labels:{[key in PaymentMethod]:string}={va:locale==='ID'?'Transfer bank':'Bank transfer',cstore:locale==='ID'?'Gerai pembayaran':'Convenience store',qris:'QRIS',cc:locale==='ID'?'Kartu kredit atau debit':'Credit or debit card',paylater:locale==='ID'?'Bayar nanti':'Pay later',ewallet:locale==='ID'?'Dompet digital':'E-wallet'};
  return labels[method];
}

export function MarketPaymentMethodPicker({locale='EN',options=defaultPaymentOptions,amount,selectedMethod,selectedChannel,onChange}:{locale?:'EN'|'ID';options?:PaymentOption[];amount:number;selectedMethod:PaymentMethod;selectedChannel:string;onChange:(method:PaymentMethod,channel:string)=>void}){
  const t=(en:string,id:string)=>locale==='ID'?id:en;
  const orderedMethods=[...new Set(options.map(option=>option.method))].sort((a,b)=>a==='qris'?-1:b==='qris'?1:a.localeCompare(b));
  const selectedOption=options.find(option=>option.method===selectedMethod&&option.channel===selectedChannel)??options.find(option=>option.method==='qris')??options[0];
  const fee=estimatePaymentFee(selectedOption,amount);
  return <section className="checkout-payment-methods" aria-labelledby="checkout-payment-method-title">
    <h2 id="checkout-payment-method-title">{t('Payment method','Metode pembayaran')}</h2>
    <div className="checkout-payment-method-grid">{orderedMethods.map(method=>{
      const first=options.find(option=>option.method===method)!;
      const selected=selectedMethod===method;
      return <button type="button" key={method} className={`checkout-payment-method${selected?' is-selected':''}`} aria-pressed={selected} onClick={()=>onChange(method,first.channel)}>
        {first.logo?<img src={first.logo} alt="" loading="lazy"/>:<span className="checkout-payment-method-mark">{method==='qris'?'QR':method==='va'?'BANK':method==='cc'?'CARD':method==='ewallet'?'WALLET':method==='paylater'?'LATER':'PAY'}</span>}
        <span>{paymentMethodLabel(method,locale)}</span>
      </button>;
    })}</div>
    {selectedMethod!=='qris'&&<div className="checkout-payment-channel-grid" aria-label={paymentMethodLabel(selectedMethod,locale)}>{options.filter(option=>option.method===selectedMethod).map(option=><button type="button" key={`${option.method}:${option.channel}`} className={`checkout-payment-channel${selectedChannel===option.channel?' is-selected':''}`} aria-pressed={selectedChannel===option.channel} onClick={()=>onChange(option.method,option.channel)}>{option.logo?<img src={option.logo} alt="" loading="lazy"/>:null}<span>{option.name}</span></button>)}</div>}
    {selectedMethod==='qris'?<p className="checkout-payment-estimate is-no-fee">{t('No extra payment fee','Tidak ada biaya pembayaran tambahan')}</p>:<p className="checkout-payment-estimate">{t(`Estimated payment fee: ${formatMoney(fee,'IDR')}. The final amount is confirmed by the payment method.`,`Perkiraan biaya pembayaran: ${formatMoney(fee,'IDR')}. Total akhir dikonfirmasi oleh metode pembayaran.`)}</p>}
  </section>;
}
