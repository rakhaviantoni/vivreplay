'use client';

import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {ArrowSquareOutIcon as ExternalLink,BellIcon as Bell,BellRingingIcon as BellRinging,ChartLineUpIcon as Overview,UsersThreeIcon as Customers,HandshakeIcon as Partners,HeartbeatIcon as Catalog,StorefrontIcon as Market,PackageIcon as Orders,SlidersHorizontalIcon as Policy,CreditCardIcon as PaymentMethods,WarningCircleIcon as Feedback,ChartLineUpIcon as Traffic,WalletIcon as Payouts,ScalesIcon as Reports,EnvelopeSimpleIcon as Emails,MegaphoneIcon as SocialMedia,SignOutIcon as SignOut,MagnifyingGlassIcon as Search,SidebarSimpleIcon as SidebarToggle,XIcon as Clear,ActivityIcon as Operations} from '@phosphor-icons/react';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {toast} from 'sonner';
import {VivreMark} from '@/components/tcg/brand-assets';

type AdminSection='overview'|'customers'|'catalog'|'marketplace'|'orders'|'partners'|'policy'|'payments'|'feedback'|'traffic'|'social'|'payouts'|'disputes'|'operations'|'emails';
const groups=[
  {label:'Workspace',items:[{id:'overview',label:'Overview',href:'/admin?section=overview',icon:Overview},{id:'customers',label:'Customers',href:'/admin?section=customers',icon:Customers}]},
  {label:'Market',items:[{id:'marketplace',label:'Listings & sellers',href:'/admin?section=marketplace',icon:Market},{id:'orders',label:'Orders & delivery',href:'/admin?section=orders',icon:Orders},{id:'partners',label:'Partners & consign',href:'/admin?section=partners',icon:Partners},{id:'disputes',label:'Order reports',href:'/admin?section=disputes',icon:Reports},{id:'payouts',label:'Payouts',href:'/admin?section=payouts',icon:Payouts},{id:'policy',label:'Market policy',href:'/admin?section=policy',icon:Policy},{id:'payments',label:'Payment methods',href:'/admin?section=payments',icon:PaymentMethods},{id:'operations',label:'Payments & delivery',href:'/admin?section=operations',icon:Operations}]},
  {label:'Tools',items:[{id:'catalog',label:'Catalog health',href:'/admin?section=catalog',icon:Catalog},{id:'feedback',label:'Feedback',href:'/admin?section=feedback',icon:Feedback},{id:'traffic',label:'Traffic',href:'/admin?section=traffic',icon:Traffic},{id:'social',label:'Social studio',href:'/admin?section=social',icon:SocialMedia},{id:'emails',label:'Emails',href:'/admin/emails',icon:Emails}]},
] as const;
const labels:Record<AdminSection,string>={overview:'Overview',customers:'Customers',catalog:'Catalog health',marketplace:'Listings & sellers',orders:'Orders & delivery',partners:'Partners & consign',policy:'Market policy',payments:'Payment methods',feedback:'Feedback',traffic:'Traffic',social:'Social studio',payouts:'Payouts',disputes:'Order reports',operations:'Payments & delivery',emails:'Emails'};

export function AdminWorkspace({active,children}:{active:AdminSection;children:ReactNode}){
  const pathname=usePathname()??'/admin';
  const router=useRouter();
  const [collapsed,setCollapsed]=useState(false);
  const [query,setQuery]=useState('');
  const [pushReady,setPushReady]=useState(false);
  const [pushEnabled,setPushEnabled]=useState(false);
  const [pushBusy,setPushBusy]=useState(false);
  const searchRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(typeof window==='undefined'||!('serviceWorker'in navigator)||!('PushManager'in window))return;
    let active=true;
    void (async()=>{
      const [reg,metaRes]=await Promise.all([
        navigator.serviceWorker.register('/sw.js').catch(()=>null),
        fetch('/api/admin/push',{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{enabled?:boolean}>:null).catch(()=>null),
      ]);
      if(!active||!metaRes?.enabled||!reg)return;
      setPushReady(true);
      const existing=await reg.pushManager.getSubscription().catch(()=>null);
      if(active)setPushEnabled(Boolean(existing));
    })();
    return()=>{active=false};
  },[]);
  const toggleAdminPush=async()=>{
    if(!pushReady||pushBusy)return;
    setPushBusy(true);
    try{
      const reg=await navigator.serviceWorker.register('/sw.js');
      const existing=await reg.pushManager.getSubscription();
      if(existing){
        await fetch('/api/admin/push',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:existing.endpoint})});
        await existing.unsubscribe().catch(()=>undefined);
        setPushEnabled(false);
        toast.success('Admin push alerts disabled');
        return;
      }
      const perm=await Notification.requestPermission();
      if(perm!=='granted'){toast.error('Allow notifications in your browser settings first.');return;}
      const meta=await fetch('/api/admin/push',{cache:'no-store'}).then(r=>r.json() as Promise<{publicKey?:string}>);
      if(!meta.publicKey)throw new Error('Push key missing.');
      const b64=meta.publicKey.replace(/-/g,'+').replace(/_/g,'/');
      const raw=atob(b64+'='.repeat((4-b64.length%4)%4));
      const keyBytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
      const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes});
      const json=sub.toJSON();
      const res=await fetch('/api/admin/push',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,expirationTime:sub.expirationTime??null,keys:json.keys})});
      if(!res.ok)throw new Error('Failed to save push subscription.');
      setPushEnabled(true);
      toast.success('Admin push alerts enabled on this device');
    }catch(err){
      toast.error(err instanceof Error?err.message:'Could not toggle push alerts');
    }finally{
      setPushBusy(false);
    }
  };
  useEffect(()=>{try{setCollapsed(localStorage.getItem('vivreplay-admin-sidebar')==='collapsed')}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem('vivreplay-admin-sidebar',collapsed?'collapsed':'expanded')}catch{}},[collapsed]);
  useEffect(()=>{
    const onKeyDown=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();setCollapsed(false);requestAnimationFrame(()=>searchRef.current?.focus());
      }else if(event.key==='/'&&!/input|textarea|select/i.test((event.target as HTMLElement|null)?.tagName??'')){
        event.preventDefault();setCollapsed(false);requestAnimationFrame(()=>searchRef.current?.focus());
      }
    };
    window.addEventListener('keydown',onKeyDown);return()=>window.removeEventListener('keydown',onKeyDown);
  },[]);
  const filteredGroups=useMemo(()=>{
    const normalized=query.trim().toLowerCase();
    if(!normalized)return groups;
    return groups.map(group=>({...group,items:group.items.filter(item=>(item.label+' '+group.label).toLowerCase().includes(normalized))})).filter(group=>group.items.length);
  },[query]);
  return <div className={'admin-workspace-shell'+(collapsed?' is-collapsed':'')}>
    <aside className="admin-workspace-sidebar">
      <div className="admin-workspace-sidebar-heading">
        <Link href="/admin" className="admin-workspace-brand"><VivreMark size={32} label="VivrePlay"/><span>VivrePlay<small>ADMIN</small></span></Link>
        <button type="button" className="admin-workspace-collapse" onClick={()=>setCollapsed(value=>!value)} aria-expanded={!collapsed} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} title={collapsed?'Expand sidebar':'Collapse sidebar'}><SidebarToggle size={17}/></button>
      </div>
      {collapsed?<button type="button" className="admin-workspace-search-icon" onClick={()=>{setCollapsed(false);requestAnimationFrame(()=>searchRef.current?.focus())}} aria-label="Search admin" title="Search admin"><Search size={17}/></button>:<label className="admin-workspace-search"><Search size={16}/><input ref={searchRef} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search admin" aria-label="Search admin navigation"/>{query?<button type="button" onClick={()=>{setQuery('');searchRef.current?.focus()}} aria-label="Clear search"><Clear size={14}/></button>:<kbd>⌘K</kbd>}</label>}
      <nav aria-label="Admin navigation" className="admin-workspace-nav">
        {filteredGroups.map(group=><section key={group.label} className="admin-workspace-nav-group"><h2>{group.label}</h2>{group.items.map(item=>{const Icon=item.icon;const selected=active===item.id&&(item.id!=='emails'||pathname==='/admin/emails');return <Link key={item.id} href={item.href} className="admin-workspace-nav-link" aria-current={selected?'page':undefined} title={collapsed?item.label:undefined}><Icon size={17}/><span>{item.label}</span></Link>})}</section>)}
        {filteredGroups.length===0&&<p className="admin-workspace-search-empty">No matching pages</p>}
      </nav>
      <footer className="admin-workspace-sidebar-footer">
        {pushReady&&<button type="button" className="admin-workspace-nav-link" disabled={pushBusy} onClick={()=>void toggleAdminPush()} title={collapsed?(pushEnabled?'Push alerts on':'Enable push alerts'):undefined}>{pushEnabled?<BellRinging size={17}/>:<Bell size={17}/>}<span>{pushBusy?'Saving...':pushEnabled?'Alerts on':'Enable alerts'}</span></button>}
        <Link href="/market" className="admin-workspace-nav-link" title={collapsed?'View Market':undefined}><ExternalLink size={17}/><span>View Market</span></Link>
        <button type="button" className="admin-workspace-nav-link" title={collapsed?'Sign out':undefined} onClick={async()=>{await fetch('/api/admin/session',{method:'DELETE'});router.push('/admin')}}><SignOut size={17}/><span>Sign out</span></button>
      </footer>
    </aside>
    <div className="admin-workspace-main">
      <header className="admin-workspace-topbar"><span>Admin workspace</span><strong>{labels[active]}</strong></header>
      <div className="admin-workspace-page">{children}</div>
    </div>
  </div>;
}
