'use client';

import {useId,useState} from 'react';
import {InfoIcon as Info} from '@phosphor-icons/react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {calculateBuyerServiceFee,getMarketBuyerFeeCap,MARKET_BUYER_FEE_CAP_BANDS,MARKET_BUYER_FEE_PERCENT,MARKET_PRO_BUYER_FEE_PERCENT} from '@/lib/market/policy';

export function MarketBuyerFeeCapTable({locale='en',className=''}:{locale?:'en'|'id';className?:string}){
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
    <div className="market-buyer-fee-cap-scroll">
      <table>
        <thead><tr><th scope="col">{locale==='id'?'Subtotal kartu':'Card subtotal'}</th><th scope="col">{locale==='id'?'Maksimum biaya':'Maximum fee'}</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.range}><th scope="row">{row.range}</th><td>{row.cap}</td></tr>)}</tbody>
      </table>
    </div>
  </section>;
}

export function BuyerFeeInfo({locale='en'}:{locale?:'en'|'id'}){
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
          <DialogDescription>{id?'Dihitung dari subtotal kartu. Ongkir dihitung terpisah.':'Calculated from the card subtotal. Delivery is separate.'}</DialogDescription>
        </DialogHeader>
        <label className="buyer-fee-example-input">{id?'Contoh subtotal kartu':'Example card subtotal'}
          <span><b>IDR</b><input type="number" min="0" step="100000" inputMode="numeric" value={subtotal} onChange={event=>setSubtotal(event.target.value)}/></span>
        </label>
        <dl className="buyer-fee-example-results">
          <div><dt>Free ({MARKET_BUYER_FEE_PERCENT}%)</dt><dd>{format.format(calculateBuyerServiceFee(amount,MARKET_BUYER_FEE_PERCENT))}</dd></div>
          <div><dt>Pro ({MARKET_PRO_BUYER_FEE_PERCENT}%)</dt><dd>{format.format(calculateBuyerServiceFee(amount,MARKET_PRO_BUYER_FEE_PERCENT))}</dd></div>
          <small>{id?`Batas biaya untuk subtotal ini: ${format.format(feeCap)}.`:`Fee cap for this subtotal: ${format.format(feeCap)}.`}</small>
        </dl>
        <MarketBuyerFeeCapTable locale={locale} className="buyer-fee-info-cap-table"/>
      </DialogContent>
    </Dialog>
  </>;
}
