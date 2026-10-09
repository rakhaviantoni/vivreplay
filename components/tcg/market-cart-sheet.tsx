'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowRightIcon as ArrowRight,MinusIcon as Minus,PlusIcon as Plus,ShoppingCartIcon as Cart,TrashIcon as Trash} from '@phosphor-icons/react';
import {formatMoney} from '@/packages/domain';
import {Sheet,SheetContent,SheetHeader,SheetTitle} from '@/components/ui/sheet';

type CartStored={sellerId:string;lines:{listingId:string;listingTitle?:string;items:{printingId:string;quantity:number}[]}[]};
type CartPreview={id:string;sellerId:string;title:string;seller:string;currency:string;items:{printingId:string;name:string;code:string;quantity:number;unitAmount:number;condition:string}[];subtotal:number};
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
  const [selectedSellerId,setSelectedSellerId]=useState('');
  const [unavailableIds,setUnavailableIds]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const isId=locale==='ID';
  const cardCount=cart.lines.reduce((total,line)=>total+line.items.reduce((sum,item)=>sum+item.quantity,0),0);
  const subtotal=useMemo(()=>cart.lines.reduce((sum,line)=>{
    if(selectedSellerId&&listings.find(item=>item.id===line.listingId)?.sellerId!==selectedSellerId)return sum;
    const listing=listings.find(item=>item.id===line.listingId);
    return sum+line.items.reduce((lineSum,selected)=>lineSum+(listing?.items.find(item=>item.printingId===selected.printingId)?.unitAmount??0)*selected.quantity,0);
  },0),[cart.lines,listings,selectedSellerId]);
  const sellerGroups=useMemo(()=>{
    const groups=new Map<string,{id:string;name:string;lines:CartStored['lines']}>();
    for(const line of cart.lines){const listing=listings.find(item=>item.id===line.listingId);const sellerId=listing?.sellerId??`unavailable:${line.listingId}`;const group=groups.get(sellerId)??{id:sellerId,name:listing?.seller??(isId?'Penjual tidak tersedia':'Seller unavailable'),lines:[]};group.lines.push(line);groups.set(sellerId,group)}
    return [...groups.values()];
  },[cart.lines,listings,isId]);

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
      const groups=new Map((data.listings??[]).map(listing=>[listing.sellerId,listing.sellerId]));
      setSelectedSellerId(current=>current&&groups.has(current)?current:[...groups.keys()][0]??'');
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
    const lines=cart.lines.filter(line=>line.listingId!==listingId);
    const next={...cart,lines,sellerId:lines.length?cart.sellerId:''};
    setCart(next);window.localStorage.setItem(CART_KEY,JSON.stringify(next));window.dispatchEvent(new Event('vivreplay:market-cart-updated'));
    setListings(current=>current.filter(listing=>listing.id!==listingId));setUnavailableIds(current=>current.filter(id=>id!==listingId));
  };
  const updateQuantity=(listingId:string,printingId:string,quantity:number)=>{
    const available=listings.find(listing=>listing.id===listingId)?.items.find(item=>item.printingId===printingId)?.quantity??0;
    const nextQuantity=Math.max(0,Math.min(available,99,quantity));
    const lines=cart.lines.map(line=>line.listingId===listingId?{...line,items:line.items.map(item=>item.printingId===printingId?{...item,quantity:nextQuantity}:item).filter(item=>item.quantity>0)}:line).filter(line=>line.items.length>0);
    const next={...cart,lines,sellerId:lines.length?cart.sellerId:''};
    setCart(next);window.localStorage.setItem(CART_KEY,JSON.stringify(next));window.dispatchEvent(new Event('vivreplay:market-cart-updated'));
  };
  const clearCart=()=>{window.localStorage.removeItem(CART_KEY);setCart(emptyCart);setListings([]);setUnavailableIds([]);window.dispatchEvent(new Event('vivreplay:market-cart-updated'))};
  const continueToCheckout=()=>{if(!selectedSellerId||selectedSellerId.startsWith('unavailable:'))return;setOpen(false);router.push(`/checkout/market?cart=1&seller=${encodeURIComponent(selectedSellerId)}`)};
  const selectedLines=cart.lines.filter(line=>{const listing=listings.find(item=>item.id===line.listingId);return selectedSellerId?listing?.sellerId===selectedSellerId:cart.lines.length===1});
  const selectedUnavailableIds=unavailableIds.filter(id=>selectedLines.some(line=>line.listingId===id));
  const unavailableSelection=selectedLines.some(line=>{const listing=listings.find(item=>item.id===line.listingId);return !listing||line.items.some(selected=>{const item=listing.items.find(candidate=>candidate.printingId===selected.printingId);return !item||selected.quantity>item.quantity})});
  const selectedListings=listings.filter(listing=>listing.sellerId===selectedSellerId);
  const mixedCurrencies=new Set(selectedListings.map(listing=>listing.currency)).size>1;
  const disabled=!selectedLines.length||loading||Boolean(error)||selectedUnavailableIds.length>0||unavailableSelection||mixedCurrencies;

  return <Sheet open={open} onOpenChange={changeOpen}>
    <button type="button" className="market-store-link market-cart-link" aria-label={isId?`Keranjang, ${cardCount} kartu`:`Cart, ${cardCount} cards`} aria-expanded={open} onClick={()=>changeOpen(true)}><Cart size={17}/><span>{isId?'Keranjang':'Cart'}</span>{cardCount>0&&<b>{cardCount}</b>}</button>
    <SheetContent side="right" showCloseButton className="market-cart-sheet-content" style={{position:'fixed',inset:'0 0 0 auto',width:'min(440px, 100vw)',height:'100dvh',maxWidth:'none',maxHeight:'100dvh',boxSizing:'border-box',padding:0,gap:0,borderRadius:'16px 0 0 16px',overflow:'hidden'}}>
      <SheetHeader className="market-cart-sheet-header"><SheetTitle>{isId?'Keranjang':'Your cart'}</SheetTitle></SheetHeader>
      <div className="market-cart-sheet-body">
        {loading?<div className="market-cart-sheet-loading" role="status">{isId?'Memuat keranjang…':'Loading cart…'}</div>:error?<div className="market-cart-sheet-empty"><Cart size={24}/><p>{error}</p><button type="button" className="button secondary" onClick={()=>void sync()}>{isId?'Coba lagi':'Try again'}</button></div>:!cart.lines.length?<div className="market-cart-sheet-empty"><Cart size={24}/><strong>{isId?'Keranjang masih kosong':'Your cart is empty'}</strong><p>{isId?'Lihat listing untuk menambahkan kartu.':'Browse listings to add cards.'}</p></div>:<>
          {(unavailableIds.length>0||unavailableSelection||mixedCurrencies)&&<div className="market-cart-sheet-notice" role="status">{mixedCurrencies?(isId?'Pilih listing dengan mata uang yang sama.':'Cart listings must use the same currency.'):isId?'Beberapa kartu atau listing sudah tidak tersedia. Hapus sebelum checkout.':'Some cards or listings are no longer available. Remove them to continue.'}</div>}
          {sellerGroups.map(group=><section className="market-cart-sheet-seller-group" key={group.id}>
          <h3>{isId?'Penjual':'Seller'}: {group.name}{group.id===selectedSellerId&&<span>{isId?'Checkout ini':'Selected for checkout'}</span>}</h3>
          {group.lines.map(line=>{
            const listing=listings.find(item=>item.id===line.listingId);
            const selectedItems=line.items.map(selected=>{
              const item=listing?.items.find(candidate=>candidate.printingId===selected.printingId);
              return item?{...item,availableQuantity:item.quantity,quantity:selected.quantity,unavailable:false}:{printingId:selected.printingId,name:selected.printingId,code:selected.printingId,quantity:selected.quantity,availableQuantity:0,unitAmount:0,condition:'',unavailable:true};
            });
            return <article className={`market-cart-sheet-listing${!listing?' is-unavailable':''}`} key={line.listingId}>
              <header><div><strong>{listing?.title??line.listingTitle??(isId?'Listing tidak tersedia':'Listing unavailable')}</strong><small>{listing?.seller??''}</small></div><button type="button" className="market-cart-sheet-remove" onClick={()=>removeListing(line.listingId)} aria-label={isId?'Hapus listing dari keranjang':'Remove listing from cart'}><Trash size={16}/></button></header>
              {listing?selectedItems.map(item=><div className="market-cart-sheet-item" key={item.printingId}><div><strong>{item.name}</strong><small>{item.code}{item.condition?` · ${item.condition}`:''}</small><span className="market-cart-sheet-quantity"><button type="button" aria-label={isId?'Kurangi jumlah':'Decrease quantity'} disabled={item.unavailable||item.quantity<=0} onClick={()=>updateQuantity(line.listingId,item.printingId,item.quantity-1)}><Minus size={14}/></button><b>{item.quantity}</b><button type="button" aria-label={isId?'Tambah jumlah':'Increase quantity'} disabled={item.unavailable||item.quantity>=item.availableQuantity||item.quantity>=99} onClick={()=>updateQuantity(line.listingId,item.printingId,item.quantity+1)}><Plus size={14}/></button><small>{isId?`dari ${item.availableQuantity}`:`of ${item.availableQuantity} available`}</small></span></div><b>{item.unavailable?'—':formatMoney(item.unitAmount*item.quantity,listing.currency)}</b></div>):<p className="market-cart-sheet-unavailable">{isId?'Listing ini perlu dihapus sebelum checkout.':'Remove this listing before checkout.'}</p>}
            </article>
          })}
          </section>)}
        </>}
      </div>
      {cart.lines.length>0&&<footer className="market-cart-sheet-footer">
        {sellerGroups.length>1&&<label className="market-cart-sheet-seller-select"><span>{isId?'Checkout dari':'Check out with'}</span><select value={selectedSellerId} onChange={event=>setSelectedSellerId(event.target.value)}>{sellerGroups.filter(group=>!group.id.startsWith('unavailable:')).map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
        {cart.lines.length>0&&<div className="market-cart-sheet-subtotal"><span>{isId?'Subtotal kartu':'Cards subtotal'}</span><strong>{selectedListings.length?formatMoney(subtotal,selectedListings[0].currency):'—'}</strong></div>}
        <button type="button" className="button market-cart-sheet-checkout" disabled={disabled||!selectedSellerId||selectedSellerId.startsWith('unavailable:')} onClick={continueToCheckout}>{isId?'Lanjutkan checkout':'Continue to checkout'}<ArrowRight size={17}/></button>
        <button type="button" className="market-cart-sheet-clear" onClick={clearCart}>{isId?'Kosongkan keranjang':'Clear cart'}</button>
      </footer>}
    </SheetContent>
  </Sheet>;
}
