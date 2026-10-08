'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowRightIcon as ArrowRight,ShoppingCartIcon as Cart,TrashIcon as Trash} from '@phosphor-icons/react';
import {formatMoney} from '@/packages/domain';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from '@/components/ui/sheet';

type CartStored={sellerId:string;lines:{listingId:string;listingTitle?:string;items:{printingId:string;quantity:number}[]}[]};
type CartPreview={id:string;title:string;seller:string;currency:string;items:{printingId:string;name:string;code:string;quantity:number;unitAmount:number;condition:string}[];subtotal:number};
const CART_KEY='vivreplay-market-cart-v1';
const emptyCart:CartStored={sellerId:'',lines:[]};

function readCart():CartStored{
  try{const value=JSON.parse(window.localStorage.getItem(CART_KEY)||'null') as CartStored|null;return value&&Array.isArray(value.lines)?value:emptyCart}catch{return emptyCart}
}

export function MarketCartSheet({locale='EN'}:{locale:'EN'|'ID'}){
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [cart,setCart]=useState<CartStored>(emptyCart);
  const [listings,setListings]=useState<CartPreview[]>([]);
  const [unavailableIds,setUnavailableIds]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const isId=locale==='ID';
  const cardCount=cart.lines.reduce((total,line)=>total+line.items.reduce((sum,item)=>sum+item.quantity,0),0);
  const subtotal=useMemo(()=>cart.lines.reduce((sum,line)=>{
    const listing=listings.find(item=>item.id===line.listingId);
    return sum+line.items.reduce((lineSum,selected)=>lineSum+(listing?.items.find(item=>item.printingId===selected.printingId)?.unitAmount??0)*selected.quantity,0);
  },0),[cart.lines,listings]);

  const sync=useCallback(async()=>{
    const next=readCart();setCart(next);setError('');
    if(!next.lines.length){setListings([]);setUnavailableIds([]);return;}
    setLoading(true);
    try{
      const params=new URLSearchParams({ids:next.lines.map(line=>line.listingId).join(',')});
      const response=await fetch(`/api/market/cart-preview?${params}`,{cache:'no-store'});
      const data=await response.json() as {listings?:CartPreview[];unavailableIds?:string[];error?:string};
      if(!response.ok)throw new Error(data.error||'Cart details could not be loaded.');
      setListings(data.listings??[]);setUnavailableIds(data.unavailableIds??[]);
    }catch(reason){setListings([]);setError(reason instanceof Error?reason.message:'Cart details could not be loaded.');}
    finally{setLoading(false);}
  },[]);

  const changeOpen=useCallback((next:boolean)=>{
    setOpen(next);
    if(next)void sync();
  },[sync]);

  useEffect(()=>{
    const update=()=>setCart(readCart());
    const initialUpdate=window.setTimeout(update,0);
    const openCart=()=>changeOpen(true);
    window.addEventListener('vivreplay:market-cart-updated',update);
    window.addEventListener('storage',update);
    window.addEventListener('vivreplay:open-market-cart',openCart);
    return()=>{window.clearTimeout(initialUpdate);window.removeEventListener('vivreplay:market-cart-updated',update);window.removeEventListener('storage',update);window.removeEventListener('vivreplay:open-market-cart',openCart)};
  },[changeOpen]);

  const removeListing=(listingId:string)=>{
    const next={...cart,lines:cart.lines.filter(line=>line.listingId!==listingId)};
    setCart(next);window.localStorage.setItem(CART_KEY,JSON.stringify(next));window.dispatchEvent(new Event('vivreplay:market-cart-updated'));
    setListings(current=>current.filter(listing=>listing.id!==listingId));setUnavailableIds(current=>current.filter(id=>id!==listingId));
  };
  const clearCart=()=>{window.localStorage.removeItem(CART_KEY);setCart(emptyCart);setListings([]);setUnavailableIds([]);window.dispatchEvent(new Event('vivreplay:market-cart-updated'))};
  const continueToCheckout=()=>{setOpen(false);router.push('/checkout/market?cart=1')};
  const unavailableSelection=cart.lines.some(line=>{const listing=listings.find(item=>item.id===line.listingId);return !listing||line.items.some(selected=>!listing.items.some(item=>item.printingId===selected.printingId))});
  const mixedCurrencies=new Set(listings.map(listing=>listing.currency)).size>1;
  const disabled=!cart.lines.length||loading||Boolean(error)||unavailableIds.length>0||unavailableSelection||mixedCurrencies;

  return <Sheet open={open} onOpenChange={changeOpen}>
    <button type="button" className="market-store-link market-cart-link" aria-label={isId?`Keranjang, ${cardCount} kartu`:`Cart, ${cardCount} cards`} aria-expanded={open} onClick={()=>changeOpen(true)}><Cart size={17}/><span>{isId?'Keranjang':'Cart'}</span>{cardCount>0&&<b>{cardCount}</b>}</button>
    <SheetContent side="right" showCloseButton className="market-cart-sheet-content" style={{position:'fixed',inset:'0 0 0 auto',width:'min(440px, 100vw)',height:'100dvh',maxWidth:'none',maxHeight:'100dvh',boxSizing:'border-box',padding:0,gap:0,borderRadius:'16px 0 0 16px',overflow:'hidden'}}>
      <SheetHeader className="market-cart-sheet-header"><SheetTitle>{isId?'Keranjang':'Your cart'}</SheetTitle><SheetDescription>{isId?'Listing dari satu penjual':'Listings from one seller'}</SheetDescription></SheetHeader>
      <div className="market-cart-sheet-body">
        {loading?<div className="market-cart-sheet-loading" role="status">{isId?'Memuat keranjang…':'Loading cart…'}</div>:error?<div className="market-cart-sheet-empty"><Cart size={24}/><p>{error}</p><button type="button" className="button secondary" onClick={()=>void sync()}>{isId?'Coba lagi':'Try again'}</button></div>:!cart.lines.length?<div className="market-cart-sheet-empty"><Cart size={24}/><strong>{isId?'Keranjang masih kosong':'Your cart is empty'}</strong><p>{isId?'Tambahkan kartu dari listing untuk checkout bersama.':'Add cards from listings to check out together.'}</p></div>:<>
          {(unavailableIds.length>0||unavailableSelection||mixedCurrencies)&&<div className="market-cart-sheet-notice" role="status">{mixedCurrencies?(isId?'Pilih listing dengan mata uang yang sama.':'Cart listings must use the same currency.'):isId?'Beberapa kartu atau listing sudah tidak tersedia. Hapus sebelum checkout.':'Some cards or listings are no longer available. Remove them to continue.'}</div>}
          {cart.lines.map(line=>{
            const listing=listings.find(item=>item.id===line.listingId);
            const selectedItems=line.items.map(selected=>{
              const item=listing?.items.find(candidate=>candidate.printingId===selected.printingId);
              return item?{...item,quantity:selected.quantity,unavailable:false}:{printingId:selected.printingId,name:selected.printingId,code:selected.printingId,quantity:selected.quantity,unitAmount:0,condition:'',unavailable:true};
            });
            return <article className={`market-cart-sheet-listing${!listing?' is-unavailable':''}`} key={line.listingId}>
              <header><div><strong>{listing?.title??line.listingTitle??(isId?'Listing tidak tersedia':'Listing unavailable')}</strong><small>{listing?.seller??''}</small></div><button type="button" className="market-cart-sheet-remove" onClick={()=>removeListing(line.listingId)} aria-label={isId?'Hapus listing dari keranjang':'Remove listing from cart'}><Trash size={16}/></button></header>
              {listing?selectedItems.map(item=><div className="market-cart-sheet-item" key={item.printingId}><div><strong>{item.name} × {item.quantity}</strong><small>{item.code}{item.condition?` · ${item.condition}`:''}</small></div><b>{item.unavailable?'—':formatMoney(item.unitAmount*item.quantity,listing.currency)}</b></div>):<p className="market-cart-sheet-unavailable">{isId?'Listing ini perlu dihapus sebelum checkout.':'Remove this listing before checkout.'}</p>}
            </article>
          })}
        </>}
      </div>
      {cart.lines.length>0&&<footer className="market-cart-sheet-footer">
        {cart.lines.length>0&&<div className="market-cart-sheet-subtotal"><span>{isId?'Subtotal kartu':'Cards subtotal'}</span><strong>{listings.length?formatMoney(subtotal,listings[0].currency):'—'}</strong></div>}
        <button type="button" className="button market-cart-sheet-checkout" disabled={disabled} onClick={continueToCheckout}>{isId?'Lanjut ke checkout':'Continue to checkout'}<ArrowRight size={17}/></button>
        <button type="button" className="market-cart-sheet-clear" onClick={clearCart}>{isId?'Kosongkan keranjang':'Clear cart'}</button>
      </footer>}
    </SheetContent>
  </Sheet>;
}
