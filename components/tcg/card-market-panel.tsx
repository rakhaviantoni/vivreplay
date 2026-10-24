'use client';

import LocalizedAnchor from '@/components/ui/localized-link';
import {useRouteLocale} from '@/components/locale-provider';
import Link from '@/components/ui/localized-link';
import {ArrowSquareOutIcon as ArrowSquareOut} from '@phosphor-icons/react';
import {marketListingPath} from '@/lib/market/listing-url';
import {useEffect, useMemo, useState} from 'react';
import {priceChartingFallback,PRICECHARTING_USD_TO_IDR_RATE} from '@/lib/market/pricecharting';
import {pokemonPublicReference} from '@/lib/pokemon-public-reference';

type Observation = {amount:number; currency:string; observed_at:string; source_kind:string; source_record?:{payload?:{card_url?:unknown}}|null};
type SoldSale={unitAmount:number;quantity:number;soldAt:string};
type ActiveListing={id:string;title:string;amount:number;currency:string;quantity:number;condition:string;city:string;seller:string;negotiable:boolean;createdAt:string};

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

function SoldHistory({printingId,language,game}:{printingId?:string;language:'EN'|'ID';game:'onepiece'|'pokemon'}){
  const [result,setResult]=useState<{printingId:string;sales:SoldSale[]}|null>(null);
  useEffect(()=>{if(!printingId)return;let active=true;void fetch(`/api/market/sales?printingId=${encodeURIComponent(printingId)}`,{cache:'no-store'}).then(async response=>response.ok?await response.json() as {sales?:SoldSale[]}:{sales:[]}).then(data=>{if(active)setResult({printingId,sales:data.sales??[]})}).catch(()=>{if(active)setResult({printingId,sales:[]})});return()=>{active=false}},[printingId]);
  if(!printingId)return null;
  const sales=result?.printingId===printingId?result.sales:null;
  const id=language==='ID';
  const objectLabel=game==='pokemon'?(id?'kartu ini':'this card'):(id?'cetakan ini':'this printing');
  return <div className="card-market-sales" aria-label={id?'Riwayat penjualan di VivrePlay Market':'VivrePlay Market sold history'}><header><span>{id?'Terjual di VivrePlay Market':'Sold on VivrePlay Market'}</span></header>{sales===null?<div className="card-market-sales-skeleton" role="status" aria-label={id?'Memuat riwayat penjualan':'Loading sales history'}><i/><i/><i/></div>:sales.length===0?<p>{id?`Belum ada penjualan untuk ${objectLabel}.`:`No completed sales for ${objectLabel} yet.`}</p>:<><div className="card-market-sales-latest"><span>{id?'Penjualan terbaru':'Latest sale'}</span><strong>{money(sales[0].unitAmount,'IDR')}</strong><small>{id?`${sales[0].quantity} kartu`:`${sales[0].quantity} ${sales[0].quantity===1?'copy':'copies'}`} | {formatDate(sales[0].soldAt,language)}</small></div><ul>{sales.slice(0,8).map((sale,index)=><li key={`${sale.soldAt}-${index}`}><time dateTime={sale.soldAt}>{formatDate(sale.soldAt,language)}</time><span>{id?`${sale.quantity} kartu`:`${sale.quantity} ${sale.quantity===1?'copy':'copies'}`}</span><strong>{money(sale.unitAmount,'IDR')}</strong></li>)}</ul></>}</div>;
}

function ActivePrintingListings({printingId,language,game}:{printingId?:string;language:'EN'|'ID';game:'onepiece'|'pokemon'}){
  const [result,setResult]=useState<{printingId:string;listings:ActiveListing[]}|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{if(!printingId)return;let active=true;setFailed(false);void fetch(`/api/market/printing-listings?printingId=${encodeURIComponent(printingId)}`,{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('Listings unavailable');return await response.json() as {listings?:ActiveListing[]}}).then(data=>{if(active)setResult({printingId,listings:data.listings??[]})}).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[printingId]);
  if(!printingId)return null;
  const listings=result?.printingId===printingId?result.listings:null;
  const id=language==='ID';
  const objectLabel=game==='pokemon'?(id?'kartu ini':'this card'):(id?'cetakan ini':'this printing');
  return <div className="card-market-active-listings" aria-label={id?'Listing aktif di Market':'Current Market listings'}><header><span>{id?'Listing aktif':'For sale now'}</span></header>{listings===null?<p>{failed?<button type="button" className="card-market-retry" onClick={()=>{setResult(null);setFailed(false);void fetch(`/api/market/printing-listings?printingId=${encodeURIComponent(printingId)}`,{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error();return await response.json() as {listings?:ActiveListing[]}}).then(data=>setResult({printingId,listings:data.listings??[]})).catch(()=>setFailed(true))}}>{id?'Coba lagi':'Retry'}</button>:<span className="card-market-listing-loading" aria-label={id?'Memuat listing':'Loading listings'}/>}</p>:listings.length===0?<p>{id?`Belum ada listing aktif untuk ${objectLabel}.`:`No active listings for ${objectLabel} yet.`}</p>:<ul>{listings.slice(0,4).map(listing=><li key={listing.id}><div className="card-market-listing-main"><Link href={marketListingPath(listing.title,listing.id)}>{listing.title}</Link><small>{[listing.seller,listing.city,listing.condition,listing.negotiable?(id?'Bisa ditawar':'Offers welcome'):(id?'Harga pas':'Firm price')].filter(Boolean).join(' | ')}</small></div><div className="card-market-listing-price"><strong>{money(listing.amount,listing.currency)}</strong><small>{id?`${listing.quantity} tersedia`:`${listing.quantity} available`}</small></div></li>)}</ul>}</div>;
}

export function CardMarketPanel({printingId,onMarketPrice,printing,disableExternalPrice=false,game='onepiece'}:{printingId?:string;onMarketPrice?:(amountIdr:number|null)=>void;printing?:{language?:string;setCode?:string;printingCode?:string;localCardNumber?:string;variant?:string};disableExternalPrice?:boolean;game?:'onepiece'|'pokemon'}) {
  const [savedHistory,setSavedHistory]=useState<{printingId:string;history:Observation[]}|null>(null);
  const usesYuyutei=!disableExternalPrice&&printing?.language?.toUpperCase()==='JP';
  const history=printingId?(savedHistory?.printingId===printingId?savedHistory.history:undefined):[];
  const [language,setLanguage]=useState<'EN'|'ID'>(useRouteLocale());
  useEffect(()=>{
    const sync=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    sync();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);
  useEffect(()=>{if(!printingId){onMarketPrice?.(null);return}if(!usesYuyutei){setSavedHistory({printingId,history:[]});onMarketPrice?.(null);return}let active=true;void fetch(`/api/market/yuyutei?printingId=${encodeURIComponent(printingId)}`).then(async response=>response.ok?await response.json() as {history?:Observation[];jpyToIdrRate?:number}:{history:[]}).then(result=>{if(active){const observations=result.history??[];setSavedHistory({printingId,history:observations});const latest=observations.at(-1);const rate=result.jpyToIdrRate&&Number.isFinite(result.jpyToIdrRate)?result.jpyToIdrRate:110;const normalized=latest?(latest.currency.toUpperCase()==='JPY'?Math.round(latest.amount*rate):latest.currency.toUpperCase()==='IDR'?latest.amount:null):null;onMarketPrice?.(normalized)}},()=>{if(active){setSavedHistory({printingId,history:[]});onMarketPrice?.(null)}});return()=>{active=false};},[printingId,onMarketPrice,usesYuyutei]);
  const fallback=usesYuyutei&&printing?priceChartingFallback(printing):undefined;
  const fallbackAmount=fallback?.amount;
  useEffect(()=>{if(history!==undefined&&!history.at(-1)&&fallbackAmount)onMarketPrice?.(Math.round(fallbackAmount*PRICECHARTING_USD_TO_IDR_RATE));},[history,fallbackAmount,onMarketPrice]);
  const benchmark=history?.at(-1);
  const listingUrl=benchmark?yuyuteiUrl(benchmark):undefined;
  const id=language==='ID';
  const printingLabel=game==='pokemon'
    ?pokemonPublicReference({setCode:printing?.setCode,printingCode:printing?.printingCode,localCardNumber:printing?.localCardNumber})
    :printing?.printingCode;
  return <section className="card-market-panel" aria-label={id?'Aktivitas pasar kartu':'Card market activity'}>
    <header><span>{id?'Aktivitas pasar':'Market activity'}</span>{printingLabel&&<small>{printingLabel}{printing?.variant&&printing.variant!=='Standard'?` | ${printing.variant}`:''}</small>}</header>
    {usesYuyutei&&<div className="card-market-benchmark">
      <div className="card-market-benchmark-heading"><span>{id?'Harga referensi':'Reference price'}</span><small>Yuyutei</small></div>
      {!history?<div className="card-market-price-skeleton" role="status" aria-label={id?'Memuat harga referensi':'Loading reference price'}><i/><i/></div>:benchmark?<><div className="card-market-price"><strong>{money(benchmark.amount,benchmark.currency)}</strong><time dateTime={benchmark.observed_at}>{formatDate(benchmark.observed_at,language)}</time></div><PriceLine history={history} language={language}/>{listingUrl&&<LocalizedAnchor className="card-market-source" href={listingUrl} target="_blank" rel="noopener noreferrer">{id?'Lihat sumber':'Source'}<ArrowSquareOut size={14}/></LocalizedAnchor>}</>:fallback?<><div className="card-market-price"><strong>{money(fallback.amount,fallback.currency)}</strong><span>{id?'Panduan kartu tanpa grading':'Ungraded card guide'}</span></div><LocalizedAnchor className="card-market-source" href={fallback.url} target="_blank" rel="noopener noreferrer">{id?'Lihat sumber':'Source'}<ArrowSquareOut size={14}/></LocalizedAnchor></>:<p>{id?'Belum ada harga untuk cetakan ini.':'No reference price for this printing.'}</p>}
    </div>}
    <div className="card-market-sections"><ActivePrintingListings printingId={printingId} language={language} game={game}/><SoldHistory printingId={printingId} language={language} game={game}/></div>
  </section>;
}
