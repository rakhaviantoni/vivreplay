'use client';

import {useEffect,useState} from 'react';

function relative(value:string,locale:string){
  const seconds=Math.round((new Date(value).getTime()-Date.now())/1000);
  const ranges:[number,Intl.RelativeTimeFormatUnit][]=[[60,'second'],[60,'minute'],[24,'hour'],[7,'day'],[4.34524,'week'],[12,'month'],[Number.POSITIVE_INFINITY,'year']];
  let amount=seconds;let unit:Intl.RelativeTimeFormatUnit='second';
  for(const [limit,nextUnit] of ranges){unit=nextUnit;if(Math.abs(amount)<limit)break;amount/=limit;}
  return new Intl.RelativeTimeFormat(locale,{numeric:'auto',style:'short'}).format(Math.round(amount),unit);
}

export function MarketTimestamp({value,prefix=''}:{value?:string;prefix?:string}){
  const [locale,setLocale]=useState('en');
  const [,tick]=useState(0);
  useEffect(()=>{const sync=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'id':'en');sync();window.addEventListener('vivreplay:locale',sync);const timer=window.setInterval(()=>tick(value=>value+1),60_000);return()=>{window.removeEventListener('vivreplay:locale',sync);window.clearInterval(timer)};},[]);
  if(!value)return null;
  return <time dateTime={value} title={new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}>{prefix}{relative(value,locale)}</time>;
}
