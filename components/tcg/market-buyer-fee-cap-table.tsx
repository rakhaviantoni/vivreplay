'use client';

import {useId,useState} from 'react';
import {InfoIcon as Info} from '@phosphor-icons/react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {calculateBuyerServiceFee,calculateSellerServiceFee,getMarketBuyerFeeCap,MARKET_BUYER_FEE_CAP_BANDS,MARKET_BUYER_FEE_MINIMUM,MARKET_SELLER_FEE_MINIMUM} from '@/lib/market/policy';

export function MarketBuyerFeeCapTable({locale='en',className='',minimum=MARKET_BUYER_FEE_MINIMUM}:{locale?:'en'|'id';className?:string;minimum?:number}){
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
    <p className="market-buyer-fee-cap-note">{locale==='id'?`Minimum biaya pembeli ${format.format(minimum)}. Batas berikut tetap berlaku.`:`Buyer fee minimum: ${format.format(minimum)}. These caps still apply.`}</p>
    <div className="market-buyer-fee-cap-scroll">
      <table>
        <thead><tr><th scope="col">{locale==='id'?'Subtotal kartu':'Card subtotal'}</th><th scope="col">{locale==='id'?'Maksimum biaya':'Maximum fee'}</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.range}><th scope="row">{row.range}</th><td>{row.cap}</td></tr>)}</tbody>
      </table>
    </div>
  </section>;
}

export function MarketServiceFeeInfo({locale='en',defaultTab='buyer',freePercent=1.5,proPercent=0.75,buyerMinimum=MARKET_BUYER_FEE_MINIMUM,sellerMinimum=MARKET_SELLER_FEE_MINIMUM}:{locale?:'en'|'id';defaultTab?:'buyer'|'seller';freePercent?:number;proPercent?:number;buyerMinimum?:number;sellerMinimum?:number}){
  const [open,setOpen]=useState(false);
  const [tab,setTab]=useState<'buyer'|'seller'>(defaultTab);
  const [subtotal,setSubtotal]=useState('3500000');
  const id=locale==='id';
  const amount=Math.max(0,Number(subtotal)||0);
  const format=new Intl.NumberFormat(id?'id-ID':'en-US',{style:'currency',currency:'IDR',maximumFractionDigits:0});
  const buyer=tab==='buyer';
  const fee=(percent:number)=>buyer?calculateBuyerServiceFee(amount,percent,buyerMinimum):calculateSellerServiceFee(amount,percent,sellerMinimum);
  const feeCap=getMarketBuyerFeeCap(amount);
  return <>
    <button type="button" className="buyer-fee-info-trigger" aria-label={id?'Info biaya layanan Market':'Market service fee information'} aria-haspopup="dialog" onClick={()=>{setTab(defaultTab);setOpen(true)}}><Info size={14}/></button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="buyer-fee-info-dialog">
        <DialogHeader>
          <DialogTitle>{id?'Biaya layanan Market':'Market service fee'}</DialogTitle>
          <DialogDescription>{buyer?(id?`Minimum ${format.format(buyerMinimum)}. Batas biaya berlaku; ongkir dihitung terpisah.`:`${format.format(buyerMinimum)} minimum. Fee caps apply; delivery is separate.`):(id?`Minimum ${format.format(sellerMinimum)}, dipotong dari hasil penjualan. Biaya tidak melebihi subtotal kartu.`:`${format.format(sellerMinimum)} minimum, deducted from sale proceeds. The fee cannot exceed the card subtotal.`)}</DialogDescription>
        </DialogHeader>
        <div className="market-fee-role-tabs" role="tablist" aria-label={id?'Jenis biaya':'Fee type'}>
          <button type="button" role="tab" aria-selected={buyer} onClick={()=>setTab('buyer')}>{id?'Pembeli':'Buyer'}</button>
          <button type="button" role="tab" aria-selected={!buyer} onClick={()=>setTab('seller')}>{id?'Penjual':'Seller'}</button>
        </div>
        <label className="buyer-fee-example-input">{id?'Contoh subtotal kartu':'Example card subtotal'}
          <span><b>IDR</b><input type="number" min="0" step="100000" inputMode="numeric" value={subtotal} onChange={event=>setSubtotal(event.target.value)}/></span>
        </label>
        <dl className="buyer-fee-example-results">
          <div><dt>Free ({freePercent}%)</dt><dd>{format.format(fee(freePercent))}</dd></div>
          <div><dt>Pro ({proPercent}%)</dt><dd>{format.format(fee(proPercent))}</dd></div>
          {buyer&&<small>{id?`Batas biaya untuk subtotal ini: ${format.format(feeCap)}.`:`Fee cap for this subtotal: ${format.format(feeCap)}.`}</small>}
        </dl>
        {buyer&&<MarketBuyerFeeCapTable locale={locale} minimum={buyerMinimum} className="buyer-fee-info-cap-table"/>}
      </DialogContent>
    </Dialog>
  </>;
}

export function BuyerFeeInfo({locale='en'}:{locale?:'en'|'id'}){
  return <MarketServiceFeeInfo locale={locale} defaultTab="buyer"/>;
}

export function SellerFeeInfo({locale='en',freePercent=1.5,proPercent=0.75}:{locale?:'en'|'id';freePercent?:number;proPercent?:number}){
  return <MarketServiceFeeInfo locale={locale} defaultTab="seller" freePercent={freePercent} proPercent={proPercent}/>;
}
