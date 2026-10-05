'use client';

import {useEffect,useRef,useState} from 'react';

declare global{
  interface Window{
    turnstile?:{
      render:(container:HTMLElement,options:{sitekey:string;callback:(token:string)=>void;'expired-callback':()=>void;'error-callback':(code:string)=>void;'timeout-callback'?:()=>void;theme?:'auto'|'light'|'dark';size?:'normal'|'compact'|'flexible';'refresh-expired'?:'auto'|'manual'|'never'})=>string;
      reset:(widgetId?:string)=>void;
      remove:(widgetId:string)=>void;
    };
  }
}

const siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY??'';
let loadingScript:Promise<void>|null=null;

function loadTurnstile(){
  if(window.turnstile)return Promise.resolve();
  if(!loadingScript){
    loadingScript=new Promise((resolve,reject)=>{
      const existing=document.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
      if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('Turnstile failed to load.')),{once:true});return;}
      const script=document.createElement('script');
      script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async=true;script.defer=true;
      script.onload=()=>resolve();script.onerror=()=>reject(new Error('Turnstile failed to load.'));
      document.head.appendChild(script);
    });
  }
  return loadingScript.catch(error=>{loadingScript=null;document.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]')?.remove();throw error;});
}

export function TurnstileField({onToken,resetKey=0}:{onToken:(token:string)=>void;resetKey?:number}){
  const container=useRef<HTMLDivElement>(null);
  const widget=useRef<string|undefined>(undefined);
  const callback=useRef(onToken);
  useEffect(()=>{callback.current=onToken},[onToken]);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');
  useEffect(()=>{const sync=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');sync();window.addEventListener('vivreplay:locale',sync);return()=>window.removeEventListener('vivreplay:locale',sync)},[]);

  useEffect(()=>{
    if(!siteKey||!container.current)return;
    callback.current('');
    let active=true;
    void loadTurnstile().then(()=>{
      if(!active||!container.current||!window.turnstile)return;
      widget.current=window.turnstile.render(container.current,{
        sitekey:siteKey,
        theme:'auto',
        size:'flexible',
        'refresh-expired':'auto',
        callback:token=>{setError('');callback.current(token)},
        'expired-callback':()=>callback.current(''),
        'timeout-callback':()=>{callback.current('');setError('timeout')},
        'error-callback':code=>{callback.current('');setError(code)},
      });
    }).catch(()=>{if(active){callback.current('');setError('load')}});
    return()=>{
      active=false;
      if(widget.current&&window.turnstile)window.turnstile.remove(widget.current);
      widget.current=undefined;
      callback.current('');
    };
  },[retry]);

  useEffect(()=>{
    if(resetKey&&widget.current&&window.turnstile){
      callback.current('');setError('');window.turnstile.reset(widget.current);
    }
  },[resetKey]);

  if(!siteKey)return null;
  return <div className="turnstile-field"><div ref={container} aria-label={language==='ID'?'Pemeriksaan keamanan':'Security check'}/>{error&&<div role="alert"><p>{language==='ID'?'Pemeriksaan keamanan gagal, coba lagi.':'The security check failed, please retry.'} <small>({error})</small></p><button type="button" className="button secondary" onClick={()=>{setError('');setRetry(value=>value+1)}}>{language==='ID'?'Coba lagi':'Retry security check'}</button></div>}</div>;
}

export function turnstileHeaders(token:string):Record<string,string>{
  return token?{'cf-turnstile-response':token}:{};
}

export const turnstileEnabled=Boolean(siteKey);
