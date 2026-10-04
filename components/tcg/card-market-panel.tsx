'use client';

import {ArrowSquareOutIcon as ArrowSquareOut} from '@phosphor-icons/react';
import {useEffect, useMemo, useState} from 'react';
import {priceChartingFallback,PRICECHARTING_USD_TO_IDR_RATE} from '@/lib/market/pricecharting';

type Observation = {amount:number; currency:string; observed_at:string; source_kind:string; source_record?:{payload?:{card_url?:unknown}}|null};
type SoldSale={unitAmount:number;quantity:number;soldAt:string};

function yuyuteiUrl(observation:Observation|undefined) { const url=observation?.source_record?.payload?.card_url; return typeof url==='string'&&url.startsWith('https://yuyu-tei.jp/')?url:undefined; }

function money(amount:number, currency:string) {
  return new Intl.NumberFormat('en-US', {style:'currency', currency, maximumFractionDigits:currency==='JPY'?0:2}).format(amount);
}

function formatDate(value:string,language:'EN'|'ID'='EN'){const timestamp=new Date(value.includes('T')?value:`${value.replace(' ','T')}Z`);return new Intl.DateTimeFormat(language==='ID'?'id-ID':'en-US',{month:'short',day:'numeric',year:'numeric'}).format(timestamp);}

function PriceLine({history,language}:{history:Observation[];language:'EN'|'ID'}) {
  const points=useMemo(()=>{
    const values=history.map(item=>item.amount); const low=Math.min(...values); const high=Math.max(...values); const range=high-low||1;
    return history.map((item,index)=>`${index/(history.length-1)*100},${100-(item.amount-low)/range*82-9}`).join(' ');
  },[history]);
  if(history.length<2||new Set(history.map(item=>item.amount)).size<2) return null;
  return <figure className="card-price-line" aria-label={language==='ID'?'Riwayat harga Yuyutei':'Yuyutei price history'}><figcaption><span>{language==='ID'?'Riwayat harga':'Price history'}</span><small><time dateTime={history[0].observed_at}>{formatDate(history[0].observed_at,language)}</time> - <time dateTime={history.at(-1)!.observed_at}>{formatDate(history.at(-1)!.observed_at,language)}</time></small></figcaption><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={language==='ID'?'Tren harga menurut pantauan Yuyutei':'Price trend across Yuyutei price checks'}><polyline points={points}/></svg></figure>;
}

function SoldHistory({printingId,language}:{printingId?:string;language:'EN'|'ID'}){
  const [result,setResult]=useState<{printingId:string;sales:SoldSale[]}|null>(null);
  useEffect(()=>{if(!printingId)return;let active=true;void fetch(`/api/market/sales?printingId=${encodeURIComponent(printingId)}`,{cache:'no-store'}).then(async response=>response.ok?await response.json() as {sales?:SoldSale[]}:{sales:[]}).then(data=>{if(active)setResult({printingId,sales:data.sales??[]})}).catch(()=>{if(active)setResult({printingId,sales:[]})});return()=>{active=false}},[printingId]);
  if(!printingId)return null;
  const sales=result?.printingId===printingId?result.sales:null;
  const id=language==='ID';
  return <section className="card-market-sales" aria-label={id?'Riwayat penjualan di VivrePlay Market':'VivrePlay Market sold history'}><header><span>{id?'Terjual di VivrePlay Market':'VivrePlay Market sold history'}</span><small>{id?'Cetakan persis':'Exact printing'}</small></header>{sales===null?<p>{id?'Memuat riwayat penjualan…':'Loading sold history…'}</p>:sales.length===0?<p>{id?'Belum ada pesanan Market selesai untuk cetakan ini.':'No completed Market orders for this printing yet.'}</p>:<><div className="card-market-sales-latest"><span>{id?'Penjualan terbaru':'Latest sold copy'}</span><strong>{money(sales[0].unitAmount,'IDR')}</strong><small>{id?`${sales[0].quantity} kartu`:`${sales[0].quantity} ${sales[0].quantity===1?'copy':'copies'}`} · {formatDate(sales[0].soldAt,language)}</small></div><ul>{sales.slice(0,8).map((sale,index)=><li key={`${sale.soldAt}-${index}`}><time dateTime={sale.soldAt}>{formatDate(sale.soldAt,language)}</time><span>{id?`${sale.quantity} kartu`:`${sale.quantity} ${sale.quantity===1?'copy':'copies'}`}</span><strong>{money(sale.unitAmount,'IDR')}</strong></li>)}</ul></>}</section>;
}

export function CardMarketPanel({printingId,onMarketPrice,printing}:{printingId?:string;onMarketPrice?:(amountIdr:number|null)=>void;printing?:{language?:string;setCode?:string;printingCode?:string;variant?:string}}) {
  const [savedHistory,setSavedHistory]=useState<{printingId:string;history:Observation[]}|null>(null);
  const history=printingId?(savedHistory?.printingId===printingId?savedHistory.history:undefined):[];
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');
  useEffect(()=>{
    const sync=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    sync();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);
  useEffect(()=>{if(!printingId){onMarketPrice?.(null);return}let active=true;void fetch(`/api/market/yuyutei?printingId=${encodeURIComponent(printingId)}`).then(async response=>response.ok?await response.json() as {history?:Observation[];jpyToIdrRate?:number}:{history:[]}).then(result=>{if(active){const observations=result.history??[];setSavedHistory({printingId,history:observations});const latest=observations.at(-1);const rate=result.jpyToIdrRate&&Number.isFinite(result.jpyToIdrRate)?result.jpyToIdrRate:110;const normalized=latest?(latest.currency.toUpperCase()==='JPY'?Math.round(latest.amount*rate):latest.currency.toUpperCase()==='IDR'?latest.amount:null):null;onMarketPrice?.(normalized)}},()=>{if(active){setSavedHistory({printingId,history:[]});onMarketPrice?.(null)}});return()=>{active=false};},[printingId,onMarketPrice]);
  const fallback=printing?priceChartingFallback(printing):undefined;
  const fallbackAmount=fallback?.amount;
  useEffect(()=>{if(history!==undefined&&!history.at(-1)&&fallbackAmount)onMarketPrice?.(Math.round(fallbackAmount*PRICECHARTING_USD_TO_IDR_RATE));},[history,fallbackAmount,onMarketPrice]);
  if(!history) return <div className="card-market-comparison"><section className="card-market-panel is-loading" aria-label={language==='ID'?'Memuat harga pasar':'Loading market price'}><p>{language==='ID'?'Memuat tolok ukur pasar...':'Loading market benchmark...'}</p></section><SoldHistory printingId={printingId} language={language}/></div>;
  const benchmark=history.at(-1);
  if(!benchmark){
    if(fallback)return <div className="card-market-comparison"><section className="card-market-panel" aria-label="PriceCharting ungraded market reference"><header><span>{language==='ID'?'Referensi harga':'Market price reference'}</span><small>PriceCharting · ungraded</small></header><div className="card-market-price"><strong>{money(fallback.amount,fallback.currency)}</strong><span>{language==='ID'?'Panduan kartu tanpa grading':'Ungraded card guide price'}</span></div><a className="card-market-source" href={fallback.url} target="_blank" rel="noopener noreferrer">{language==='ID'?'Lihat PriceCharting':'View PriceCharting'}<ArrowSquareOut size={14}/></a></section><SoldHistory printingId={printingId} language={language}/></div>;
    return <div className="card-market-comparison"><section className="card-market-panel" aria-label={language==='ID'?'Harga pasar':'Market price'}><header><span>{language==='ID'?'Harga pasar':'Market price'}</span><small>Yuyutei</small></header><p>{language==='ID'?'Belum ada riwayat harga untuk cetakan ini.':'No price is recorded for this exact printing.'}</p></section><SoldHistory printingId={printingId} language={language}/></div>;
  }
  const listingUrl=yuyuteiUrl(benchmark); return <div className="card-market-comparison"><section className="card-market-panel" aria-label={language==='ID'?'Harga pasar Yuyutei':'Yuyutei market price'}><header><span>{language==='ID'?'Harga pasar':'Market price'}</span><small>Yuyutei</small></header><div className="card-market-price"><strong>{money(benchmark.amount,benchmark.currency)}</strong><time dateTime={benchmark.observed_at}>{language==='ID'?'Tercatat ':'Observed '}{formatDate(benchmark.observed_at,language)}</time></div><PriceLine history={history} language={language}/>{listingUrl&&<a className="card-market-source" href={listingUrl} target="_blank" rel="noopener noreferrer">{language==='ID'?'Lihat kartu di Yuyutei':'View card on Yuyutei'}<ArrowSquareOut size={14}/></a>}</section><SoldHistory printingId={printingId} language={language}/></div>;
}
