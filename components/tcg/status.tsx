'use client';
import {useEffect, useState} from 'react';

export function AccountStatus({error,retry}:{error:string;retry:()=>void}){
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');
  useEffect(()=>{
    const sync=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    sync();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);

  const t=(en:string,idStr:string)=>language==='ID'?idStr:en;

  return error?<div className="empty-state" role="alert">
    <h2>{t('Account unavailable','Akun tidak tersedia')}</h2>
      <p>{error}</p>
      <div className="actions">
        <button className="button secondary" onClick={retry}>{t('Try again','Coba lagi')}</button>
        <button className="button" type="button" onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}))}>{t('Sign in','Masuk')}</button>
      </div>
  </div>:<div className="collection-status-skeleton" role="status" aria-label={t('Loading your collection','Memuat koleksi Anda')}><i/><i/><span className="sr-only">{t('Loading your collection','Memuat koleksi Anda')}</span></div>;
}
