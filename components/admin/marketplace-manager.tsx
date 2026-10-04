'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {MagnifyingGlassIcon as Search,ArrowSquareOutIcon as ExternalLink} from '@phosphor-icons/react';

type Listing={id:string;title:string;type:string;status:string;amount:number;currency:string;quantity:number;condition:string;city:string;createdAt:string;expiresAt:string|null;seller:string;username:string;tier:string};
type Seller={id:string;username:string;display_name:string;tier:string;active_listings:number;total_listings:number;last_listing_at:string|null};
type ResponseData={listings:Listing[];sellers:Seller[]};
const money=(amount:number,currency:string)=>new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:0}).format(amount);

export function MarketplaceManager(){
  const [data,setData]=useState<ResponseData>();const [query,setQuery]=useState('');const [view,setView]=useState<'listings'|'sellers'>('listings');const [error,setError]=useState('');
  useEffect(()=>{let active=true;fetch('/api/admin/marketplace',{cache:'no-store'}).then(async response=>{const body=await response.json() as ResponseData&{error?:string};if(!response.ok)throw new Error(body.error??'Could not load Market records.');if(active)setData(body)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Could not load Market records.')});return()=>{active=false}},[]);
  const listings=useMemo(()=>data?.listings.filter(item=>`${item.title} ${item.username} ${item.seller} ${item.id} ${item.city} ${item.type}`.toLowerCase().includes(query.toLowerCase()))??[],[data,query]);
  const sellers=useMemo(()=>data?.sellers.filter(item=>`${item.username} ${item.display_name} ${item.tier}`.toLowerCase().includes(query.toLowerCase()))??[],[data,query]);
  return <section className="admin-workbench">
    <div className="admin-toolbar"><div className="admin-tabs"><button className={view==='listings'?'active':''} onClick={()=>setView('listings')}>Listings <b>{data?.listings.length??'—'}</b></button><button className={view==='sellers'?'active':''} onClick={()=>setView('sellers')}>Sellers <b>{data?.sellers.length??'—'}</b></button></div><label><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={view==='listings'?'Search listing or seller':'Search seller'}/></label></div>
    {error?<p className="admin-error">{error}</p>:!data?<div className="admin-health-skeleton" aria-label="Loading Market"><i/><i/></div>:view==='listings'?<div className="admin-table-wrap"><table className="admin-health-table"><thead><tr>{['Listing','Seller','Type','Cards','Price','Status','Created'].map(item=><th key={item}>{item}</th>)}</tr></thead><tbody>{listings.map(item=><tr key={item.id}><td>{item.title}<small style={{display:'block',opacity:.65}}>{item.city} · {item.id.slice(0,8)}</small></td><td><Link href={`/players/${encodeURIComponent(item.username)}`}>{item.seller} <small>@{item.username}</small></Link></td><td>{item.type}</td><td>{item.quantity}</td><td>{money(item.amount,item.currency)}</td><td>{item.status}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td></tr>)}{!listings.length&&<tr><td colSpan={7}>No listings match this search.</td></tr>}</tbody></table></div>:<div className="admin-table-wrap"><table className="admin-health-table"><thead><tr>{['Seller','Tier','Active listings','All listings','Last listed','Profile'].map(item=><th key={item}>{item}</th>)}</tr></thead><tbody>{sellers.map(item=><tr key={item.id}><td>{item.display_name}<small style={{display:'block',opacity:.65}}>@{item.username}</small></td><td>{item.tier}</td><td>{item.active_listings}</td><td>{item.total_listings}</td><td>{item.last_listing_at?new Date(item.last_listing_at).toLocaleDateString():'—'}</td><td><Link href={`/players/${encodeURIComponent(item.username)}`} aria-label={`Open ${item.username}'s profile`}><ExternalLink size={15}/></Link></td></tr>)}{!sellers.length&&<tr><td colSpan={6}>No sellers match this search.</td></tr>}</tbody></table></div>}
  </section>;
}
