/* eslint-disable react-hooks/set-state-in-effect -- hydrate stored navigation preferences after mount. */
'use client';

import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {FormEvent,useCallback,useEffect,useState} from 'react';
import {ArrowLeftIcon as ArrowLeft,CardsIcon as Cards,MoonIcon as Moon,PlusIcon as Plus,MagnifyingGlassIcon as Search,SunIcon as Sun,UserIcon as UserRound,StorefrontIcon as Storefront,ShoppingCartIcon as Cart} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {VivreMark} from './brand-assets';
import {useAccount} from '@/lib/client';
import {authClient} from '@/lib/auth-client';
import {loadMarketActivityCounts} from '@/lib/market/activity-client';
import {MarketAccountMenu} from './market-account-menu';
import {MarketCartSheet} from './market-cart-sheet';
import {MarketQuickPanel} from './market-quick-panel';
import {MarketProDialog} from './market-pro-dialog';
import '@/app/market-account.css';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';

function CreateMenu({locale,mobile,onCreate}:{locale:'EN'|'ID';mobile:boolean;onCreate:(type:'WTS'|'WTB')=>void}){
  return <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className={mobile?'is-sell':'market-list-button join-link'} aria-label={locale==='ID'?'Buat listing':'Create a listing'}><Plus size={mobile?20:15}/><span className={mobile?'': 'market-list-button-text'}>{mobile?(locale==='ID'?'Buat':'Create'):(locale==='ID'?'Buat':'Create')}</span></button></DropdownMenuTrigger><DropdownMenuContent align="end" side={mobile?'top':'bottom'} sideOffset={8} className="market-create-menu"><DropdownMenuItem className="market-create-menu-item" onSelect={()=>onCreate('WTS')}><Storefront size={17}/><span>{locale==='ID'?'Jual kartu':'Sell cards'}</span></DropdownMenuItem><DropdownMenuItem className="market-create-menu-item" onSelect={()=>onCreate('WTB')}><Cards size={17}/><span>{locale==='ID'?'Cari kartu':'Looking to buy'}</span></DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

export function MarketStoreNav({initialQuery='',sellHref='/market?sell=open',showPromo=true,queryValue,onQueryChange,searchPlaceholder,searchAriaLabel,onSearchSubmit,onCreateListing}:{initialQuery?:string;sellHref?:string;showPromo?:boolean;queryValue?:string;onQueryChange?:(value:string)=>void;searchPlaceholder?:string;searchAriaLabel?:string;onSearchSubmit?:(value:string)=>void;onCreateListing?:(type:'WTS'|'WTB')=>void}){
  const router=useRouter();
  const pathname=usePathname();
  const marketHref=pathname.startsWith('/id')?'/id/market':'/market';
  const {data,refresh,loading:accountLoading}=useAccount();
  const [activityCounts,setActivityCounts]=useState({listings:0,offers:0,orders:0});
  const [proPaymentsCount,setProPaymentsCount]=useState(0);
  const [cartCount,setCartCount]=useState(0);
  const [scrolled,setScrolled]=useState(false);
  const [query,setQuery]=useState(initialQuery);
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  const [accountPanel,setAccountPanel]=useState<'listings'|'offers'|'orders'|'saved'|null>(null);
  const [selectedOrderId,setSelectedOrderId]=useState<string|null>(null);
  const [selectedConversationId,setSelectedConversationId]=useState<string|null>(null);
  const [quickPanel,setQuickPanel]=useState<'profile'|'vault'|'wishlist'|null>(null);
  const [initialProfileTab,setInitialProfileTab]=useState<'account'|'delivery'|'payouts'>('account');
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
  const currentQuery=queryValue??query;
  const search=(event:FormEvent)=>{event.preventDefault();if(onSearchSubmit){onSearchSubmit(currentQuery);return}router.push(`/market${currentQuery.trim()?`?card=${encodeURIComponent(currentQuery.trim())}`:''}`)};
  const onSell=()=>{
    if(data){
      const printingId=new URL(sellHref,window.location.origin).searchParams.get('sell');
      if(printingId&&printingId!=='open')window.dispatchEvent(new CustomEvent('vivreplay:open-sell-printing',{detail:printingId}));
      else window.dispatchEvent(new CustomEvent('vivreplay:open-sell-listing',{detail:'WTS'}));
    }else{
      window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));
    }
  };
  const createListing=(type:'WTS'|'WTB')=>{
    setAccountPanel(null);
    if(onCreateListing){onCreateListing(type);return;}
    if(pathname.includes('/market/')&&data&&type==='WTS'){
      const printingId=new URL(sellHref,window.location.origin).searchParams.get('sell');
      if(printingId){window.dispatchEvent(new CustomEvent('vivreplay:open-sell-printing',{detail:printingId}));return;}
    }
    window.dispatchEvent(new CustomEvent('vivreplay:open-sell-listing',{detail:type}));
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
  useEffect(()=>{
    const profileId=data?.profile?.id;if(!profileId)return;
    const storageKey=`vivreplay-market-offer-events:${profileId}`;
    let seen:string[]=[];try{seen=JSON.parse(window.localStorage.getItem(storageKey)||'[]') as string[];if(!Array.isArray(seen))seen=[]}catch{seen=[]}
    let cursor=Date.now()-20_000;let active=true;let busy=false;
    type OfferEvent={id:string;offerId:string|null;actorName:string|null;kind:string;body:string|null;createdAt:string;amount:number|null;currency:string|null;listingTitle:string;cardCount:number;attachmentCount:number};
    const poll=async()=>{
      if(!active||busy||document.visibilityState!=='visible')return;busy=true;
      try{
        const response=await fetch(`/api/market/activity/events?since=${encodeURIComponent(new Date(cursor).toISOString())}`,{cache:'no-store'});
        if(!response.ok)return;
        const result=await response.json() as {events?:OfferEvent[]};const incoming=(result.events??[]).filter(event=>!seen.includes(event.id));
        for(const event of incoming.slice(-4)){
          const sender=event.actorName||(locale==='ID'?'Kolektor':'Collector');const target=event.listingTitle||(locale==='ID'?'penawaran ini':'this offer');
          const total=event.amount===null?'':new Intl.NumberFormat(locale==='ID'?'id-ID':'en-US',{style:'currency',currency:event.currency||'IDR',maximumFractionDigits:0}).format(event.amount);
          let message:string;
          if(event.kind==='OFFER_COUNTERED'||event.kind==='OFFER_REVISED'){const count=event.cardCount||0;const cards=locale==='ID'?`${count} kartu`:`${count} ${count===1?'card':'cards'}`;message=event.kind==='OFFER_REVISED'?(locale==='ID'?`${sender} memperbarui penawaran menjadi ${total} untuk ${cards} di ${target}`:`${sender} revised the offer to ${total} for ${cards} in ${target}`):(locale==='ID'?`${sender} mengirim penawaran balik ${total} untuk ${cards} di ${target}`:`${sender} sent you a counteroffer of ${total} for ${cards} in ${target}`);}
          else if(event.kind==='OFFER_ACCEPTED')message=locale==='ID'?`${sender} menerima penawaran ${total} untuk ${target}`:`${sender} accepted the ${total} offer for ${target}`;
          else if(event.kind==='OFFER_DECLINED')message=locale==='ID'?`${sender} menolak penawaran ${total} untuk ${target}`:`${sender} declined the ${total} offer for ${target}`;
          else if(event.kind==='PHOTO_REQUEST')message=locale==='ID'?`${sender} meminta foto kartu untuk ${target}`:`${sender} requested card photos for ${target}`;
          else if(event.attachmentCount)message=locale==='ID'?`${sender} membagikan ${event.attachmentCount} foto kartu untuk ${target}`:`${sender} shared ${event.attachmentCount} card photo${event.attachmentCount===1?'':'s'} for ${target}`;
          else{const body=event.body?.trim().replace(/\s+/g,' ')||(locale==='ID'?'Pesan baru':'New message');message=`${sender}: ${body.length>110?`${body.slice(0,107)}…`:body}`;}
          toast.info(message,{id:event.id,action:event.offerId?{label:locale==='ID'?'Buka penawaran':'Open offer',onClick:()=>window.dispatchEvent(new CustomEvent('vivreplay:open-market-offer',{detail:event.offerId}))}:undefined});
        }
        seen=[...seen,...incoming.map(event=>event.id)].slice(-100);try{window.localStorage.setItem(storageKey,JSON.stringify(seen))}catch{}cursor=Date.now();
      }catch{}finally{busy=false}
    };
    void poll();const timer=window.setInterval(()=>void poll(),12_000);const onVisibility=()=>{if(document.visibilityState==='visible')void poll()};document.addEventListener('visibilitychange',onVisibility);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisibility)};
  },[data?.profile?.id,locale]);
  const openAccountPanel=useCallback((panel:'listings'|'offers'|'orders'|'saved',conversationId:string|null=null)=>{setQuickPanel(null);setSelectedConversationId(conversationId);setAccountPanel(panel);if(panel==='saved')return;setActivityCounts(current=>({...current,[panel]:0}));void fetch('/api/market/activity',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({section:panel})}).catch(()=>undefined)},[]);
  useEffect(()=>{const open=(event:Event)=>{setSelectedOrderId((event as CustomEvent<string>).detail??null);openAccountPanel('orders')};window.addEventListener('vivreplay:open-market-orders',open);return()=>window.removeEventListener('vivreplay:open-market-orders',open)},[openAccountPanel]);
  useEffect(()=>{const open=(event:Event)=>{const conversationId=(event as CustomEvent<string>).detail;if(conversationId)openAccountPanel('offers',conversationId)};window.addEventListener('vivreplay:open-market-offer',open);return()=>window.removeEventListener('vivreplay:open-market-offer',open)},[openAccountPanel]);
  useEffect(()=>{const open=()=>{setAccountPanel(null);setInitialProfileTab('payouts');setQuickPanel('profile')};window.addEventListener('vivreplay:open-market-payouts',open);return()=>window.removeEventListener('vivreplay:open-market-payouts',open)},[]);
  const unreadCount=activityCounts.listings+activityCounts.offers+activityCounts.orders;
  const signInLabel=locale==='ID'?'Masuk':'Sign in';
  const showMobileNav=!pathname.includes('/checkout')&&pathname.includes('/market');
  const openVault=()=>{if(!data){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return}setAccountPanel(null);setQuickPanel('vault')};
  const openMarketPanel=()=>{if(!data){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return}openAccountPanel('listings')};
  const signOut=useCallback(async()=>{setAccountPanel(null);setQuickPanel(null);await authClient.signOut();router.replace(marketHref);router.refresh()},[marketHref,router]);
  useEffect(()=>{const handleSignOut=()=>{void signOut()};window.addEventListener('vivreplay:sign-out',handleSignOut);return()=>window.removeEventListener('vivreplay:sign-out',handleSignOut)},[signOut]);
  return <>{showPromo&&<div className="market-store-promo">{locale==='ID'?'Koleksi yang tepat, satu kartu pada satu waktu.':'Build your collection, one exact card at a time.'}</div>}<nav className={`market-store-nav${scrolled?' is-scrolled':''}`} aria-label="VivrePlay Market"><Link href="/" className="market-back-link"><ArrowLeft size={15}/><VivreMark size={18}/><span>VivrePlay</span></Link><i className="market-nav-divider"/><Link href="/market" className="market-store-wordmark"><b>Market</b></Link><form className="market-store-search" onSubmit={search}><Search size={18}/><input value={currentQuery} onChange={event=>{const value=event.target.value;if(onQueryChange)onQueryChange(value);else setQuery(value)}} placeholder={searchPlaceholder??(locale==='ID'?'Cari kartu atau listing':'Search cards and listings')} aria-label={searchAriaLabel??(locale==='ID'?'Cari kartu dan listing':'Search cards and listings')}/></form><div className="masthead-actions market-store-actions" aria-busy={accountLoading||undefined}>{accountLoading?<span className="market-nav-auth-placeholder market-pro-nav-link is-pro" aria-hidden="true"/>:<MarketProDialog locale={locale} profile={data?.profile??null} member={String(data?.profile?.tier??'free').toLowerCase()==='pro'}/>}<MarketCartSheet locale={locale}/>{accountLoading?<span className="market-nav-auth-placeholder market-account-trigger is-account" aria-hidden="true"/>:data&&<MarketAccountMenu account={data} locale={locale} activityCounts={activityCounts} proPaymentsCount={proPaymentsCount} onOpenSection={openAccountPanel} onOpenQuick={panel=>{setAccountPanel(null);setInitialProfileTab('account');setQuickPanel(panel)}}/>}{accountLoading?<span className="market-nav-auth-placeholder market-store-link is-vault" aria-hidden="true"/>:<button type="button" className="market-store-link" onClick={()=>{if(!data){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return}setAccountPanel(null);setQuickPanel('vault')}}>{locale==='ID'?'Koleksi saya':'Vault'}</button>}<button className="market-store-locale locale-toggle" type="button" onClick={changeLocale} aria-label={locale==='ID'?'Ganti bahasa':'Switch language'}>{locale}</button><button className="market-store-theme theme-toggle" type="button" onClick={changeTheme} aria-label={locale==='ID'?`Gunakan mode ${theme==='light'?'gelap':'terang'}`:`Use ${theme==='light'?'dark':'light'} mode`}>{theme==='light'?<Moon size={16}/>:<Sun size={16}/>}</button>{accountLoading?<span className="market-nav-auth-placeholder market-list-button join-link is-create" aria-hidden="true"/>:data?<CreateMenu locale={locale} mobile={false} onCreate={createListing}/>:<button className="market-list-button join-link" type="button" onClick={onSell} aria-label={signInLabel}><UserRound size={15}/><span className="market-list-button-text">{signInLabel}</span></button>}</div></nav>{showMobileNav&&<nav className="market-mobile-nav" aria-label={locale==='ID'?'Navigasi Market':'Market navigation'}><Link href={marketHref} aria-current={pathname.includes('/market')?'page':undefined}><Storefront size={20}/><span>Market</span></Link><button type="button" onClick={()=>window.dispatchEvent(new Event('vivreplay:open-market-cart'))} aria-label={locale==='ID'?`Keranjang, ${cartCount} kartu`:`Cart, ${cartCount} cards`}><span className="market-mobile-nav-icon"><Cart size={20}/>{cartCount>0&&<b>{Math.min(99,cartCount)}</b>}</span><span>{locale==='ID'?'Keranjang':'Cart'}</span></button>{accountLoading?<><button type="button" className="market-mobile-nav-auth-placeholder" disabled aria-hidden="true"><i/></button><button type="button" className="market-mobile-nav-auth-placeholder" disabled aria-hidden="true"><i/></button><button type="button" className="market-mobile-nav-auth-placeholder" disabled aria-hidden="true"><i/></button></>:<><button type="button" onClick={openVault}><Cards size={20}/><span>{locale==='ID'?'Koleksi':'Vault'}</span></button><button type="button" onClick={openMarketPanel} aria-label={locale==='ID'?'Buka menu Market saya':'Open My Market'}><span className="market-mobile-nav-icon"><UserRound size={20}/>{unreadCount>0&&<b>{Math.min(99,unreadCount)}</b>}</span><span>{locale==='ID'?'Market saya':'My Market'}</span></button>{data?<CreateMenu locale={locale} mobile onCreate={createListing}/>:<button type="button" className="is-sell" onClick={onSell}><Plus size={20}/><span>{locale==='ID'?'Buat':'Create'}</span></button>}</>}</nav>}{data&&<MarketQuickPanel panel={accountPanel??quickPanel} onOpenChange={open=>{if(!open){setAccountPanel(null);setQuickPanel(null);setSelectedConversationId(null)}}} onPanelChange={next=>{if(next==='listings'||next==='offers'||next==='orders'||next==='saved'){setQuickPanel(null);openAccountPanel(next)}else{setAccountPanel(null);setQuickPanel(next)}}} onCreateListing={()=>{setAccountPanel(null);createListing('WTS')}} locale={locale} account={data} activityCounts={activityCounts} initialOrderId={selectedOrderId} initialConversationId={selectedConversationId} initialProfileTab={initialProfileTab} onRefresh={refresh} onSaved={async()=>{await refresh();setAccountPanel(null);setQuickPanel(null)}}/>}</>;
}
