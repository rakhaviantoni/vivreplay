'use client';

import {useEffect} from 'react';

const fontStylesheet='https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,500;0,600;0,700;0,800;1,600&family=Roboto+Condensed:wght@400;500;600;700&display=swap';

export function DeferredWebFonts(){
  useEffect(()=>{
    if(document.querySelector('link[data-vivreplay-fonts]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=fontStylesheet;
    link.media='print';
    link.dataset.vivreplayFonts='true';
    link.onload=()=>{link.media='all';};
    document.head.appendChild(link);
    const fallback=window.setTimeout(()=>{link.media='all';},3500);
    return()=>window.clearTimeout(fallback);
  },[]);
  return null;
}
