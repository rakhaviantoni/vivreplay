'use client';

import {ArrowSquareOutIcon as ArrowSquareOut} from '@phosphor-icons/react';
import {useEffect, useMemo, useState} from 'react';

type Observation = {amount:number; currency:string; observed_at:string; source_kind:string; source_record?:{payload?:{card_url?:unknown}}|null};

function yuyuteiUrl(observation:Observation|undefined) { const url=observation?.source_record?.payload?.card_url; return typeof url==='string'&&url.startsWith('https://yuyu-tei.jp/')?url:undefined; }

function money(amount:number, currency:string) {
  return new Intl.NumberFormat('en-US', {style:'currency', currency, maximumFractionDigits:currency==='JPY'?0:2}).format(amount);
}

function formatDate(value:string){return new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value));}

function PriceLine({history}:{history:Observation[]}) {
  const points=useMemo(()=>{
    const values=history.map(item=>item.amount); const low=Math.min(...values); const high=Math.max(...values); const range=high-low||1;
    return history.map((item,index)=>`${index/(history.length-1)*100},${100-(item.amount-low)/range*82-9}`).join(' ');
  },[history]);
  if(history.length<2||new Set(history.map(item=>item.amount)).size<2) return null;
  return <figure className="card-price-line" aria-label="Yuyutei price history"><figcaption><span>Price history</span><small><time dateTime={history[0].observed_at}>{formatDate(history[0].observed_at)}</time> – <time dateTime={history.at(-1)!.observed_at}>{formatDate(history.at(-1)!.observed_at)}</time></small></figcaption><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Price trend across Yuyutei price checks"><polyline points={points}/></svg></figure>;
}

export function CardMarketPanel({printingId}:{printingId?:string}) {
  const [history,setHistory]=useState<Observation[]>();
  useEffect(()=>{if(!printingId){setHistory([]);return}let active=true;setHistory(undefined);void fetch(`/api/market/yuyutei?printingId=${encodeURIComponent(printingId)}`).then(async response=>response.ok?await response.json() as {history?:Observation[]}:{history:[]}).then(result=>{if(active)setHistory(result.history??[])},()=>{if(active)setHistory([])});return()=>{active=false};},[printingId]);
  if(!history) return <section className="card-market-panel is-loading" aria-label="Loading market price"><p>Loading market benchmark…</p></section>;
  const benchmark=history.at(-1);
  if(!benchmark) return <section className="card-market-panel" aria-label="Market price"><header><span>Market price</span><small>Yuyutei</small></header><p>No price is recorded for this exact printing.</p></section>;
  const listingUrl=yuyuteiUrl(benchmark); return <section className="card-market-panel" aria-label="Yuyutei market price"><header><span>Market price</span><small>Yuyutei</small></header><div className="card-market-price"><strong>{money(benchmark.amount,benchmark.currency)}</strong><time dateTime={benchmark.observed_at}>Observed {formatDate(benchmark.observed_at)}</time></div><PriceLine history={history}/>{listingUrl&&<a className="card-market-source" href={listingUrl} target="_blank" rel="noopener noreferrer">View card on Yuyutei<ArrowSquareOut size={14}/></a>}</section>;
}
