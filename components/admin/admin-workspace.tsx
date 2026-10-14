'use client';

import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {ArrowSquareOutIcon as ExternalLink,ChartLineUpIcon as Overview,UsersThreeIcon as Customers,HeartbeatIcon as Catalog,StorefrontIcon as Market,SlidersHorizontalIcon as Policy,WarningCircleIcon as Feedback,ChartLineUpIcon as Traffic,WalletIcon as Payouts,ScalesIcon as Reports,EnvelopeSimpleIcon as Emails,SignOutIcon as SignOut} from '@phosphor-icons/react';
import type {ReactNode} from 'react';

type AdminSection='overview'|'customers'|'catalog'|'marketplace'|'policy'|'feedback'|'traffic'|'payouts'|'disputes'|'emails';
const groups=[
  {label:'Workspace',items:[{id:'overview',label:'Overview',href:'/admin?section=overview',icon:Overview},{id:'customers',label:'Customers',href:'/admin?section=customers',icon:Customers}]},
  {label:'Market',items:[{id:'marketplace',label:'Listings & sellers',href:'/admin?section=marketplace',icon:Market},{id:'disputes',label:'Order reports',href:'/admin?section=disputes',icon:Reports},{id:'payouts',label:'Payouts',href:'/admin?section=payouts',icon:Payouts},{id:'policy',label:'Market policy',href:'/admin?section=policy',icon:Policy}]},
  {label:'Tools',items:[{id:'catalog',label:'Catalog health',href:'/admin?section=catalog',icon:Catalog},{id:'feedback',label:'Feedback',href:'/admin?section=feedback',icon:Feedback},{id:'traffic',label:'Traffic',href:'/admin?section=traffic',icon:Traffic},{id:'emails',label:'Emails',href:'/admin/emails',icon:Emails}]},
] as const;
const labels:Record<AdminSection,string>={overview:'Overview',customers:'Customers',catalog:'Catalog health',marketplace:'Listings & sellers',policy:'Market policy',feedback:'Feedback',traffic:'Traffic',payouts:'Payouts',disputes:'Order reports',emails:'Emails'};

export function AdminWorkspace({active,children}:{active:AdminSection;children:ReactNode}){
  const pathname=usePathname()??'/admin';
  const router=useRouter();
  return <div className="admin-workspace-shell">
    <aside className="admin-workspace-sidebar">
      <Link href="/admin" className="admin-workspace-brand"><span className="admin-workspace-brand-mark">V</span><span>VivrePlay<small>ADMIN</small></span></Link>
      <nav aria-label="Admin navigation" className="admin-workspace-nav">
        {groups.map(group=><section key={group.label} className="admin-workspace-nav-group"><h2>{group.label}</h2>{group.items.map(item=>{const Icon=item.icon;const selected=active===item.id&&(item.id!=='emails'||pathname==='/admin/emails');return <Link key={item.id} href={item.href} className="admin-workspace-nav-link" aria-current={selected?'page':undefined}><Icon size={17}/><span>{item.label}</span></Link>})}</section>)}
      </nav>
      <footer className="admin-workspace-sidebar-footer">
        <Link href="/market" className="admin-workspace-nav-link"><ExternalLink size={17}/><span>View Market</span></Link>
        <button type="button" className="admin-workspace-nav-link" onClick={async()=>{await fetch('/api/admin/session',{method:'DELETE'});router.push('/admin')}}><SignOut size={17}/><span>Sign out</span></button>
      </footer>
    </aside>
    <div className="admin-workspace-main">
      <header className="admin-workspace-topbar"><span>Admin workspace</span><strong>{labels[active]}</strong></header>
      <div className="admin-workspace-page">{children}</div>
    </div>
  </div>;
}
