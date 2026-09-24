'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {ArrowSquareOutIcon as ArrowSquareOut, CalendarBlankIcon as Calendar} from '@phosphor-icons/react';
import {createClient} from '@/utils/supabase/client';

type SetRecord={external_set_id:string;name:string;release_date:string|null;official_url:string|null};

export function SetInformation({setCode,fallbackName,compact=false}:{setCode?:string|null;fallbackName?:string|null;compact?:boolean}) {
  const [set,setSet]=useState<SetRecord>();
  useEffect(()=>{
    if(!setCode){setSet(undefined);return}
    let active=true;
    void createClient().from('tcg_sets').select('external_set_id,name,release_date,official_url').eq('external_set_id',setCode).maybeSingle().then(({data})=>{if(active&&data)setSet(data as SetRecord)});
    return()=>{active=false};
  },[setCode]);
  if(!setCode&&!fallbackName)return null;
  const name=set?.name??fallbackName??setCode;
  const setLink=<Link href={setCode?`/sets/${encodeURIComponent(setCode)}`:'/sets'}>{name}<small>{setCode}</small></Link>;
  const release=set?.release_date&&<time dateTime={set.release_date}><Calendar size={13}/>{new Intl.DateTimeFormat('en',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${set.release_date}T00:00:00Z`))}</time>;
  const official=set?.official_url&&<a href={set.official_url} target="_blank" rel="noreferrer" aria-label={`Official information for ${name}`}><ArrowSquareOut size={15}/></a>;
  if(compact)return <div className="card-set-information is-compact" aria-label="Set information"><dt>Set</dt><dd>{setLink}{release}{official}</dd></div>;
  return <section className="card-set-information" aria-label="Set information"><span>Set</span>{setLink}{release}{official}</section>;
}
