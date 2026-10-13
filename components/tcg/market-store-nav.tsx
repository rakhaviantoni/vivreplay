/* eslint-disable react-hooks/set-state-in-effect -- hydrate stored navigation preferences after mount. */
'use client';

import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {FormEvent,useEffect,useState} from 'react';
import {ArrowLeftIcon as ArrowLeft,CardsIcon as VaultIcon,MoonIcon as Moon,PlusIcon as Plus,MagnifyingGlassIcon as Search,SunIcon as Sun,UserIcon as UserRound,StorefrontIcon as Storefront,ShoppingCartIcon as Cart} from '@phosphor-icons/react';
import {VivreMark} from './brand-assets';
import {useAccount} from '@/lib/client';
import {loadMarketActivityCounts} from '@/lib/market/activity-client';
import {MarketAccountMenu} from './market-account-menu';
import {MarketCartSheet} from './market-cart-sheet';
import {MarketQuickPanel} from './market-quick-panel';
import {MarketProDialog} from './market-pro-dialog';
import '@/app/market-account.css';

export function MarketStoreNav({initialQuery='',sellHref='/market?sell=open',showPromo=true}:{initialQuery?:string;sellHref?:string;showPromo?:boolean}){
  const router=useRouter();
  const pathname=usePathname();
  const {data,refresh,loading:accountLoading}=useAccount();
  const [activityCounts,setActivityCounts]=useState({listings:0,offers:0,orders:0});
  const [proPaymentsCount,setProPaymentsCount]=useState(0);
  const [cartCount,setCartCount]=useState(0);
  const [scrolled,setScrolled]=useState(false);
  const [query,setQuery]=useState(initialQuery);
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  const [accountPanel,setAccountPanel]=useState<'listings'|'offers'|'orders'|'saved'|null>(null);
  const [quickPanel,setQuickPanel]=useState<'profile'|'vault'|'wishlist'|null>(null);
  useEffect(()=>{
    const update=()=>setScrolled(window.scrollY>24);
    update();window.addEventListener('scroll',update,{passive:true});
    return()=>window.removeEventListener('scroll',update);
  },[]);
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
  useEffect(()=>{
    const syncCartCount=()=>{try{const cart=JSON.parse(window.localStorage.getItem('vivreplay-market-cart-v1')||'null') as {lines?:Array<{items?:Array<{quantity?:number}>}>}|null;setCartCount((cart?.lines??[]).reduce((total,line)=>total+(line.items??[]).reduce((sum,item)=>sum+(Number(item.quantity)||0),0),0))}catch{setCartCount(0)}};
    syncCartCount();
    window.addEventListener('vivreplay:market-cart-updated',syncCartCount);
    window.addEventListener('storage',syncCartCount);
    return()=>{window.removeEventListener('vivreplay:market-cart-updated',syncCartCount);window.removeEventListener('storage',syncCartCount)};
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
    setProPaymentsCount(0);
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
  const marketHref=pathname.startsWith('/id')?'/id/market':'/market';
  const showMobileNav=!pathname.includes('/checkout')&&pathname.includes('/market');
  const openVault=()=>{if(!data){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return}setAccountPanel(null);setQuickPanel('vault')};
  const openMarketPanel=()=>{if(!data){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return}openAccountPanel('listings')};
  return <>{showPromo&&<div className="market-store-promo">{locale==='ID'?'Koleksi yang tepat, satu kartu pada satu waktu.':'Build your collection, one exact card at a time.'}</div>}<nav className={`market-store-nav${scrolled?' is-scrolled':''}`} aria-label="VivrePlay Market"><Link href="/" className="market-back-link"><ArrowLeft size={15}/><VivreMark size={18}/><span>VivrePlay</span></Link><i className="market-nav-divider"/><Link href="/market" className="market-store-wordmark"><b>Market</b></Link><form className="market-store-search" onSubmit={search}><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={locale==='ID'?'Cari kartu atau listing':'Search cards and listings'} aria-label={locale==='ID'?'Cari kartu dan listing':'Search cards and listings'}/></form><div className="masthead-actions market-store-actions"><MarketProDialog locale={locale} profile={data?.profile??null} accountLoading={accountLoading} member={accountLoading||String(data?.profile?.tier??'free').toLowerCase()==='pro'}/><MarketCartSheet locale={locale}/>{data&&<MarketAccountMenu account={data} locale={locale} activityCounts={activityCounts} proPaymentsCount={proPaymentsCount} onOpenSection={openAccountPanel} onOpenQuick={panel=>{setAccountPanel(null);setQuickPanel(panel)}}/>}<button type="button" className="market-store-link" onClick={()=>{setAccountPanel(null);setQuickPanel('vault')}}>{locale==='ID'?'Koleksi saya':'Vault'}</button><button className="market-store-locale locale-toggle" type="button" onClick={changeLocale} aria-label={locale==='ID'?'Ganti bahasa':'Switch language'}>{locale}</button><button className="market-store-theme theme-toggle" type="button" onClick={changeTheme} aria-label={locale==='ID'?`Gunakan mode ${theme==='light'?'gelap':'terang'}`:`Use ${theme==='light'?'dark':'light'} mode`}>{theme==='light'?<Moon size={16}/>:<Sun size={16}/>}</button><button className="market-list-button join-link" type="button" onClick={onSell} aria-label={data?(locale==='ID'?'Jual kartu':'Sell'):signInLabel}>{data?<Plus size={15}/>:<UserRound size={15}/>}<span className="market-list-button-text">{data?(locale==='ID'?'Jual kartu':'Sell'):signInLabel}</span><span className="market-list-button-short">{data?(locale==='ID'?'Jual':'Sell'):signInLabel}</span></button></div></nav>{showMobileNav&&<nav className="market-mobile-nav" aria-label={locale==='ID'?'Navigasi Market':'Market navigation'}><Link href={marketHref} aria-current={pathname.includes('/market')?'page':undefined}><Storefront size={20}/><span>Market</span></Link><button type="button" onClick={()=>window.dispatchEvent(new Event('vivreplay:open-market-cart'))} aria-label={locale==='ID'?`Keranjang, ${cartCount} kartu`:`Cart, ${cartCount} cards`}><span className="market-mobile-nav-icon"><Cart size={20}/>{cartCount>0&&<b>{Math.min(99,cartCount)}</b>}</span><span>{locale==='ID'?'Keranjang':'Cart'}</span></button><button type="button" onClick={openVault}><VaultIcon size={20}/><span>Vault</span></button><button type="button" onClick={openMarketPanel} aria-label={locale==='ID'?'Buka menu Market saya':'Open My Market'}><span className="market-mobile-nav-icon"><UserRound size={20}/>{unreadCount>0&&<b>{Math.min(99,unreadCount)}</b>}</span><span>{locale==='ID'?'Market saya':'My Market'}</span></button><button type="button" className="is-sell" onClick={onSell}><Plus size={20}/><span>{locale==='ID'?'Jual':'Sell'}</span></button></nav>}{data&&<MarketQuickPanel panel={accountPanel??quickPanel} onOpenChange={open=>{if(!open){setAccountPanel(null);setQuickPanel(null)}}} onPanelChange={next=>{if(next==='listings'||next==='offers'||next==='orders'||next==='saved'){setQuickPanel(null);openAccountPanel(next)}else{setAccountPanel(null);setQuickPanel(next)}}} onCreateListing={()=>{setAccountPanel(null);onCreateListing()}} locale={locale} account={data} activityCounts={activityCounts} onRefresh={refresh} onSaved={async()=>{await refresh();setAccountPanel(null);setQuickPanel(null)}}/>}</>;
}
