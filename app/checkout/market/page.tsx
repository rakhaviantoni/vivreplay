'use client';

import {Suspense} from 'react';
import {MarketCheckout} from '@/components/tcg/market-checkout';

export default function MarketCheckoutPage(){
  return <Suspense fallback={<main className="page vivre-checkout-page"><div className="checkout-loading"><i/><span>Loading checkout…</span></div></main>}><MarketCheckout/></Suspense>;
}
