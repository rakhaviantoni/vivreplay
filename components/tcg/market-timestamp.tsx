'use client';

import {useEffect,useState} from 'react';

function relative(value:string,locale:string){
  const diffMs=Math.max(0,Date.now()-new Date(value).getTime());
  const seconds=Math.floor(diffMs/1000);
  const minutes=Math.floor(seconds/60);
  const hours=Math.floor(minutes/60);
  const days=Math.floor(hours/24);
  const isId=locale.toLowerCase()==='id';

  if(seconds<60)return isId?'baru saja':'just now';
  if(minutes<60)return isId?`${minutes} mnt lalu`:`${minutes}m ago`;
  if(hours<24)return isId?`${hours} jam lalu`:`${hours}h ago`;
  if(days===1)return isId?'kemarin':'yesterday';
  if(days<7)return isId?`${days} hari lalu`:`${days}d ago`;
  if(days<30){
    const weeks=Math.floor(days/7);
    return isId?`${weeks} minggu lalu`:`${weeks}w ago`;
  }
  if(days<365){
    const months=Math.floor(days/30);
    return isId?`${months} bln lalu`:`${months}mo ago`;
  }
  const years=Math.floor(days/365);
  return isId?`${years} thn lalu`:`${years}y ago`;
}

export function MarketTimestamp({value,prefix=''}:{value?:string;prefix?:string}){
  const [locale,setLocale]=useState('en');
  const [,tick]=useState(0);
  useEffect(()=>{const sync=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'id':'en');sync();window.addEventListener('vivreplay:locale',sync);const timer=window.setInterval(()=>tick(value=>value+1),60_000);return()=>{window.removeEventListener('vivreplay:locale',sync);window.clearInterval(timer)};},[]);
  if(!value)return null;
  return <time dateTime={value} title={new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}>{prefix}{relative(value,locale)}</time>;
}
