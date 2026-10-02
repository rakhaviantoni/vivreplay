'use client';

import {useEffect,useRef} from 'react';

declare global{
  interface Window{
    turnstile?:{
      render:(container:HTMLElement,options:{sitekey:string;callback:(token:string)=>void;'expired-callback':()=>void;'error-callback':()=>void;theme?:'auto'|'light'|'dark';size?:'normal'|'compact'|'flexible'})=>string;
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
  return loadingScript;
}

export function TurnstileField({onToken,resetKey=0}:{onToken:(token:string)=>void;resetKey?:number}){
  const container=useRef<HTMLDivElement>(null);
  const widget=useRef<string|undefined>(undefined);

  useEffect(()=>{
    if(!siteKey||!container.current)return;
    let active=true;
    void loadTurnstile().then(()=>{
      if(!active||!container.current||!window.turnstile)return;
      widget.current=window.turnstile.render(container.current,{
        sitekey:siteKey,
        theme:'auto',
        size:'flexible',
        callback:token=>onToken(token),
        'expired-callback':()=>onToken(''),
        'error-callback':()=>onToken(''),
      });
    }).catch(()=>{if(active)onToken('');});
    return()=>{
      active=false;
      if(widget.current&&window.turnstile)window.turnstile.remove(widget.current);
      widget.current=undefined;
    };
  },[onToken]);

  useEffect(()=>{
    if(resetKey&&widget.current&&window.turnstile){
      onToken('');window.turnstile.reset(widget.current);
    }
  },[resetKey,onToken]);

  if(!siteKey)return null;
  return <div className="turnstile-field" ref={container} aria-label="Security check"/>;
}

export function turnstileHeaders(token:string):Record<string,string>{
  return token?{'cf-turnstile-response':token}:{};
}

export const turnstileEnabled=Boolean(siteKey);
