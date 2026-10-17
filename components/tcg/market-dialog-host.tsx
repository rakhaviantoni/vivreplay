'use client';

import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {useAccount} from '@/lib/client';
import type {MarketAccountPanel} from './market-quick-panel';

const MarketSellDialog=lazy(()=>import('./market').then(module=>({default:module.Market})));
const MarketAccountDialog=lazy(()=>import('./market-quick-panel').then(module=>({default:module.MarketQuickPanel})));

type SellRequest={key:number;printingId?:string;type?:'WTS'|'WTB'};
type AccountRequest={key:number;panel:MarketAccountPanel;profileTab?:'account'|'delivery'|'payouts';orderId?:string;conversationId?:string};

export function MarketDialogHost({accountActions=true}:{accountActions?:boolean}){
  const {data,loading,refresh}=useAccount();
  const sequence=useRef(0);
  const pendingAccount=useRef<Omit<AccountRequest,'key'>|null>(null);
  const [sellRequest,setSellRequest]=useState<SellRequest|null>(null);
  const [accountRequest,setAccountRequest]=useState<AccountRequest|null>(null);

  useEffect(()=>{
    const openPrinting=(event:Event)=>{const printingId=(event as CustomEvent<string>).detail;if(printingId)setSellRequest({key:++sequence.current,printingId})};
    const openListing=(event:Event)=>{const type=(event as CustomEvent<'WTS'|'WTB'>).detail;setSellRequest({key:++sequence.current,type:type==='WTB'?'WTB':'WTS'})};
    window.addEventListener('vivreplay:open-sell-printing',openPrinting);
    window.addEventListener('vivreplay:open-sell-listing',openListing);
    return()=>{window.removeEventListener('vivreplay:open-sell-printing',openPrinting);window.removeEventListener('vivreplay:open-sell-listing',openListing)};
  },[]);

  useEffect(()=>{
    const open=(request:Omit<AccountRequest,'key'>)=>{
      if(loading){pendingAccount.current=request;return;}
      if(!data){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return;}
      setAccountRequest({...request,key:++sequence.current});
    };
    const payouts=()=>open({panel:'profile',profileTab:'payouts'});
    const delivery=()=>open({panel:'profile',profileTab:'delivery'});
    const orders=(event:Event)=>open({panel:'orders',orderId:(event as CustomEvent<string>).detail});
    const offer=(event:Event)=>open({panel:'offers',conversationId:(event as CustomEvent<string>).detail});
    if(!accountActions)return;
    window.addEventListener('vivreplay:open-market-payouts',payouts);
    window.addEventListener('vivreplay:open-market-delivery',delivery);
    window.addEventListener('vivreplay:open-market-orders',orders);
    window.addEventListener('vivreplay:open-market-offer',offer);
    return()=>{window.removeEventListener('vivreplay:open-market-payouts',payouts);window.removeEventListener('vivreplay:open-market-delivery',delivery);window.removeEventListener('vivreplay:open-market-orders',orders);window.removeEventListener('vivreplay:open-market-offer',offer)};
  },[data,loading,accountActions]);

  useEffect(()=>{
    if(loading||!pendingAccount.current)return;
    const request=pendingAccount.current;
    pendingAccount.current=null;
    if(!data){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return;}
    setAccountRequest({...request,key:++sequence.current});
  },[data,loading]);

  const locale=typeof document!=='undefined'&&document.documentElement.lang.toLowerCase().startsWith('id')?'ID':'EN';
  return <>
    {sellRequest&&<Suspense fallback={null}><MarketSellDialog key={sellRequest.key} modalOnly initialSellPrinting={sellRequest.printingId} initialSellType={sellRequest.type}/></Suspense>}
    {data&&accountRequest&&<Suspense fallback={null}><MarketAccountDialog key={accountRequest.key} panel={accountRequest.panel} onOpenChange={open=>{if(!open)setAccountRequest(null)}} onPanelChange={panel=>setAccountRequest(current=>current?{...current,panel}:null)} locale={locale} account={data} activityCounts={{listings:0,offers:0,orders:0}} onCreateListing={()=>{setAccountRequest(null);window.dispatchEvent(new CustomEvent('vivreplay:open-sell-listing',{detail:'WTS'}))}} initialOrderId={accountRequest.orderId} initialConversationId={accountRequest.conversationId} initialProfileTab={accountRequest.profileTab} onRefresh={refresh} onSaved={async()=>{await refresh();setAccountRequest(null)}}/></Suspense>}
  </>;
}
