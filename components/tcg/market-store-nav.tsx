/* eslint-disable react-hooks/set-state-in-effect -- hydrate stored navigation preferences after mount. */
'use client';

import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {FormEvent,useEffect,useState} from 'react';
import {ArrowLeftIcon as ArrowLeft,BookmarkSimpleIcon as Bookmark,CardsIcon as VaultIcon,HeartIcon as Heart,ClipboardTextIcon as ClipboardText,ChatCircleDotsIcon as OffersIcon,ShoppingBagIcon as OrdersIcon,MoonIcon as Moon,PlusIcon as Plus,MagnifyingGlassIcon as Search,SunIcon as Sun,UserIcon as UserRound,CaretDownIcon as CaretDown,StorefrontIcon as Storefront} from '@phosphor-icons/react';
import {VivreMark} from './brand-assets';
import {useAccount} from '@/lib/client';
import {loadMarketActivityCounts} from '@/lib/market/activity-client';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {MarketCartSheet} from './market-cart-sheet';
import {MarketQuickPanel} from './market-quick-panel';
import '@/app/market-account.css';

export function MarketStoreNav({initialQuery='',sellHref='/market?sell=open',showPromo=true}:{initialQuery?:string;sellHref?:string;showPromo?:boolean}){
  const router=useRouter();
  const pathname=usePathname();
  const {data,refresh}=useAccount();
  const [activityCounts,setActivityCounts]=useState({listings:0,offers:0,orders:0});
  const [proPaymentsCount,setProPaymentsCount]=useState(0);
  const [query,setQuery]=useState(initialQuery);
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  const [accountPanel,setAccountPanel]=useState<'listings'|'offers'|'orders'|'saved'|null>(null);
  const [quickPanel,setQuickPanel]=useState<'profile'|'vault'|'wishlist'|null>(null);
  useEffect(()=>{
    const nextTheme=window.localStorage.getItem('vivreplay-theme')==='dark'?'dark':'light';
    const nextLocale=window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN';
    setTheme(nextTheme);
    setLocale(nextLocale);
    document.documentElement.dataset.theme=nextTheme;
    document.documentElement.lang=nextLocale==='ID'?'id':'en';
    const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    const onTheme=(event:Event)=>setTheme((event as CustomEvent<'light'|'dark'>).detail==='dark'?'dark':'light');
    window.addEventListener('vivreplay:locale',onLocale);
    window.addEventListener('vivreplay:theme',onTheme);
    return()=>{
      window.removeEventListener('vivreplay:locale',onLocale);
      window.removeEventListener('vivreplay:theme',onTheme);
    };
  },[]);
  const changeTheme=()=>{const next=theme==='light'?'dark':'light';setTheme(next);document.documentElement.dataset.theme=next;window.localStorage.setItem('vivreplay-theme',next);window.dispatchEvent(new CustomEvent('vivreplay:theme',{detail:next}));};
  const changeLocale=()=>{const next=locale==='EN'?'ID':'EN';setLocale(next);document.documentElement.lang=next==='ID'?'id':'en';window.localStorage.setItem('vivreplay-locale',next);window.dispatchEvent(new CustomEvent('vivreplay:locale',{detail:next}));};
  const search=(event:FormEvent)=>{event.preventDefault();router.push(`/market${query.trim()?`?card=${encodeURIComponent(query.trim())}`:''}`)};
  const onSell=()=>{
    if(data){
      if(pathname.includes('/market/')){
        const printingId=new URL(sellHref,window.location.origin).searchParams.get('sell');
        if(printingId){window.dispatchEvent(new CustomEvent('vivreplay:open-sell-printing',{detail:printingId}));return;}
      }
      router.push(sellHref);
    }else{
      window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));
    }
  };
  const onCreateListing=()=>{
    setAccountPanel(null);
    if(pathname.includes('/market/')&&data){
      const printingId=new URL(sellHref,window.location.origin).searchParams.get('sell');
      if(printingId){window.dispatchEvent(new CustomEvent('vivreplay:open-sell-printing',{detail:printingId}));return;}
    }
    if(pathname==='/market')window.dispatchEvent(new CustomEvent('vivreplay:open-sell-listing'));
    else router.push(sellHref);
  };
  useEffect(()=>{
    if(!data?.profile?.id)return;
    let active=true;
    const update=async()=>{if(document.visibilityState!=='visible')return;const [counts,proResponse]=await Promise.all([loadMarketActivityCounts(data.profile.id),fetch('/api/checkout/pro/orders',{cache:'no-store'}).catch(()=>null)]);if(active&&counts)setActivityCounts(counts);if(active&&proResponse?.ok){const result=await proResponse.json() as {orders?:{status:string}[]};setProPaymentsCount((result.orders??[]).filter(order=>order.status==='PENDING_PAYMENT').length)}};
    const onVisibility=()=>{if(document.visibilityState==='visible')void update()};
    void update();const timer=window.setInterval(()=>void update(),120_000);document.addEventListener('visibilitychange',onVisibility);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisibility)};
  },[data?.profile?.id]);
  const openAccountPanel=(panel:'listings'|'offers'|'orders'|'saved')=>{setQuickPanel(null);setAccountPanel(panel);if(panel==='saved')return;setActivityCounts(current=>({...current,[panel]:0}));void fetch('/api/market/activity',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({section:panel})}).catch(()=>undefined)};
  const unreadCount=activityCounts.listings+activityCounts.offers+activityCounts.orders;
  const signInLabel=locale==='ID'?'Masuk':'Sign in';
  return <>{showPromo&&<div className="market-store-promo">{locale==='ID'?'Koleksi yang tepat, satu kartu pada satu waktu.':'Build your collection, one exact card at a time.'}</div>}<nav className="market-store-nav" aria-label="VivrePlay Market"><Link href="/" className="market-back-link"><ArrowLeft size={15}/><VivreMark size={18}/><span>VivrePlay</span></Link><i className="market-nav-divider"/><Link href="/market" className="market-store-wordmark"><b>Market</b></Link><form className="market-store-search" onSubmit={search}><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={locale==='ID'?'Cari kartu atau listing':'Search cards and listings'} aria-label={locale==='ID'?'Cari kartu dan listing':'Search cards and listings'}/></form><div className="masthead-actions market-store-actions"><MarketCartSheet locale={locale}/>{data&&<DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="market-account-trigger" aria-label={locale==='ID'?'Market saya: listing, penawaran, dan pesanan':'My Market: listings, offers, and orders'}><Storefront size={16} aria-hidden="true"/>{unreadCount>0&&<span className="market-account-unread-badge">{Math.min(99,unreadCount)}</span>}<span className="market-account-trigger-name">{locale==='ID'?'Market saya':'My Market'}</span><CaretDown size={14} aria-hidden="true"/></button></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={10} className="market-account-menu"><DropdownMenuLabel className="market-account-menu-label"><span className="market-account-menu-name">{data.profile.display_name||`@${data.profile.username}`}</span><span className="market-account-menu-handle">@{data.profile.username}</span></DropdownMenuLabel><DropdownMenuSeparator/><DropdownMenuItem className="market-account-menu-item" onSelect={()=>openAccountPanel('listings')}><ClipboardText size={16}/>{locale==='ID'?'Listing saya':'My listings'}{activityCounts.listings>0&&<span className="market-activity-badge">{activityCounts.listings>99?'99+':activityCounts.listings}</span>}</DropdownMenuItem><DropdownMenuItem className="market-account-menu-item" onSelect={()=>openAccountPanel('offers')}><OffersIcon size={16}/>{locale==='ID'?'Penawaran':'Offers'}{activityCounts.offers>0&&<span className="market-activity-badge">{activityCounts.offers>99?'99+':activityCounts.offers}</span>}</DropdownMenuItem><DropdownMenuItem className="market-account-menu-item" onSelect={()=>openAccountPanel('orders')}><OrdersIcon size={16}/>{locale==='ID'?'Pesanan':'Orders'}{activityCounts.orders>0&&<span className="market-activity-badge">{activityCounts.orders>99?'99+':activityCounts.orders}</span>}</DropdownMenuItem><DropdownMenuItem className="market-account-menu-item" onSelect={()=>openAccountPanel('saved')}><Bookmark size={16}/>{locale==='ID'?'Tersimpan':'Saved listings'}</DropdownMenuItem><DropdownMenuItem className="market-account-menu-item" onSelect={()=>{setAccountPanel(null);setQuickPanel('wishlist')}}><Heart size={16}/>{locale==='ID'?'Kartu incaran':'Wishlist'}</DropdownMenuItem><DropdownMenuItem className="market-account-menu-item" onSelect={()=>{setAccountPanel(null);setQuickPanel('profile')}}><UserRound size={16}/>{locale==='ID'?'Profil':'Profile'}{proPaymentsCount>0&&<span className="market-activity-badge">{proPaymentsCount>99?'99+':proPaymentsCount}</span>}</DropdownMenuItem><DropdownMenuItem className="market-account-menu-item market-account-menu-mobile-vault" onSelect={()=>{setAccountPanel(null);setQuickPanel('vault')}}><VaultIcon size={16}/>{locale==='ID'?'Koleksi saya':'Vault'}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}<button type="button" className="market-store-link" onClick={()=>{setAccountPanel(null);setQuickPanel('vault')}}>{locale==='ID'?'Koleksi saya':'Vault'}</button><button className="market-store-locale locale-toggle" type="button" onClick={changeLocale} aria-label={locale==='ID'?'Ganti bahasa':'Switch language'}>{locale}</button><button className="market-store-theme theme-toggle" type="button" onClick={changeTheme} aria-label={locale==='ID'?`Gunakan mode ${theme==='light'?'gelap':'terang'}`:`Use ${theme==='light'?'dark':'light'} mode`}>{theme==='light'?<Moon size={16}/>:<Sun size={16}/>}</button><button className="market-list-button join-link" type="button" onClick={onSell} aria-label={data?(locale==='ID'?'Jual kartu':'Sell'):signInLabel}>{data?<Plus size={15}/>:<UserRound size={15}/>}<span className="market-list-button-text">{data?(locale==='ID'?'Jual kartu':'Sell'):signInLabel}</span><span className="market-list-button-short">{data?(locale==='ID'?'Jual':'Sell'):signInLabel}</span></button></div></nav>{data&&<MarketQuickPanel panel={accountPanel??quickPanel} onOpenChange={open=>{if(!open){setAccountPanel(null);setQuickPanel(null)}}} onPanelChange={next=>{if(next==='listings'||next==='offers'||next==='orders'||next==='saved'){setQuickPanel(null);openAccountPanel(next)}else{setAccountPanel(null);setQuickPanel(next)}}} onCreateListing={()=>{setAccountPanel(null);onCreateListing()}} locale={locale} account={data} activityCounts={activityCounts} onRefresh={refresh} onSaved={async()=>{await refresh();setAccountPanel(null);setQuickPanel(null)}}/>}</>;
}
