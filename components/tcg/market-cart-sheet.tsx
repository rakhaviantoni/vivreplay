'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useLocalizedRouter as useRouter} from '@/lib/use-localized-router';
import {ArrowRightIcon as ArrowRight,MinusIcon as Minus,PlusIcon as Plus,ShoppingCartIcon as Cart,TrashIcon as Trash} from '@phosphor-icons/react';
import {formatMoney} from '@/packages/domain';
import type {Card} from '@/packages/card-data/catalog';
import {Sheet,SheetContent,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {CardArt} from '@/components/tcg/card-art';

type CartStored={lines:{listingId:string;listingTitle?:string;items:{printingId:string;quantity:number}[]}[]};
type CartPreview={id:string;sellerGroupId:string;title:string;seller:string;currency:string;items:{printingId:string;name:string;code:string;quantity:number;unitAmount:number;condition:string;imageUrl?:string|null;assetPath?:string|null;setCode?:string|null;language?:string|null;printingCode?:string|null;variant?:string;photoUrls?:string[]}[];subtotal:number};
const CART_KEY='vivreplay-market-cart-v1';
const emptyCart:CartStored={lines:[]};

function readCart():CartStored{
  try{const value=JSON.parse(window.localStorage.getItem(CART_KEY)||'null') as {lines?:unknown}|null;const lines=Array.isArray(value?.lines)?value.lines.filter((line):line is {listingId:string;listingTitle?:string;items:{printingId:string;quantity:number}[]}=>Boolean(line&&typeof line==='object'&&typeof (line as {listingId?:unknown}).listingId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String((line as {listingId:string}).listingId))&&Array.isArray((line as {items?:unknown}).items))).slice(0,10).map(line=>({listingId:line.listingId,listingTitle:typeof line.listingTitle==='string'?line.listingTitle:'',items:line.items.filter(item=>typeof item?.printingId==='string'&&Number.isInteger(item.quantity)&&item.quantity>0&&item.quantity<=99).map(item=>({printingId:item.printingId,quantity:item.quantity}))})).filter(line=>line.items.length):[];const clean={lines};if(JSON.stringify(value)!==JSON.stringify(clean))window.localStorage.setItem(CART_KEY,JSON.stringify(clean));return clean}catch{return emptyCart}
}

export function MarketCartSheet({locale='EN'}:{locale:'EN'|'ID'}){
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [cart,setCart]=useState<CartStored>(emptyCart);
  const [listings,setListings]=useState<CartPreview[]>([]);
  const [selectedSellerGroupId,setSelectedSellerGroupId]=useState('');
  const [unavailableIds,setUnavailableIds]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const openState=useRef(false);
  const isId=locale==='ID';
  const cardCount=cart.lines.reduce((total,line)=>total+line.items.reduce((sum,item)=>sum+item.quantity,0),0);
  const subtotal=useMemo(()=>cart.lines.reduce((sum,line)=>{
    if(selectedSellerGroupId&&listings.find(item=>item.id===line.listingId)?.sellerGroupId!==selectedSellerGroupId)return sum;
    const listing=listings.find(item=>item.id===line.listingId);
    return sum+line.items.reduce((lineSum,selected)=>lineSum+(listing?.items.find(item=>item.printingId===selected.printingId)?.unitAmount??0)*selected.quantity,0);
  },0),[cart.lines,listings,selectedSellerGroupId]);
  const sellerGroups=useMemo(()=>{
    const groups=new Map<string,{id:string;name:string;lines:CartStored['lines']}>();
    for(const line of cart.lines){const listing=listings.find(item=>item.id===line.listingId);const groupId=listing?.sellerGroupId??`unavailable:${line.listingId}`;const group=groups.get(groupId)??{id:groupId,name:listing?.seller??(isId?'Penjual tidak tersedia':'Seller unavailable'),lines:[]};group.lines.push(line);groups.set(groupId,group)}
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
      const groups=new Map((data.listings??[]).map(listing=>[listing.sellerGroupId,listing.sellerGroupId]));
      setSelectedSellerGroupId(current=>current&&groups.has(current)?current:[...groups.keys()][0]??'');
    }catch(reason){setListings([]);setError(reason instanceof Error?reason.message:'Cart details could not be loaded.');}
    finally{setLoading(false);}
  },[]);

  const changeOpen=useCallback((next:boolean)=>{
    if(openState.current===next)return;
    openState.current=next;
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
    const next={lines};
    setCart(next);window.localStorage.setItem(CART_KEY,JSON.stringify(next));window.dispatchEvent(new Event('vivreplay:market-cart-updated'));
    setListings(current=>current.filter(listing=>listing.id!==listingId));setUnavailableIds(current=>current.filter(id=>id!==listingId));
  };
  const updateQuantity=(listingId:string,printingId:string,quantity:number)=>{
    const available=listings.find(listing=>listing.id===listingId)?.items.find(item=>item.printingId===printingId)?.quantity??0;
    const nextQuantity=Math.max(0,Math.min(available,99,quantity));
    const lines=cart.lines.map(line=>line.listingId===listingId?{...line,items:line.items.map(item=>item.printingId===printingId?{...item,quantity:nextQuantity}:item).filter(item=>item.quantity>0)}:line).filter(line=>line.items.length>0);
    const next={lines};
    setCart(next);window.localStorage.setItem(CART_KEY,JSON.stringify(next));window.dispatchEvent(new Event('vivreplay:market-cart-updated'));
  };
  const clearCart=()=>{if(!window.confirm(isId?'Kosongkan semua isi keranjang?':'Remove all items from your cart?'))return;window.localStorage.removeItem(CART_KEY);setCart(emptyCart);setListings([]);setUnavailableIds([]);window.dispatchEvent(new Event('vivreplay:market-cart-updated'))};
  const selectedLines=cart.lines.filter(line=>{const listing=listings.find(item=>item.id===line.listingId);return selectedSellerGroupId?listing?.sellerGroupId===selectedSellerGroupId:cart.lines.length===1});
  const continueToCheckout=()=>{if(!selectedSellerGroupId||selectedSellerGroupId.startsWith('unavailable:')||!selectedLines.length)return;changeOpen(false);const ids=selectedLines.map(line=>line.listingId);try{window.sessionStorage.setItem('vivreplay-market-checkout-listings-v1',JSON.stringify(ids));router.push('/checkout/market?cart=1')}catch{router.push(`/checkout/market?cart=1&listings=${encodeURIComponent(ids.join(','))}`)}};
  const selectedUnavailableIds=unavailableIds.filter(id=>selectedLines.some(line=>line.listingId===id));
  const unavailableSelection=selectedLines.some(line=>{const listing=listings.find(item=>item.id===line.listingId);return !listing||line.items.some(selected=>{const item=listing.items.find(candidate=>candidate.printingId===selected.printingId);return !item||selected.quantity>item.quantity})});
  const selectedListings=listings.filter(listing=>listing.sellerGroupId===selectedSellerGroupId);
  const mixedCurrencies=new Set(selectedListings.map(listing=>listing.currency)).size>1;
  const disabled=!selectedLines.length||loading||Boolean(error)||selectedUnavailableIds.length>0||unavailableSelection||mixedCurrencies;

  return <Sheet open={open} onOpenChange={changeOpen}>
    <button type="button" className="market-store-link market-cart-link" aria-label={isId?`Keranjang, ${cardCount} kartu`:`Cart, ${cardCount} ${cardCount===1?'card':'cards'}`} aria-expanded={open} onClick={()=>changeOpen(true)}><Cart size={17}/><span>{isId?'Keranjang':'Cart'}</span>{cardCount>0&&<b>{cardCount}</b>}</button>
    <SheetContent side="right" showCloseButton className="market-cart-sheet-content" style={{position:'fixed',inset:'0 0 0 auto',width:'min(440px, 100vw)',height:'100dvh',maxWidth:'none',maxHeight:'100dvh',boxSizing:'border-box',padding:0,gap:0,borderRadius:'16px 0 0 16px',overflow:'hidden'}}>
      <SheetHeader className="market-cart-sheet-header"><SheetTitle>{isId?'Keranjang':'Your cart'}</SheetTitle></SheetHeader>
      <div className="market-cart-sheet-body">
        {loading?<div className="market-cart-sheet-loading" role="status">{isId?'Memuat keranjang…':'Loading cart…'}</div>:error?<div className="market-cart-sheet-empty"><Cart size={24}/><p>{error}</p><button type="button" className="button secondary" onClick={()=>void sync()}>{isId?'Coba lagi':'Try again'}</button></div>:!cart.lines.length?<div className="market-cart-sheet-empty"><Cart size={24}/><strong>{isId?'Keranjang masih kosong':'Your cart is empty'}</strong><p>{isId?'Lihat listing untuk menambahkan kartu.':'Browse listings to add cards.'}</p></div>:<>
          {(unavailableIds.length>0||unavailableSelection||mixedCurrencies)&&<div className="market-cart-sheet-notice" role="status">{mixedCurrencies?(isId?'Pilih listing dengan mata uang yang sama.':'Cart listings must use the same currency.'):isId?'Beberapa kartu atau listing sudah tidak tersedia. Hapus sebelum checkout.':'Some cards or listings are no longer available. Remove them to continue.'}</div>}
          {sellerGroups.map(group=><section className="market-cart-sheet-seller-group" key={group.id}>
          <h3>{isId?'Penjual':'Seller'}: {group.name}{group.id===selectedSellerGroupId&&<span>{isId?'Checkout ini':'Selected for checkout'}</span>}</h3>
          {group.lines.map(line=>{
            const listing=listings.find(item=>item.id===line.listingId);
            const selectedItems=line.items.map(selected=>{
              const item=listing?.items.find(candidate=>candidate.printingId===selected.printingId);
              return item?{...item,availableQuantity:item.quantity,quantity:selected.quantity,unavailable:false}:{printingId:selected.printingId,name:selected.printingId,code:selected.printingId,quantity:selected.quantity,availableQuantity:0,unitAmount:0,condition:'',unavailable:true};
            });
            const listingItems=listing?.items??[];
            const listingCardCount=listingItems.reduce((total,item)=>total+item.quantity,0);
            const visibleStack=listingItems.flatMap(item=>Array.from({length:Math.max(1,Math.min(3,item.quantity))},(_,copyIndex)=>({item,copyIndex}))).slice(0,3);
            return <article className={`market-cart-sheet-listing${!listing?' is-unavailable':''}`} key={line.listingId}>
              <div className="market-cart-sheet-listing-top">
                {listing&&<div className={`market-feed-stack market-cart-sheet-preview-stack${listingCardCount===1?' is-single':''}`} style={{'--stack-last-index':Math.max(0,visibleStack.length-1)} as React.CSSProperties}>
                  {visibleStack.map(({item,copyIndex},index)=>{const card:Card={id:item.printingId,code:item.code,name:item.name,color:'Red',type:'Character',cost:0,power:0,rarity:'',art:index,effect:'',imageUrl:item.imageUrl??undefined,imageSource:'external',setCode:item.setCode??undefined,language:item.language??'EN',printingCode:item.printingCode??item.code,assetPath:item.assetPath??undefined};return <div key={`${item.printingId}-${copyIndex}`} className="market-feed-art" style={{'--stack-index':index} as React.CSSProperties}>{item.photoUrls?.[0]?<img className="market-sealed-listing-photo" src={item.photoUrls[0]} alt={item.name} loading="lazy"/>:<CardArt card={card}/>}</div>})}
                  {listingCardCount>1&&<span className="market-feed-quantity" aria-label={`${listingCardCount} ${isId?'kartu':'cards'}`}>{listingCardCount}</span>}
                </div>}
                <header className="market-cart-sheet-listing-header"><div><strong>{listing?.title??line.listingTitle??(isId?'Listing tidak tersedia':'Listing unavailable')}</strong></div><button type="button" className="market-cart-sheet-remove" onClick={()=>removeListing(line.listingId)} aria-label={isId?'Hapus listing dari keranjang':'Remove listing from cart'}><Trash size={16}/></button></header>
              </div>
              {listing?selectedItems.map(item=><div className="market-cart-sheet-item" key={item.printingId}><div className="market-cart-sheet-item-copy"><strong>{item.name}</strong><small>{item.code}{item.condition?` | ${item.condition==='SEALED'?(isId?'Segel pabrik':'Factory sealed'):item.condition}`:''}</small><span className="market-cart-sheet-quantity"><button type="button" aria-label={isId?'Kurangi jumlah':'Decrease quantity'} disabled={item.unavailable||item.quantity<=0} onClick={()=>updateQuantity(line.listingId,item.printingId,item.quantity-1)}><Minus size={14}/></button><b>{item.quantity}</b><button type="button" aria-label={isId?'Tambah jumlah':'Increase quantity'} disabled={item.unavailable||item.quantity>=item.availableQuantity||item.quantity>=99} onClick={()=>updateQuantity(line.listingId,item.printingId,item.quantity+1)}><Plus size={14}/></button><small>{isId?`dari ${item.availableQuantity}`:`of ${item.availableQuantity} available`}</small></span></div><b className="market-cart-sheet-item-price">{item.unavailable?'—':formatMoney(item.unitAmount*item.quantity,listing.currency)}</b></div>):<p className="market-cart-sheet-unavailable">{isId?'Listing ini perlu dihapus sebelum checkout.':'Remove this listing before checkout.'}</p>}
            </article>
          })}
          </section>)}
        </>}
      </div>
      {cart.lines.length>0&&<footer className="market-cart-sheet-footer">
        {sellerGroups.length>1&&<label className="market-cart-sheet-seller-select"><span>{isId?'Checkout dari':'Check out with'}</span><select value={selectedSellerGroupId} onChange={event=>setSelectedSellerGroupId(event.target.value)}>{sellerGroups.filter(group=>!group.id.startsWith('unavailable:')).map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
        {cart.lines.length>0&&<div className="market-cart-sheet-subtotal"><span>{isId?'Subtotal kartu':'Cards subtotal'}</span><strong>{selectedListings.length?formatMoney(subtotal,selectedListings[0].currency):'—'}</strong></div>}
        <button type="button" className="button market-cart-sheet-checkout" disabled={disabled||!selectedSellerGroupId||selectedSellerGroupId.startsWith('unavailable:')} onClick={continueToCheckout}>{isId?'Lanjutkan checkout':'Continue to checkout'}<ArrowRight size={17}/></button>
        <button type="button" className="market-cart-sheet-clear" onClick={clearCart}>{isId?'Kosongkan keranjang':'Clear cart'}</button>
      </footer>}
    </SheetContent>
  </Sheet>;
}
