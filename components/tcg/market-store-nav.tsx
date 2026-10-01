'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {FormEvent,useEffect,useState} from 'react';
import {ArrowLeftIcon as ArrowLeft,MoonIcon as Moon,PlusIcon as Plus,MagnifyingGlassIcon as Search,SunIcon as Sun,ArrowRightIcon as ArrowRight} from '@phosphor-icons/react';
import {VivreMark} from './brand-assets';
import {useAccount} from '@/lib/client';

export function MarketStoreNav({initialQuery='',sellHref='/market?sell=open'}:{initialQuery?:string;sellHref?:string}){
  const router=useRouter();
  const {data}=useAccount();
  const [query,setQuery]=useState(initialQuery);
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
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
      router.push(sellHref);
    }else{
      window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));
    }
  };
  const signInLabel=locale==='ID'?'Masuk':'Sign in';
  return <><div className="market-store-promo">{locale==='ID'?'Koleksi yang tepat, satu kartu pada satu waktu.':'Build your collection, one exact card at a time.'}</div><nav className="market-store-nav" aria-label="VivrePlay Market"><Link href="/" className="market-back-link"><ArrowLeft size={15}/><VivreMark size={18}/><span>VivrePlay</span></Link><i className="market-nav-divider"/><Link href="/market" className="market-store-wordmark"><b>Market</b></Link><form className="market-store-search" onSubmit={search}><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={locale==='ID'?'Cari kartu atau listing':'Search cards and listings'} aria-label={locale==='ID'?'Cari kartu dan listing':'Search cards and listings'}/></form><div className="masthead-actions market-store-actions"><Link href="/vault" className="market-store-link">{locale==='ID'?'Vault saya':'Vault'}</Link><button className="market-store-locale locale-toggle" type="button" onClick={changeLocale} aria-label={locale==='ID'?'Ganti bahasa':'Switch language'}>{locale}</button><button className="market-store-theme theme-toggle" type="button" onClick={changeTheme} aria-label={locale==='ID'?`Gunakan mode ${theme==='light'?'gelap':'terang'}`:`Use ${theme==='light'?'dark':'light'} mode`}>{theme==='light'?<Moon size={16}/>:<Sun size={16}/>}</button><button className="market-list-button join-link" type="button" onClick={onSell} aria-label={data?(locale==='ID'?'Jual kartu':'Sell'):signInLabel}>{data?<Plus size={15}/>:<ArrowRight size={15}/>}<span className="market-list-button-text">{data?(locale==='ID'?'Jual kartu':'Sell'):signInLabel}</span><span className="market-list-button-short">{data?(locale==='ID'?'Jual':'Sell'):signInLabel}</span></button></div></nav></>;
}
