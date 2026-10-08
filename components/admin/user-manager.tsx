'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {EnvelopeSimple,ArrowClockwise,MagnifyingGlass} from '@phosphor-icons/react';

type AdminUser={id:string;username:string;display_name:string;email:string|null;tier:string;pro_expires_at:string|null;created_at:string;latest_pro_order_id:string|null;latest_pro_paid_at:string|null};
type Data={summary:{totalUsers:number;activePro:number};users:AdminUser[]};
const date=(value:string|null)=>value?new Date(value.replace(' ','T')+'Z').toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'—';

export function UserManager(){
  const [data,setData]=useState<Data>();const [query,setQuery]=useState('');const [tier,setTier]=useState<'all'|'pro'|'free'>('all');const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState('');
  const load=()=>{setError('');fetch('/api/admin/users',{cache:'no-store'}).then(async response=>{const body=await response.json() as Data&{error?:string};if(!response.ok)throw new Error(body.error??'Users could not be loaded.');setData(body)}).catch(reason=>setError(reason instanceof Error?reason.message:'Users could not be loaded.'))};
  useEffect(()=>{load()},[]);
  const users=useMemo(()=>data?.users.filter(user=>{
    const isPro=user.tier==='pro'&&(!user.pro_expires_at||new Date(user.pro_expires_at.replace(' ','T')+'Z').getTime()>Date.now());
    return(tier==='all'||(tier==='pro'?isPro:!isPro))&&`${user.display_name} ${user.username} ${user.email??''} ${user.tier}`.toLowerCase().includes(query.toLowerCase());
  })??[],[data,query,tier]);
  const resend=async(user:AdminUser)=>{if(!user.latest_pro_order_id)return;setBusy(user.id);setError('');setNotice('');try{const response=await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/pro-email`,{method:'POST'});const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error??'Activation email could not be sent.');setNotice(`Activation email sent to ${user.email}.`)}catch(reason){setError(reason instanceof Error?reason.message:'Activation email could not be sent.')}finally{setBusy('')}};
  return <section className="admin-workbench">
    <div className="admin-metrics"><div><span>Total users</span><strong>{data?.summary.totalUsers.toLocaleString()??'—'}</strong></div><div><span>Active Market Pro</span><strong>{data?.summary.activePro.toLocaleString()??'—'}</strong></div><div><span>Free accounts</span><strong>{data?(data.summary.totalUsers-data.summary.activePro).toLocaleString():'—'}</strong></div></div>
    <div className="admin-toolbar"><div className="admin-tabs"><button className={tier==='all'?'active':''} onClick={()=>setTier('all')}>All users <b>{data?.summary.totalUsers??'—'}</b></button><button className={tier==='pro'?'active':''} onClick={()=>setTier('pro')}>Pro <b>{data?.summary.activePro??'—'}</b></button><button className={tier==='free'?'active':''} onClick={()=>setTier('free')}>Free</button></div><label><MagnifyingGlass size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search name, username, or email"/></label><button type="button" className="admin-refresh" onClick={load} aria-label="Refresh users"><ArrowClockwise size={15}/></button></div>
    {error&&<p className="admin-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {!data&&!error?<div className="admin-health-skeleton" aria-label="Loading users"><i/><i/></div>:<div className="admin-table-wrap"><table className="admin-health-table"><thead><tr><th>User</th><th>Market Pro</th><th>Joined</th><th>Latest paid plan</th><th>Action</th></tr></thead><tbody>{users.map(user=>{const active=user.tier==='pro'&&(!user.pro_expires_at||new Date(user.pro_expires_at.replace(' ','T')+'Z').getTime()>Date.now());return <tr key={user.id}><td><strong>{user.display_name||user.username}</strong><small style={{display:'block',opacity:.7}}>@{user.username} · {user.email||'No email'}</small></td><td>{active?'Active':user.tier==='pro'?'Expired':'Free'}{user.pro_expires_at&&<small style={{display:'block',opacity:.7}}>{active?'Until':'Ended'} {date(user.pro_expires_at)}</small>}</td><td>{date(user.created_at)}</td><td>{user.latest_pro_paid_at?date(user.latest_pro_paid_at):'—'}</td><td>{user.latest_pro_order_id?<button type="button" className="admin-refresh" disabled={busy===user.id} onClick={()=>void resend(user)}><EnvelopeSimple size={14}/>{busy===user.id?'Sending…':'Resend Pro email'}</button>:<Link href={`/players/${encodeURIComponent(user.username)}`}>Open profile</Link>}</td></tr>})}{!users.length&&<tr><td colSpan={5}>No users match this filter.</td></tr>}</tbody></table></div>}
    <p className="admin-muted">Showing up to 500 accounts. Pro access follows paid orders; use the email action to resend an activation message.</p>
  </section>;
}
