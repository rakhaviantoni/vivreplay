'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@/utils/supabase/client';
import {Catalog,normalizeSetCode,type CatalogSetInfo} from './catalog';
import {isPlayableSet} from '@/packages/domain/release-availability';

type SetRow=CatalogSetInfo&{external_set_id:string};

export function SetDetail({code}:{code:string}){
  const [set,setSet]=useState<SetRow>();
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  const normalizedCode=normalizeSetCode(code);
  const id=locale==='ID';

  useEffect(()=>{
    const syncLocale=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail);
    syncLocale();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);

  useEffect(()=>{
    if(!isPlayableSet(normalizedCode))return;
    let live=true;
    const client=createClient();
    client.from('tcg_sets').select('external_set_id,name,set_kind,release_date,description,official_url,product_image_url').then(({data})=>{
      if(!live)return;
      const match=(data??[]).find(row=>normalizeSetCode(row.external_set_id)===normalizedCode);
      setSet(match as SetRow|undefined);
    });
    return()=>{live=false};
  },[normalizedCode]);

  if(!isPlayableSet(normalizedCode))return <main className="page catalog-page"><section className="library-intro"><div className="library-intro-copy"><p className="kicker">{id?'ARSIP SET':'SET ARCHIVE'}</p><h1>{id?`${code} sedang dipersiapkan.`:`${code} is being prepared.`}</h1><p>{id?'Rilis ini belum tersedia sampai data kartu dan aturannya selesai diproses.':'This release is unavailable until its card data and rules have been completed.'}</p><Link className="button secondary" href="/sets">{id?'Semua set':'All sets'}</Link></div></section></main>;

  return <Catalog key={normalizedCode} initialSet={normalizedCode} setPage setInfo={set}/>;
}
