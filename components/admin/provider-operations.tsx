'use client';

import {useCallback,useEffect,useState} from 'react';
import {ArrowClockwiseIcon as Refresh,ArrowSquareOutIcon as ExternalLink,WarningCircleIcon as Warning,CheckCircleIcon as Check,WalletIcon as Wallet,TruckIcon as Truck,CreditCardIcon as Card} from '@phosphor-icons/react';
import {formatMoney} from '@/packages/domain';

type Operations={generatedAt:string;settings:{ipaymuWarningBalance:number};ipaymu:{available:boolean;current:{merchantBalance:number;memberBalance:number;mode:string;checkedAt:string}|null;error:string|null;history:Array<{balance:number;mode:string;recordedAt:string}>};biteship:{balanceAvailable:boolean;historyAvailable:boolean;shipmentIssues:number;paidOrdersAwaitingShipment:number;daily:Array<{day:string;shipments:number;reportedCost:number}>};market:{orders:number;volume:number;unsuccessful:number}};
const money=(value:number)=>formatMoney(value,'IDR');
const dateTime=(value:string)=>new Intl.DateTimeFormat('en-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(value));

export function ProviderOperations(){
  const [data,setData]=useState<Operations|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  const [threshold,setThreshold]=useState('500000');
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const load=useCallback(async(silent=false)=>{
    if(silent)setRefreshing(true);
    try{const response=await fetch('/api/admin/operations',{cache:'no-store'});const result=await response.json() as Operations&{error?:string};if(!response.ok)throw new Error(result.error||'Operations data could not be loaded.');setData(result);setThreshold(String(result.settings.ipaymuWarningBalance));setError('')}
    catch(cause){setError(cause instanceof Error?cause.message:'Operations data could not be loaded.')}
    finally{setLoading(false);setRefreshing(false)}
  },[]);
  useEffect(()=>{const initial=window.setTimeout(()=>void load(),0);const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void load(true)},5*60_000);return()=>{window.clearTimeout(initial);window.clearInterval(interval)}},[load]);
  const save=async()=>{const value=Number(threshold);if(!Number.isSafeInteger(value)||value<0){setError('Enter a valid balance threshold.');return}setSaving(true);setSaved(false);try{const response=await fetch('/api/admin/operations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ipaymuWarningBalance:value})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'Threshold could not be saved.');setSaved(true);await load(true)}catch(cause){setError(cause instanceof Error?cause.message:'Threshold could not be saved.')}finally{setSaving(false)}};
  const lowBalance=Boolean(data?.ipaymu.current&&data.ipaymu.current.merchantBalance<=data.settings.ipaymuWarningBalance);
  const latestBalance=data?.ipaymu.current?.merchantBalance;
  const chart=data?.biteship.daily??[];
  const peak=Math.max(1,...chart.map(point=>point.reportedCost));
  const balanceHistory=data?.ipaymu.history??[];
  const balancePeak=Math.max(1,...balanceHistory.map(point=>point.balance),latestBalance??0);
  return <section className="admin-provider-operations">
    <div className="provider-ops-toolbar"><span>Balances are checked when this page opens.</span><button type="button" className="admin-refresh" disabled={loading||refreshing} onClick={()=>void load()}><Refresh size={15} className={refreshing?'spin':''}/>Refresh</button></div>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    {loading&&!data?<div className="admin-health-skeleton"><i/><i/><i/><i/></div>:data&&<>
      <section className="provider-operation-cards" aria-label="Provider status">
        <article className={`provider-operation-card${lowBalance?' is-warning':''}`}><header><span><Card size={18}/> iPaymu</span><b className={data.ipaymu.available?'is-ready':'is-unavailable'}>{data.ipaymu.available?'Connected':'Unavailable'}</b></header><strong>{latestBalance===undefined?'—':money(latestBalance)}</strong><p>{data.ipaymu.current?`${data.ipaymu.current.mode==='sandbox'?'Sandbox':'Production'} balance · checked ${dateTime(data.ipaymu.current.checkedAt)}`:'Live balance is not available.'}</p>{lowBalance&&<div className="provider-operation-alert"><Warning size={16}/><span>Balance is below your warning level.</span></div>}{data.ipaymu.error&&<small className="provider-operation-note">{data.ipaymu.error}</small>}</article>
        <article className="provider-operation-card"><header><span><Truck size={18}/> Biteship</span><a href="https://dashboard.biteship.com/" target="_blank" rel="noreferrer">Open dashboard <ExternalLink size={13}/></a></header><strong>{data.biteship.balanceAvailable?'Live balance connected':'Balance check unavailable'}</strong><p>Biteship has not published a balance endpoint for this integration. Shipment activity is monitored here.</p></article>
      </section>
      <section className="provider-operation-grid">
        <article className="provider-operation-panel"><header><div><h2>iPaymu balance</h2><p>Recent readings from the merchant account</p></div><Wallet size={19}/></header>{balanceHistory.length?<div className="provider-balance-chart" role="img" aria-label={`iPaymu balance readings, latest ${money(latestBalance??balanceHistory.at(-1)!.balance)}`}>{balanceHistory.slice(-30).map((point,index)=><span key={`${point.recordedAt}-${index}`} style={{height:`${Math.max(5,point.balance/balancePeak*100)}%`}} title={`${dateTime(point.recordedAt)} · ${money(point.balance)}`}/>)}</div>:<p className="provider-operation-empty">Balance history will appear after the next successful check.</p>}<small>{balanceHistory.length?`${balanceHistory.length} saved readings`:'No saved readings yet'}</small></article>
        <article className="provider-operation-panel"><header><div><h2>Shipping activity</h2><p>Biteship-reported charges for the last 30 days</p></div><Truck size={19}/></header><div className="provider-shipping-chart" role="img" aria-label="Daily reported shipping charges for the last 30 days">{chart.map(point=><span key={point.day} style={{height:`${point.reportedCost?Math.max(5,point.reportedCost/peak*100):2}%`}} title={`${point.day} · ${money(point.reportedCost)}`}/>)}</div><small>Amounts are based on Biteship order price updates.</small></article>
      </section>
      <section className="provider-operation-grid provider-operation-lower">
        <article className="provider-operation-panel"><header><div><h2>Needs attention</h2><p>Orders that may need a follow-up</p></div><Warning size={19}/></header><dl><div><dt>Paid, shipment not arranged</dt><dd>{data.biteship.paidOrdersAwaitingShipment}</dd></div><div><dt>Failed or returned shipments</dt><dd>{data.biteship.shipmentIssues}</dd></div><div><dt>Unsuccessful payments, 30 days</dt><dd>{data.market.unsuccessful}</dd></div></dl></article>
        <article className="provider-operation-panel"><header><div><h2>iPaymu warning level</h2><p>Show an alert when the merchant balance falls below this amount.</p></div><Check size={19}/></header><label className="provider-threshold-field"><span>Warning balance</span><span><b>IDR</b><input inputMode="numeric" type="number" min="0" step="50000" value={threshold} onChange={event=>{setThreshold(event.target.value);setSaved(false)}}/></span></label><button type="button" className="admin-refresh" disabled={saving} onClick={()=>void save()}>{saving?'Saving…':'Save level'}</button>{saved&&<small className="provider-threshold-saved">Saved</small>}</article>
      </section>
      <p className="provider-operation-updated">Updated {dateTime(data.generatedAt)}. This page refreshes every five minutes while open.</p>
    </>}
  </section>;
}
