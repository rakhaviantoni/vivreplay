'use client';

import {useEffect,useState} from 'react';
import {DEFAULT_LISTING_BUNDLE_LIMITS,type ListingBundleLimits} from '@/lib/market/listing-limits';
import {LISTING_POLICIES} from '@/lib/market/policy';

const FREE_LIMITS:ListingBundleLimits={
  maxListingCopies:LISTING_POLICIES.free.maxListingCopies,
  maxCopiesPerCard:LISTING_POLICIES.free.maxCopiesPerCard,
  maxCardTypes:LISTING_POLICIES.free.maxCardTypes,
};

export function useMarketListingLimits(refreshKey?:string){
  const [limits,setLimits]=useState<ListingBundleLimits>(FREE_LIMITS);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch('/api/market/listing-policy',{cache:'no-store',signal:controller.signal})
      .then(response=>response.ok?response.json():null)
      .then((data:unknown)=>{
        const response=data as {current?:Partial<ListingBundleLimits>}|null;
        const value=response?.current;
        if(value&&Number.isInteger(value.maxListingCopies)&&Number.isInteger(value.maxCopiesPerCard)&&Number.isInteger(value.maxCardTypes)){
          setLimits({maxListingCopies:Number(value.maxListingCopies),maxCopiesPerCard:Number(value.maxCopiesPerCard),maxCardTypes:Number(value.maxCardTypes)});
        }
      }).catch(()=>undefined);
    return()=>controller.abort();
  },[refreshKey]);
  return limits;
}

export const FALLBACK_MARKET_LISTING_LIMITS=DEFAULT_LISTING_BUNDLE_LIMITS;
