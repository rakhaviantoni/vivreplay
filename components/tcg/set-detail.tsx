'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Catalog,normalizeSetCode,type CatalogSetInfo} from './catalog';
import {isPlayableSet} from '@/packages/domain/release-availability';

type SetRow=CatalogSetInfo&{code:string};
type SetApiRow={code:string;name:string;releaseDate?:string;description?:string;officialUrl?:string;productImageUrl?:string};

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
    fetch('/api/cards/sets?language=EN',{cache:'force-cache'}).then(response=>response.ok?response.json() as Promise<{sets:SetApiRow[]}>:{sets:[]}).then(({sets})=>{
      if(!live)return;
      const match=sets.find(row=>normalizeSetCode(row.code)===normalizedCode);
      setSet(match?{code:match.code,name:match.name,set_kind:'booster',release_date:match.releaseDate??null,description:match.description??null,official_url:match.officialUrl??null,product_image_url:match.productImageUrl??null}:undefined);
    });
    return()=>{live=false};
  },[normalizedCode]);

  if(!isPlayableSet(normalizedCode))return <main className="page catalog-page"><section className="library-intro"><div className="library-intro-copy"><p className="kicker">{id?'ARSIP SET':'SET ARCHIVE'}</p><h1>{id?`${code} sedang dipersiapkan.`:`${code} is being prepared.`}</h1><p>{id?'Rilis ini belum tersedia sampai data kartu dan aturannya selesai diproses.':'This release is unavailable until its card data and rules have been completed.'}</p><Link className="button secondary" href="/sets">{id?'Semua set':'All sets'}</Link></div></section></main>;

  return <Catalog key={normalizedCode} initialSet={normalizedCode} setPage setInfo={set}/>;
}
