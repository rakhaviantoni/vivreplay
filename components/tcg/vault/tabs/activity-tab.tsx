'use client';

import React,{useEffect,useState} from 'react';
import {ClockIcon as Clock} from '@phosphor-icons/react';
import {VaultPanelEmpty} from '../vault-panel-empty';

type Activity={id:string;kind:string;createdAt:string;title:string;description:string};
export function ActivityTab({language}:{language:'EN'|'ID'}){
  const id=language==='ID';
  const [activities,setActivities]=useState<Activity[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let alive=true;
    setLoading(true);setError('');
    fetch('/api/activity',{cache:'no-store'}).then(async response=>{
      const data=await response.json() as {activities?:Activity[];error?:string};
      if(!response.ok)throw new Error(data.error||'Activity could not be loaded.');
      if(alive)setActivities(data.activities??[]);
    }).catch(reason=>{if(alive)setError(reason instanceof Error?reason.message:'Activity could not be loaded.')}).finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[retry]);
  const date=(value:string)=>new Date(`${value.replace(' ','T')}Z`).toLocaleString(id?'id-ID':'en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'});
  const activityTitle=(title:string)=>{
    if(!id)return title;
    const translated:Record<string,string>={
      'Raw card added to Vault':'Kartu ditambahkan ke koleksi',
      'Raw card updated':'Kartu koleksi diperbarui',
      'Slab added to Vault':'Slab ditambahkan ke koleksi',
      'Slab updated':'Slab diperbarui',
    };
    return translated[title]??title;
  };
  return <div style={{maxWidth:'780px',margin:'0 auto'}}>
    <div style={{marginBottom:'24px'}}><h2 style={{fontFamily:'var(--display-font, var(--font-sans))',fontSize:'22px',fontWeight:600,margin:0}}>{id?'Aktivitas akun':'Account activity'}</h2><p style={{fontSize:'12px',color:'var(--vault-ink-secondary)',margin:'4px 0 0'}}>{id?'Riwayat kartu koleksi dan aktivitas Market yang tersimpan di akun Anda.':'A record of Vault changes and Market activity saved to your account.'}</p></div>
    {loading?<div className="vault-activity-skeleton" role="status" aria-label={id?'Memuat aktivitas':'Loading activity'}>{[0,1,2].map(item=><div key={item}><i/><span><i/><i/></span></div>)}</div>:error?<div className="vault-listings-empty" role="alert"><strong>{id?'Aktivitas tidak dapat dimuat':'Activity could not be loaded'}</strong><span>{error}</span><button type="button" className="vault-btn vault-btn-secondary" onClick={()=>setRetry(value=>value+1)}>{id?'Coba lagi':'Try again'}</button></div>:activities.length===0?<VaultPanelEmpty icon={<Clock size={22}/>} title={id?'Belum ada aktivitas':'No activity yet'} description={id?'Aktivitas Vault akan muncul di sini.':'Vault activity will appear here.'}/>:<div style={{position:'relative',paddingLeft:'28px',borderLeft:'2px solid var(--vault-border)',display:'flex',flexDirection:'column',gap:'16px'}}>
      {activities.map(item=><article key={item.id} style={{position:'relative',padding:'14px 18px',borderRadius:'10px',background:'var(--vault-panel)',border:'1px solid var(--vault-border)'}}><span aria-hidden="true" style={{position:'absolute',left:'-38px',top:'15px',width:'20px',height:'20px',borderRadius:'50%',background:'var(--vault-panel)',border:'2px solid var(--vault-gold)',display:'grid',placeItems:'center'}}><Clock size={12} color="var(--vault-gold)"/></span><div style={{display:'flex',justifyContent:'space-between',gap:'12px',alignItems:'baseline',flexWrap:'wrap'}}><strong style={{fontSize:'13px',color:'var(--vault-ink)'}}>{activityTitle(item.title)}</strong><time dateTime={item.createdAt} style={{fontSize:'11px',color:'var(--vault-ink-muted)'}}>{date(item.createdAt)}</time></div><p style={{fontSize:'12px',color:'var(--vault-ink-secondary)',margin:'5px 0 0',lineHeight:1.5}}>{item.description}</p></article>)}
    </div>}
  </div>;
}
