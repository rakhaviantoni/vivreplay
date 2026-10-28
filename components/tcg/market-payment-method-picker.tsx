'use client';

import {formatMoney} from '@/packages/domain';
import Image from 'next/image';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {estimateIpaymuFee} from '@/lib/market/ipaymu-fees';
import {BankIcon as Bank,CreditCardIcon as CreditCard,HourglassIcon as PayLater,QrCodeIcon as QrCode,StorefrontIcon as Storefront,WalletIcon as Wallet} from '@phosphor-icons/react';

export type PaymentMethod='va'|'cstore'|'qris'|'cc'|'paylater'|'ewallet';
export type PaymentOption={method:PaymentMethod;channel:string;name:string;logo:string;fee:number;feeType:'FLAT'|'PERCENT';additionalFee:number};

export const defaultPaymentOptions:PaymentOption[]=[];

export function estimatePaymentFee(option:PaymentOption|undefined,amount:number){
  return estimateIpaymuFee(option,amount);
}

export function paymentMethodLabel(method:PaymentMethod,locale:'EN'|'ID'){
  const labels:{[key in PaymentMethod]:string}={va:'Virtual account',cstore:locale==='ID'?'Gerai pembayaran':'Convenience store',qris:'QRIS',cc:locale==='ID'?'Kartu kredit atau debit':'Credit or debit card',paylater:locale==='ID'?'Bayar nanti':'Pay later',ewallet:locale==='ID'?'Dompet digital':'E-wallet'};
  return labels[method];
}

function PaymentMethodIcon({method}:{method:PaymentMethod}){
  const props={size:19,weight:'regular' as const,'aria-hidden':true as const};
  if(method==='qris')return <QrCode {...props}/>;
  if(method==='va')return <Bank {...props}/>;
  if(method==='cc')return <CreditCard {...props}/>;
  if(method==='ewallet')return <Wallet {...props}/>;
  if(method==='paylater')return <PayLater {...props}/>;
  return <Storefront {...props}/>;
}

function MethodMarks({method,options}:{method:PaymentMethod;options:PaymentOption[]}){
  const marks=options.filter(option=>option.logo).slice(0,3);
  if(!marks.length)return <span className="checkout-payment-method-mark"><PaymentMethodIcon method={method}/></span>;
  return <span className="checkout-payment-method-marks" aria-hidden="true">
    {marks.map(option=><span className="checkout-payment-method-mark" key={option.channel}><Image src={option.logo} alt="" width={48} height={48} unoptimized onError={event=>{event.currentTarget.hidden=true}}/></span>)}
    {options.length>marks.length&&<span className="checkout-payment-method-more">+{options.length-marks.length}</span>}
  </span>;
}

export function MarketPaymentMethodPicker({locale='EN',options=defaultPaymentOptions,amount,selectedMethod,selectedChannel,onChange,unavailableReason,layout='grid',loading=false}:{locale?:'EN'|'ID';options?:PaymentOption[];amount:number;selectedMethod:PaymentMethod;selectedChannel:string;onChange:(method:PaymentMethod,channel:string)=>void;unavailableReason?:'not_configured'|'provider_unavailable'|'settings_unavailable'|'no_active_channels'|'all_disabled'|'ready';layout?:'grid'|'compact';loading?:boolean}){
  const t=(en:string,id:string)=>locale==='ID'?id:en;
  const methodOrder:PaymentMethod[]=['qris','va','ewallet','cc','paylater','cstore'];
  const orderedMethods=[...new Set(options.map(option=>option.method))].sort((a,b)=>methodOrder.indexOf(a)-methodOrder.indexOf(b));
  const selectedOption=options.find(option=>option.method===selectedMethod&&option.channel===selectedChannel);
  const fee=estimatePaymentFee(selectedOption,amount);
  return <section className={`checkout-payment-methods${layout==='compact'?' is-compact':''}`} aria-labelledby="checkout-payment-method-title">
    <h2 id="checkout-payment-method-title">{t('Payment method','Metode pembayaran')}</h2>
    {loading?<div className={`checkout-payment-method-loading${layout==='compact'?' is-compact':''}`} aria-busy="true" role="status" aria-label={t('Loading payment methods','Memuat metode pembayaran')}>{layout==='compact'?<i/>:<><i/><i/><i/></>}</div>:orderedMethods.length===0?<p className="checkout-payment-method-empty" role="status">{unavailableReason==='provider_unavailable'||unavailableReason==='settings_unavailable'?t('Payment options could not be loaded. Please try again later.','Opsi pembayaran tidak dapat dimuat. Silakan coba lagi nanti.'):unavailableReason==='all_disabled'?t('Payment methods are turned off right now. Please try again later.','Metode pembayaran sedang dinonaktifkan. Silakan coba lagi nanti.'):unavailableReason==='no_active_channels'?t('No payment methods are available for this checkout right now.','Belum ada metode pembayaran untuk checkout ini.'):t('Payment methods are unavailable right now. Please try again shortly.','Metode pembayaran belum tersedia. Silakan coba lagi sebentar.')}</p>:layout==='compact'?null:<div className="checkout-payment-method-grid">{orderedMethods.map(method=>{
      const methodOptions=options.filter(option=>option.method===method);
      const first=options.find(option=>option.method===method)!;
      const selected=selectedMethod===method;
      return <button type="button" key={method} className={`checkout-payment-method${selected?' is-selected':''}`} aria-pressed={selected} onClick={()=>onChange(method,first.channel)}>
        <MethodMarks method={method} options={methodOptions}/>
        <span className="checkout-payment-method-copy"><strong>{paymentMethodLabel(method,locale)}</strong><small>{t(`${methodOptions.length} available`,`${methodOptions.length} tersedia`)}</small></span>
      </button>;
    })}</div>}
    {!loading&&layout==='compact'&&orderedMethods.length>0?<Select value={`${selectedMethod}:${selectedChannel}`} onValueChange={value=>{const option=options.find(item=>`${item.method}:${item.channel}`===value);if(option)onChange(option.method,option.channel)}}>
      <SelectTrigger className="checkout-payment-compact-trigger"><SelectValue/></SelectTrigger>
    <SelectContent position="popper" align="start" className="checkout-payment-compact-options">{options.map(option=><SelectItem key={`${option.method}:${option.channel}`} value={`${option.method}:${option.channel}`} textValue={`${option.name}, ${paymentMethodLabel(option.method,locale)}`}><span className="checkout-payment-compact-option">{option.logo?<span className="checkout-payment-compact-logo"><Image src={option.logo} alt="" width={40} height={32} unoptimized onError={event=>{event.currentTarget.hidden=true}}/></span>:<PaymentMethodIcon method={option.method}/>}<span><strong>{option.name}</strong><small>{paymentMethodLabel(option.method,locale)}</small></span></span></SelectItem>)}</SelectContent>
    </Select>:<>{selectedOption&&options.filter(option=>option.method===selectedMethod).length>1&&<div className="checkout-payment-channel-grid" aria-label={paymentMethodLabel(selectedMethod,locale)}>{options.filter(option=>option.method===selectedMethod).map(option=><button type="button" key={`${option.method}:${option.channel}`} className={`checkout-payment-channel${selectedChannel===option.channel?' is-selected':''}`} aria-pressed={selectedChannel===option.channel} onClick={()=>onChange(option.method,option.channel)}>{option.logo?<Image src={option.logo} alt="" width={50} height={40} unoptimized onError={event=>{event.currentTarget.hidden=true}}/>:<PaymentMethodIcon method={option.method}/>}<span>{option.name}</span></button>)}</div>}</>}
    {!loading&&selectedOption&&(selectedMethod==='qris'?<p className="checkout-payment-estimate is-no-fee">{t('No extra payment fee','Tidak ada biaya pembayaran tambahan')}</p>:<p className="checkout-payment-estimate">{t(`Estimated payment fee: ${formatMoney(fee,'IDR')}. Final fees are shown before you pay.`,`Perkiraan biaya pembayaran: ${formatMoney(fee,'IDR')}. Biaya akhir ditampilkan sebelum pembayaran.`)}</p>)}
  </section>;
}
