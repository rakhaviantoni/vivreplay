'use client';

import type {CSSProperties,ReactNode} from 'react';

export function MarketSellAction({printingId,className,style,children}:{printingId:string;className?:string;style?:CSSProperties;children:ReactNode}){
  return <button type="button" className={className} style={style} onClick={()=>window.dispatchEvent(new CustomEvent('vivreplay:open-sell-printing',{detail:printingId}))}>{children}</button>;
}
