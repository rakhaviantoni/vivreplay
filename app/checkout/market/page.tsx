import {Suspense} from 'react';
import type {Metadata} from 'next';
import {MarketCheckout} from '@/components/tcg/market-checkout';

export const metadata:Metadata={title:'Market checkout',robots:{index:false,follow:false}};

export default function MarketCheckoutPage(){
  return <Suspense fallback={<main className="page vivre-checkout-page"><div className="checkout-loading"><i/><span>Loading checkout…</span></div></main>}><MarketCheckout/></Suspense>;
}
