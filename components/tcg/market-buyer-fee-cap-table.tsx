'use client';

import {useId,useState} from 'react';
import {InfoIcon as Info} from '@phosphor-icons/react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {calculateBuyerServiceFee,calculateSellerServiceFee,getMarketBuyerFeeCap,MARKET_BUYER_FEE_CAP_BANDS,MARKET_BUYER_FEE_PERCENT,MARKET_PRO_BUYER_FEE_PERCENT,MARKET_BUYER_FEE_MINIMUM,MARKET_SELLER_FEE_MINIMUM} from '@/lib/market/policy';

export function MarketBuyerFeeCapTable({locale='en',className='',minimumFee=MARKET_BUYER_FEE_MINIMUM}:{locale?:'en'|'id';className?:string;minimumFee?:number}){
  const titleId=`market-buyer-fee-cap-${useId().replaceAll(':','')}`;
  const format=new Intl.NumberFormat(locale==='id'?'id-ID':'en-US',{style:'currency',currency:'IDR',maximumFractionDigits:0});
  const rows=MARKET_BUYER_FEE_CAP_BANDS.map((band,index)=>{
    const previous=MARKET_BUYER_FEE_CAP_BANDS[index-1];
    const range=index===0
      ?`${locale==='id'?'Sampai':'Up to'} ${format.format(band.maxSubtotal)}`
      :Number.isFinite(band.maxSubtotal)
        ?`${format.format(previous!.maxSubtotal+1)} – ${format.format(band.maxSubtotal)}`
        :`${locale==='id'?'Di atas':'Over'} ${format.format(previous!.maxSubtotal)}`;
    return {range,cap:format.format(band.cap)};
  });

  return <section className={`market-buyer-fee-cap ${className}`.trim()} aria-labelledby={titleId}>
    <h3 id={titleId}>{locale==='id'?'Batas biaya pembeli':'Buyer fee caps'}</h3>
    <p className="market-buyer-fee-cap-note">{locale==='id'?`Biaya minimum ${format.format(minimumFee)}; batas pada tabel tetap berlaku.`:`Minimum fee ${format.format(minimumFee)}; the caps below still apply.`}</p>
    <div className="market-buyer-fee-cap-scroll">
      <table>
        <thead><tr><th scope="col">{locale==='id'?'Subtotal kartu':'Card subtotal'}</th><th scope="col">{locale==='id'?'Maksimum biaya':'Maximum fee'}</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.range}><th scope="row">{row.range}</th><td>{row.cap}</td></tr>)}</tbody>
      </table>
    </div>
  </section>;
}

export function BuyerFeeInfo({locale='en',minimumFee=MARKET_BUYER_FEE_MINIMUM}:{locale?:'en'|'id';minimumFee?:number}){
  const [open,setOpen]=useState(false);
  const [subtotal,setSubtotal]=useState('3500000');
  const id=locale==='id';
  const amount=Math.max(0,Number(subtotal)||0);
  const format=new Intl.NumberFormat(id?'id-ID':'en-US',{style:'currency',currency:'IDR',maximumFractionDigits:0});
  const feeCap=getMarketBuyerFeeCap(amount);
  return <>
    <button type="button" className="buyer-fee-info-trigger" aria-label={id?'Info biaya pembeli':'Buyer fee information'} aria-haspopup="dialog" onClick={()=>setOpen(true)}><Info size={14}/></button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="buyer-fee-info-dialog">
        <DialogHeader>
          <DialogTitle>{id?'Biaya pembeli':'Buyer fee'}</DialogTitle>
          <DialogDescription>{id?`Dihitung dari subtotal kartu, minimal ${format.format(minimumFee)}. Ongkir dihitung terpisah.`:`Calculated from the card subtotal, with a ${format.format(minimumFee)} minimum. Delivery is separate.`}</DialogDescription>
        </DialogHeader>
        <label className="buyer-fee-example-input">{id?'Contoh subtotal kartu':'Example card subtotal'}
          <span><b>IDR</b><input type="number" min="0" step="100000" inputMode="numeric" value={subtotal} onChange={event=>setSubtotal(event.target.value)}/></span>
        </label>
        <dl className="buyer-fee-example-results">
          <div><dt>Free ({MARKET_BUYER_FEE_PERCENT}%)</dt><dd>{format.format(calculateBuyerServiceFee(amount,MARKET_BUYER_FEE_PERCENT,minimumFee))}</dd></div>
          <div><dt>Pro ({MARKET_PRO_BUYER_FEE_PERCENT}%)</dt><dd>{format.format(calculateBuyerServiceFee(amount,MARKET_PRO_BUYER_FEE_PERCENT,minimumFee))}</dd></div>
          <small>{id?`Batas biaya untuk subtotal ini: ${format.format(feeCap)}.`:`Fee cap for this subtotal: ${format.format(feeCap)}.`}</small>
        </dl>
        <MarketBuyerFeeCapTable locale={locale} minimumFee={minimumFee} className="buyer-fee-info-cap-table"/>
      </DialogContent>
    </Dialog>
  </>;
}

export function SellerFeeInfo({locale='en',freePercent=1,proPercent=0.5,minimumFee=MARKET_SELLER_FEE_MINIMUM}:{locale?:'en'|'id';freePercent?:number;proPercent?:number;minimumFee?:number}){
  const [open,setOpen]=useState(false);
  const [subtotal,setSubtotal]=useState('3500000');
  const id=locale==='id';
  const amount=Math.max(0,Number(subtotal)||0);
  const format=new Intl.NumberFormat(id?'id-ID':'en-US',{style:'currency',currency:'IDR',maximumFractionDigits:0});
  return <>
    <button type="button" className="buyer-fee-info-trigger" aria-label={id?'Info biaya penjual':'Seller fee information'} aria-haspopup="dialog" onClick={()=>setOpen(true)}><Info size={14}/></button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="buyer-fee-info-dialog">
        <DialogHeader>
          <DialogTitle>{id?'Biaya penjual':'Seller fee'}</DialogTitle>
          <DialogDescription>{id?`Dipotong dari hasil penjualan berdasarkan subtotal kartu, minimal ${format.format(minimumFee)}. Biaya tidak melebihi subtotal.`:`Taken from your sale proceeds based on the card subtotal, with a ${format.format(minimumFee)} minimum. It cannot exceed the subtotal.`}</DialogDescription>
        </DialogHeader>
        <label className="buyer-fee-example-input">{id?'Contoh subtotal kartu':'Example card subtotal'}
          <span><b>IDR</b><input type="number" min="0" step="100000" inputMode="numeric" value={subtotal} onChange={event=>setSubtotal(event.target.value)}/></span>
        </label>
        <dl className="buyer-fee-example-results">
          <div><dt>Free ({freePercent}%)</dt><dd>{format.format(calculateSellerServiceFee(amount,freePercent,minimumFee))}</dd></div>
          <div><dt>Pro ({proPercent}%)</dt><dd>{format.format(calculateSellerServiceFee(amount,proPercent,minimumFee))}</dd></div>
        </dl>
      </DialogContent>
    </Dialog>
  </>;
}
