'use client';

import {useCallback,useEffect,useState} from 'react';
import {ArrowClockwiseIcon as Refresh,ChartLineUpIcon as Trend,UsersThreeIcon as Users,CrownSimpleIcon as Crown,ShoppingBagOpenIcon as Orders} from '@phosphor-icons/react';

type Day={day:string;accounts:number;orders:number;volume:number};
type Data={generatedAt:string;accounts:number;proAccounts:number;daily:Day[]};
const count=new Intl.NumberFormat('en-US');
const money=new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0});

function TrendChart({title,caption,values,dates,color,formatter=count.format}:{title:string;caption:string;values:number[];dates:string[];color:string;formatter?:(value:number)=>string}){
  const width=680,height=210,padX=12,padY=18;
  const high=Math.max(1,...values);
  const points=values.map((value,index)=>`${padX+(width-padX*2)*(index/Math.max(1,values.length-1))},${height-padY-(height-padY*2)*(value/high)}`).join(' ');
  const area=`${padX},${height-padY} ${points} ${width-padX},${height-padY}`;
  const labels=[dates[0],dates[Math.floor((dates.length-1)/2)],dates.at(-1)].map(value=>value?new Intl.DateTimeFormat('en',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`)):'');
  return <section className="admin-chart-panel">
    <header><div><h2>{title}</h2><p>{caption}</p></div><strong>{formatter(values.reduce((sum,value)=>sum+value,0))}</strong></header>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} trend for the last 30 days`} preserveAspectRatio="none">
      {[0,1,2,3].map(line=><line key={line} x1={padX} x2={width-padX} y1={padY+(height-padY*2)*line/3} y2={padY+(height-padY*2)*line/3} className="admin-chart-gridline"/>)}
      <polygon points={area} fill={color} opacity=".12"/>
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
      {values.map((value,index)=><circle key={index} cx={padX+(width-padX*2)*(index/Math.max(1,values.length-1))} cy={height-padY-(height-padY*2)*(value/high)} r="2.5" fill={color}/>)}
    </svg>
    <footer><span>{labels[0]}</span><span>{labels[1]}</span><span>{labels[2]}</span></footer>
  </section>;
}

export function AdminOverview(){
  const [data,setData]=useState<Data|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{const response=await fetch('/api/admin/dashboard',{cache:'no-store'});const body=await response.json() as Data&{error?:string};if(!response.ok)throw new Error(body.error??'Dashboard data could not be loaded.');setData(body);}
    catch(reason){setError(reason instanceof Error?reason.message:'Dashboard data could not be loaded.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load()},[load]);
  const days=data?.daily??[];
  return <section className="admin-overview" aria-label="Dashboard overview">
    <div className="admin-overview-heading"><div><p className="eyebrow">LAST 30 DAYS</p><h2>Market at a glance</h2><p>Accounts, paid orders, and sales activity.</p></div><button type="button" className="admin-refresh" onClick={()=>void load()} disabled={loading}><Refresh size={15} className={loading?'spin':''}/>Refresh</button></div>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    {loading&&!data?<div className="admin-overview-loading" aria-label="Loading dashboard"><i/><i/><i/><i/></div>:data&&<>
      <div className="admin-overview-stats">
        <article><span><Users size={16}/>Accounts</span><strong>{count.format(data.accounts)}</strong><small>All collector accounts</small></article>
        <article><span><Crown size={16}/>Market Pro</span><strong>{count.format(data.proAccounts)}</strong><small>Active memberships</small></article>
        <article><span><Orders size={16}/>Paid orders</span><strong>{count.format(days.reduce((sum,day)=>sum+day.orders,0))}</strong><small>Market orders, last 30 days</small></article>
        <article><span><Trend size={16}/>Card sales</span><strong>{money.format(days.reduce((sum,day)=>sum+day.volume,0))}</strong><small>Card subtotal, last 30 days</small></article>
      </div>
      <div className="admin-overview-charts">
        <TrendChart title="New accounts" caption="Accounts created per day" values={days.map(day=>day.accounts)} dates={days.map(day=>day.day)} color="#aa6a13"/>
        <TrendChart title="Paid orders" caption="Completed payments per day" values={days.map(day=>day.orders)} dates={days.map(day=>day.day)} color="#34775a"/>
      </div>
      <p className="admin-overview-updated">Updated {new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(data.generatedAt))} WIB</p>
    </>}
  </section>;
}

type Customer={id:string;username:string|null;display_name:string;tier:string;pro_expires_at:string|null;created_at:string;email:string|null};
type CustomerResponse={customers:Customer[];nextCursor:string|null;error?:string};
const dateFormat=new Intl.DateTimeFormat('en',{dateStyle:'medium'});
const asDate=(value:string)=>new Date(value.includes('T')?value:`${value.replace(' ','T')}Z`);

export function AdminCustomerManager(){
  const [query,setQuery]=useState('');
  const [tier,setTier]=useState('all');
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [cursor,setCursor]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState<Customer|null>(null);
  const [append,setAppend]=useState(false);
  const load=useCallback(async(search:string,selectedTier:string,next:string|null,more:boolean)=>{
    setLoading(true);setError('');
    try{
      const params=new URLSearchParams({view:'customers'});if(search.trim())params.set('q',search.trim());if(selectedTier!=='all')params.set('tier',selectedTier);if(next)params.set('cursor',next);
      const response=await fetch(`/api/admin/dashboard?${params}`,{cache:'no-store'});const body=await response.json() as CustomerResponse;
      if(!response.ok)throw new Error(body.error??'Customer records could not be loaded.');
      setCustomers(current=>more?[...current,...body.customers]:body.customers);setCursor(body.nextCursor);
    }catch(reason){setError(reason instanceof Error?reason.message:'Customer records could not be loaded.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{const timer=window.setTimeout(()=>{setCursor(null);void load(query,tier,null,false)},220);return()=>window.clearTimeout(timer)},[query,tier,load]);
  useEffect(()=>{if(!selected)return;const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setSelected(null)};window.addEventListener('keydown',closeOnEscape);return()=>window.removeEventListener('keydown',closeOnEscape)},[selected]);
  const showMore=()=>{if(cursor&&!loading){setAppend(true);void load(query,tier,cursor,true).finally(()=>setAppend(false));}};
  return <section className="admin-workbench admin-customers">
    <header className="admin-customers-heading"><div><p className="eyebrow">CUSTOMER RECORDS</p><h2>Customers</h2><p>Find accounts and check membership details.</p></div><span>{loading?'Updating':`${customers.length}${cursor?'+':''} shown`}</span></header>
    <div className="admin-customers-toolbar"><label><span className="sr-only">Search email or username</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search email or username" autoComplete="off"/><SearchMark/></label><div role="group" aria-label="Filter by membership"><button type="button" aria-pressed={tier==='all'} onClick={()=>setTier('all')}>All</button><button type="button" aria-pressed={tier==='free'} onClick={()=>setTier('free')}>Free</button><button type="button" aria-pressed={tier==='pro'} onClick={()=>setTier('pro')}>Pro</button></div></div>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-health-table"><thead><tr><th>Customer</th><th>Membership</th><th>Joined</th><th></th></tr></thead><tbody>
      {customers.map(customer=><tr key={customer.id}><td><button type="button" className="admin-customer-open" onClick={()=>setSelected(customer)}><strong>{customer.display_name}</strong><small>{customer.username?`@${customer.username}`:'Account'}{customer.email?` / ${customer.email}`:''}</small></button></td><td><span className={`admin-customer-tier ${customer.tier==='pro'?'is-pro':''}`}>{customer.tier==='pro'?'Pro':'Free'}</span>{customer.tier==='pro'&&customer.pro_expires_at&&<small className="admin-customer-expiry">Until {dateFormat.format(asDate(customer.pro_expires_at))}</small>}</td><td>{dateFormat.format(asDate(customer.created_at))}</td><td><button type="button" className="admin-customer-detail" onClick={()=>setSelected(customer)}>Details</button></td></tr>)}
      {!loading&&!customers.length&&<tr><td colSpan={4}>No accounts found.</td></tr>}
    </tbody></table></div>
    {cursor&&<footer className="admin-customers-footer"><button type="button" className="admin-refresh" onClick={showMore} disabled={loading}>{append?'Loading…':'Load more'}</button></footer>}
    {selected&&<div className="admin-customer-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null)}}><section className="admin-customer-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-customer-title"><button className="admin-customer-close" type="button" onClick={()=>setSelected(null)} aria-label="Close customer details">×</button><p className="eyebrow">CUSTOMER</p><h3 id="admin-customer-title">{selected.display_name}</h3><dl><div><dt>Username</dt><dd>{selected.username?`@${selected.username}`:'Not set'}</dd></div><div><dt>Email</dt><dd>{selected.email||'Not available'}</dd></div><div><dt>Membership</dt><dd>{selected.tier==='pro'?'Market Pro':'Free'}{selected.tier==='pro'&&selected.pro_expires_at?` until ${dateFormat.format(asDate(selected.pro_expires_at))}`:''}</dd></div><div><dt>Joined</dt><dd>{dateFormat.format(asDate(selected.created_at))}</dd></div></dl>{selected.username&&<a href={`/players/${encodeURIComponent(selected.username)}`} target="_blank" rel="noreferrer">Open public profile ↗</a>}</section></div>}
  </section>;
}

function SearchMark(){return <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>}
