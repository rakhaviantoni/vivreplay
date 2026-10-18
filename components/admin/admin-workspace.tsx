'use client';

import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {ArrowSquareOutIcon as ExternalLink,ChartLineUpIcon as Overview,UsersThreeIcon as Customers,HeartbeatIcon as Catalog,StorefrontIcon as Market,SlidersHorizontalIcon as Policy,CreditCardIcon as PaymentMethods,WarningCircleIcon as Feedback,ChartLineUpIcon as Traffic,WalletIcon as Payouts,ScalesIcon as Reports,EnvelopeSimpleIcon as Emails,SignOutIcon as SignOut,MagnifyingGlassIcon as Search,SidebarSimpleIcon as SidebarToggle,XIcon as Clear,ActivityIcon as Operations} from '@phosphor-icons/react';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {VivreMark} from '@/components/tcg/brand-assets';

type AdminSection='overview'|'customers'|'catalog'|'marketplace'|'policy'|'payments'|'feedback'|'traffic'|'payouts'|'disputes'|'operations'|'emails';
const groups=[
  {label:'Workspace',items:[{id:'overview',label:'Overview',href:'/admin?section=overview',icon:Overview},{id:'customers',label:'Customers',href:'/admin?section=customers',icon:Customers}]},
  {label:'Market',items:[{id:'marketplace',label:'Listings & sellers',href:'/admin?section=marketplace',icon:Market},{id:'disputes',label:'Order reports',href:'/admin?section=disputes',icon:Reports},{id:'payouts',label:'Payouts',href:'/admin?section=payouts',icon:Payouts},{id:'policy',label:'Market policy',href:'/admin?section=policy',icon:Policy},{id:'payments',label:'Payment methods',href:'/admin?section=payments',icon:PaymentMethods},{id:'operations',label:'Payments & delivery',href:'/admin?section=operations',icon:Operations}]},
  {label:'Tools',items:[{id:'catalog',label:'Catalog health',href:'/admin?section=catalog',icon:Catalog},{id:'feedback',label:'Feedback',href:'/admin?section=feedback',icon:Feedback},{id:'traffic',label:'Traffic',href:'/admin?section=traffic',icon:Traffic},{id:'emails',label:'Emails',href:'/admin/emails',icon:Emails}]},
] as const;
const labels:Record<AdminSection,string>={overview:'Overview',customers:'Customers',catalog:'Catalog health',marketplace:'Listings & sellers',policy:'Market policy',payments:'Payment methods',feedback:'Feedback',traffic:'Traffic',payouts:'Payouts',disputes:'Order reports',operations:'Payments & delivery',emails:'Emails'};

export function AdminWorkspace({active,children}:{active:AdminSection;children:ReactNode}){
  const pathname=usePathname()??'/admin';
  const router=useRouter();
  const [collapsed,setCollapsed]=useState(false);
  const [query,setQuery]=useState('');
  const searchRef=useRef<HTMLInputElement>(null);
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
