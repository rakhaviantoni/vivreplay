'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {ArrowSquareOutIcon as ArrowSquareOut, CalendarBlankIcon as Calendar} from '@phosphor-icons/react';

type SetRecord={code:string;name:string;releaseDate:string|null;officialUrl:string|null};

export function SetInformation({setCode,fallbackName,compact=false}:{setCode?:string|null;fallbackName?:string|null;compact?:boolean}) {
  const [set,setSet]=useState<SetRecord>();
  useEffect(()=>{
    if(!setCode){setSet(undefined);return}
    let active=true;
    void fetch('/api/cards/sets?language=EN',{cache:'force-cache'}).then(response=>response.ok?response.json() as Promise<{sets:SetRecord[]}>:{sets:[]}).then(({sets})=>{if(active){const row=sets.find(item=>item.code.toUpperCase()===setCode.toUpperCase());if(row)setSet(row)}});
    return()=>{active=false};
  },[setCode]);
  if(!setCode&&!fallbackName)return null;
  const name=set?.name??fallbackName??setCode;
  const setLink=<Link href={setCode?`/sets/${encodeURIComponent(setCode)}`:'/sets'}>{name}<small>{setCode}</small></Link>;
  const release=set?.releaseDate&&<time dateTime={set.releaseDate}><Calendar size={13}/>{new Intl.DateTimeFormat('en',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${set.releaseDate}T00:00:00Z`))}</time>;
  const official=set?.officialUrl&&<a href={set.officialUrl} target="_blank" rel="noreferrer" aria-label={`Official information for ${name}`}><ArrowSquareOut size={15}/></a>;
  if(compact)return <div className="card-set-information is-compact" aria-label="Set information"><dt>Set</dt><dd>{setLink}{release}{official}</dd></div>;
  return <section className="card-set-information" aria-label="Set information"><span>Set</span>{setLink}{release}{official}</section>;
}
