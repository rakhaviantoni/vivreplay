import type {CSSProperties} from 'react';

type Variant='dashboard'|'catalog'|'table'|'form'|'payouts'|'disputes'|'operations';

const labels:Record<Variant,string>={dashboard:'Loading dashboard',catalog:'Loading catalog data',table:'Loading records',form:'Loading settings',payouts:'Loading payout requests',disputes:'Loading order reports',operations:'Loading operations'};

export function AdminLoadingSkeleton({variant, label=labels[variant],columns=6,rows=7}:{variant:Variant;label?:string;columns?:number;rows?:number}){
  return <div className={`admin-loading-skeleton is-${variant}`} role="status" aria-label={label} aria-busy="true">
    <span className="admin-loading-skeleton-label">{label}</span>
    {variant==='dashboard'&&<><div className="admin-loading-metrics">{Array.from({length:4},(_,index)=><i key={index}/>)}</div><div className="admin-loading-panels"><i/><i/></div></>}
    {variant==='catalog'&&<><div className="admin-loading-metrics">{Array.from({length:5},(_,index)=><i key={index}/>)}</div><div className="admin-loading-table"><i/>{Array.from({length:6},(_,index)=><i key={index}/>)}</div></>}
    {variant==='table'&&<div className="admin-loading-table" style={{'--admin-loading-columns':columns} as CSSProperties}>{Array.from({length:rows+1},(_,index)=><i key={index}/>)}</div>}
    {variant==='form'&&<><div className="admin-loading-metrics">{Array.from({length:4},(_,index)=><i key={index}/>)}</div><div className="admin-loading-form">{Array.from({length:5},(_,index)=><i key={index}/>)}</div></>}
    {variant==='payouts'&&<div className="admin-loading-list">{Array.from({length:3},(_,index)=><i key={index}/>)}</div>}
    {variant==='disputes'&&<div className="admin-loading-list">{Array.from({length:2},(_,index)=><i key={index}/>)}</div>}
    {variant==='operations'&&<><div className="admin-loading-panels"><i/><i/></div><div className="admin-loading-panels"><i/><i/></div></>}
  </div>;
}
