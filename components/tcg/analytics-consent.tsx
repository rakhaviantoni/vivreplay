'use client';

import {useEffect} from 'react';
import {usePathname} from 'next/navigation';

type AnalyticsWindow=Window&{dataLayer?:unknown[];gtag?:(...args:unknown[])=>void;__vivreplayGaLoaded?:boolean};
const measurementId='G-2Z50572QD3';

export function AnalyticsConsent(){
  const path=usePathname();
  useEffect(()=>{
    const target=window as AnalyticsWindow;
    const enable=()=>{
      if(window.localStorage.getItem('vivreplay-cookies')!=='all')return;
      if(!target.__vivreplayGaLoaded){
        target.dataLayer=target.dataLayer??[];
        target.gtag=(...args:unknown[])=>{target.dataLayer?.push(args)};
        target.gtag('js',new Date());
        target.gtag('config',measurementId,{send_page_view:false});
        const script=document.createElement('script');script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${measurementId}`;script.id='vivreplay-google-analytics';document.head.appendChild(script);
        target.__vivreplayGaLoaded=true;
      }
      target.gtag?.('event','page_view',{page_path:path,page_location:`${window.location.origin}${path}`});
    };
    const disable=()=>{
      document.getElementById('vivreplay-google-analytics')?.remove();
      target.__vivreplayGaLoaded=false;
      target.gtag=undefined;
      target.dataLayer=[];
      const host=window.location.hostname;
      const domains=[host,`.${host}`];
      if(host.endsWith('vivreplay.com'))domains.push('.vivreplay.com');
      for(const cookie of document.cookie.split(';')){
        const name=cookie.split('=')[0]?.trim();
        if(!name||!/^_ga(?:_|$)/.test(name))continue;
        for(const domain of domains)document.cookie=`${name}=; Max-Age=0; path=/; domain=${domain}; SameSite=Lax`;
        document.cookie=`${name}=; Max-Age=0; path=/; SameSite=Lax`;
      }
    };
    const consentChanged=(event:Event)=>{
      const choice=(event as CustomEvent<string>).detail;
      if(choice==='all')enable();else disable();
    };
    enable();
    window.addEventListener('vivreplay:consent-change',consentChanged);
    return()=>window.removeEventListener('vivreplay:consent-change',consentChanged);
  },[path]);
  return null;
}
