'use client';

import {useEffect} from 'react';

export type FeedbackRequest={
  initialCategory?:string;
  cardCode?:string;
  printingId?:string;
  listingId?:string;
  sourcePath?:string;
};

export function openFeedback(request:FeedbackRequest={}){
  if(typeof window==='undefined')return;
  window.dispatchEvent(new CustomEvent<FeedbackRequest>('vivreplay:open-feedback',{detail:{...request,sourcePath:request.sourcePath??`${window.location.pathname}${window.location.search}`}}));
}

export function FeedbackLaunchButton({request,className,children,disabled=false}:{request?:FeedbackRequest;className?:string;children:React.ReactNode;disabled?:boolean}){
  return <button type="button" className={className} disabled={disabled} onClick={()=>openFeedback(request)}>{children}</button>;
}

export function FeedbackPageAutoOpen({request}:{request:FeedbackRequest}){
  const {initialCategory,cardCode,printingId,listingId,sourcePath}=request;
  useEffect(()=>{openFeedback({initialCategory,cardCode,printingId,listingId,sourcePath})},[initialCategory,cardCode,printingId,listingId,sourcePath]);
  return null;
}
