'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {FormEvent,useEffect,useState} from 'react';
import {ArrowLeftIcon as ArrowLeft,MoonIcon as Moon,PlusIcon as Plus,MagnifyingGlassIcon as Search,SunIcon as Sun} from '@phosphor-icons/react';
import {VivreMark} from './brand-assets';
import {useAccount} from '@/lib/client';

export function MarketStoreNav(){
  const router=useRouter();
  const {data}=useAccount();
  const [query,setQuery]=useState('');
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  useEffect(()=>{
    setTheme(window.localStorage.getItem('vivreplay-theme')==='dark'?'dark':'light');
    setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
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
      router.push('/market?sell=open');
    }else{
      window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));
    }
  };
  return <><div className="market-store-promo">{locale==='ID'?'Koleksi yang tepat, satu kartu pada satu waktu.':'Build your collection, one exact card at a time.'}</div><nav className="market-store-nav" aria-label="VivrePlay Market"><Link href="/" className="market-back-link"><ArrowLeft size={15}/><VivreMark size={18}/><span>VivrePlay</span></Link><i className="market-nav-divider"/><Link href="/market" className="market-store-wordmark"><b>Market</b></Link><form className="market-store-search" onSubmit={search}><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={locale==='ID'?'Cari kartu atau listing':'Search cards and listings'} aria-label={locale==='ID'?'Cari kartu dan listing':'Search cards and listings'}/></form><Link href="/vault" className="market-store-link">{locale==='ID'?'Vault saya':'Vault'}</Link><button className="market-store-locale" type="button" onClick={changeLocale} aria-label={locale==='ID'?'Ganti bahasa':'Switch language'}>{locale}</button><button className="market-store-theme" type="button" onClick={changeTheme} aria-label={locale==='ID'?`Gunakan mode ${theme==='light'?'gelap':'terang'}`:`Use ${theme==='light'?'dark':'light'} mode`}>{theme==='light'?<Moon size={17}/>:<Sun size={17}/>}</button><button className="market-list-button" type="button" onClick={onSell}><Plus size={15}/><span className="market-list-button-text">{data?(locale==='ID'?'Jual kartu':'Sell'):(locale==='ID'?'Masuk untuk menjual':'Sign in to sell')}</span><span className="market-list-button-short">{locale==='ID'?'Jual':'Sell'}</span></button></nav></>;
}
