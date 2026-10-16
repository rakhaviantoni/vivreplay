'use client';

import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {XIcon as Close,CheckIcon as Check,StorefrontIcon as Store} from '@phosphor-icons/react';
import {toast} from 'sonner';
import type {VaultStackGroup} from '../types';
import {CardArt} from '../../card-art';
import {MarketPriceMode} from '../../market-price-mode';
import {ShareButton,type ShareCardItem} from '../../share';
import {marketListingPath} from '@/lib/market/listing-url';

const countLabel=(count:number,singular:string,plural:string)=>`${count} ${count===1?singular:plural}`;

export function BulkListingModal({open,onClose,stacks,onPublished,language}:{open:boolean;onClose:(wasPublished?:boolean)=>void;stacks:VaultStackGroup[];onPublished:()=>Promise<void>|void;language:'EN'|'ID'}){
  const id=language==='ID';
  const [quantities,setQuantities]=useState<Record<string,number>>({});
  const [prices,setPrices]=useState<Record<string,string>>({});
  const [cardSearch,setCardSearch]=useState('');
  const [choiceLimit,setChoiceLimit]=useState(40);
  const [title,setTitle]=useState('');
  const [city,setCity]=useState('');
  const [originLoaded,setOriginLoaded]=useState(false);
  const [negotiable,setNegotiable]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [published,setPublished]=useState<{id:string;title:string;amount:number;cards:ShareCardItem[];city?:string;expiresAt?:string}|null>(null);
  const choices=useMemo(()=>stacks.filter(stack=>stack.item.type==='RAW'&&stack.items.some(copy=>copy.quantity-(copy.listedQuantity??0)>0)),[stacks]);
  const filteredChoices=useMemo(()=>{const query=cardSearch.trim().toLowerCase();if(!query)return choices;return choices.filter(stack=>[stack.item.card.name,stack.item.card.code,stack.item.card.setCode,stack.printingLabel].some(value=>String(value??'').toLowerCase().includes(query)))},[choices,cardSearch]);
  const visibleChoices=filteredChoices.slice(0,choiceLimit);
  const lineQuantity=(stack:VaultStackGroup)=>stack.items.reduce((sum,copy)=>sum+Math.max(0,copy.quantity-(copy.listedQuantity??0)),0);
  const selectedQuantity=(stack:VaultStackGroup)=>Math.min(lineQuantity(stack),quantities[stack.item.id]??0);
  const allocation=(stack:VaultStackGroup)=>{let remaining=selectedQuantity(stack);return stack.items.flatMap(copy=>{const amount=Math.min(Math.max(0,copy.quantity-(copy.listedQuantity??0)),remaining);remaining-=amount;return amount>0?[{copy,quantity:amount}]:[]})};
  const chosen=choices.filter(stack=>selectedQuantity(stack)>0);
  const quantity=chosen.reduce((sum,stack)=>sum+selectedQuantity(stack),0);
  const totalAmount=chosen.reduce((sum,stack)=>sum+(Number(prices[stack.item.id])||0)*selectedQuantity(stack),0);
  const bundleEntryCount=chosen.reduce((sum,stack)=>sum+allocation(stack).length,0);
  useEffect(()=>{if(!open)return;setQuantities({});setPrices({});setCardSearch('');setChoiceLimit(40);setTitle('');setCity('');setOriginLoaded(false);setNegotiable(true);setError('');setPublished(null);let active=true;void fetch('/api/shipping/origin',{cache:'no-store'}).then(response=>response.json() as Promise<{origin?:{city?:string}|null}>).then(data=>{if(active)setCity(data.origin?.city?.trim()??'')}).catch(()=>{}).finally(()=>{if(active)setOriginLoaded(true)});return()=>{active=false}},[open]);
  useEffect(()=>{if(!open&&!published)return;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy){const wasPublished=Boolean(published);setPublished(null);onClose(wasPublished)}};document.addEventListener('keydown',onKeyDown);return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKeyDown)}},[open,published,busy,onClose]);
  if((!open&&!published)||typeof document==='undefined')return null;
  const close=()=>{if(busy)return;const wasPublished=Boolean(published);setPublished(null);onClose(wasPublished)};
  const toggle=(stack:VaultStackGroup)=>{const isSelected=selectedQuantity(stack)>0;if(!isSelected&&!title)setTitle(stack.item.card.name);setQuantities(previous=>{const next={...previous};if(isSelected)delete next[stack.item.id];else next[stack.item.id]=1;return next});setPrices(previous=>({...previous,[stack.item.id]:previous[stack.item.id]??String(Math.round((stack.estimatedValue||0)/Math.max(1,stack.quantity))||'')}))};
  const setStackQuantity=(stack:VaultStackGroup,value:number)=>{const nextQuantity=Math.max(1,Math.min(lineQuantity(stack),Math.floor(value)||1));setQuantities(previous=>({...previous,[stack.item.id]:nextQuantity}))};
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy)return;setError('');
    if(!chosen.length){setError(id?'Pilih minimal satu kartu.':'Select at least one card.');return}
    if(bundleEntryCount>30||quantity>999){setError(id?'Listing bundle maksimal 30 jenis kartu dan 999 kartu.':'A bundle can contain up to 30 card entries and 999 cards.');return}
    if(!title.trim()||title.trim().length<3){setError(id?'Judul listing minimal 3 karakter.':'Enter a listing title with at least 3 characters.');return}
    if(!city.trim()||city.trim().length<2){setError(id?'Masukkan kota asal.':'Enter your shipping origin city.');return}
    if(chosen.some(stack=>!Number.isSafeInteger(Number(prices[stack.item.id]))||Number(prices[stack.item.id])<=0)){setError(id?'Masukkan harga per kartu untuk setiap pilihan.':'Enter a per-card price for every selected line.');return}
    if(!Number.isSafeInteger(totalAmount)||totalAmount<=0){setError(id?'Total harga listing tidak valid.':'The listing total is invalid.');return}
    setBusy(true);
    try{
      const bundle=chosen.flatMap(stack=>allocation(stack).map(({copy,quantity:copyQuantity})=>({instanceId:copy.id,printingId:copy.printingId,quantity:copyQuantity,condition:copy.condition,unitAmount:Number(prices[stack.item.id])})));
      const response=await fetch('/api/listings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({instanceId:bundle[0].instanceId,title:title.trim(),amount:totalAmount,quantity,city:city.trim(),type:'WTS',negotiable,items:bundle})});
      const result=await response.json() as {error?:string;id?:string;expiresAt?:string};if(!response.ok)throw new Error(result.error||'Listing could not be published.');if(!result.id)throw new Error(id?'Listing berhasil dibuat, tetapi tautannya tidak tersedia. Muat ulang koleksi Anda.':'Listing was created, but its link is missing. Refresh your Vault.');
      setPublished({id:result.id,title:title.trim(),amount:totalAmount,cards:chosen.map(stack=>({card:stack.item.card,quantity:selectedQuantity(stack),condition:stack.items[0]?.condition,unitAmount:Number(prices[stack.item.id])})),city:city.trim(),expiresAt:result.expiresAt});toast.success(id?'Listing berhasil dipublikasikan':'Listing published');
      try{await onPublished()}catch{/* The listing is already published; keep the success state visible. */}
    }catch(cause){setError(cause instanceof Error?cause.message:'Listing could not be published.')}
    finally{setBusy(false)}
  };
  if(published){const totalCards=published.cards.reduce((sum,item)=>sum+(item.quantity??1),0);return <ShareButton title={published.title} path={marketListingPath(published.title,published.id)} cards={published.cards} subtitle={id?countLabel(totalCards,'kartu','kartu'):countLabel(totalCards,'card','cards')} listingInfo={{city:published.city,expiresAt:published.expiresAt}} price={`Rp ${published.amount.toLocaleString('id-ID')}`} openOnMount hideTrigger onOpenChange={isOpen=>{if(!isOpen)close()}}/>}
  return createPortal(<div className="vault-modal-overlay" role="presentation" onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="vault-bulk-listing-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-listing-title">
    <header><div><span className="vault-modal-eyebrow">MARKET</span><h2 id="bulk-listing-title">{id?'Buat satu listing bundle':'Create one bundle listing'}</h2><p>{id?'Pilih kartu koleksi yang tersedia untuk digabungkan dalam satu halaman listing.':'Select available Vault cards to publish together on one listing page.'}</p></div><button type="button" className="vault-icon-btn" onClick={close} disabled={busy} aria-label={id?'Tutup':'Close'}><Close size={20}/></button></header>
    <form onSubmit={submit}>
      <div className="vault-bulk-listing-search"><input type="search" value={cardSearch} onChange={event=>{setCardSearch(event.target.value);setChoiceLimit(40)}} placeholder={id?'Cari nama atau kode kartu':'Search by card name or code'} aria-label={id?'Cari kartu di Vault':'Search Vault cards'}/><span>{filteredChoices.length.toLocaleString(id?'id-ID':'en-US')} {id?'kartu':'cards'}</span></div>
      <div className="vault-bulk-listing-choices" role="group" aria-label={id?'Pilih kartu':'Select cards'}>{visibleChoices.map(stack=>{const available=lineQuantity(stack);const selected=selectedQuantity(stack);const checked=selected>0;return <div key={stack.item.id} className={`vault-bulk-listing-choice ${checked?'is-selected':''}`}><button type="button" className="vault-bulk-listing-select" aria-pressed={checked} onClick={()=>toggle(stack)}><span className="vault-bulk-listing-art"><CardArt card={stack.item.card} small/></span><span className="vault-bulk-listing-copy"><strong>{stack.item.card.name}</strong><small>{stack.item.card.code} / {stack.printingLabel} / {id?'tersedia':'available'} {available}</small></span><span className="vault-bulk-listing-check">{checked&&<Check size={14}/>}</span></button>{checked&&<div className="vault-bulk-listing-controls"><label className="vault-bulk-listing-price">{id?'Harga / kartu':'Price per card'}<input aria-label={`${id?'Harga per kartu':'Price per card'}: ${stack.item.card.name}`} value={prices[stack.item.id]??''} onChange={event=>setPrices(previous=>({...previous,[stack.item.id]:event.target.value.replace(/\D/g,'')}))} inputMode="numeric" placeholder="0"/></label><label className="vault-bulk-listing-quantity">{id?'Jumlah':'Quantity'}<input type="number" aria-label={`${id?'Jumlah':'Quantity'}: ${stack.item.card.name}`} min={1} max={available} step={1} value={selected} onChange={event=>setStackQuantity(stack,Number(event.target.value))}/><small>{id?`dari ${available}`:`of ${available}`}</small></label></div>}</div>})}{filteredChoices.length===0&&<p className="vault-bulk-empty">{choices.length===0?(id?'Tidak ada kartu mentah yang tersedia untuk dijual.':'No available raw cards to list for sale.'):(id?'Kartu tidak ditemukan.':'No matching cards.')}</p>}{visibleChoices.length<filteredChoices.length&&<button className="vault-bulk-listing-more" type="button" onClick={()=>setChoiceLimit(current=>current+40)}>{id?`Tampilkan ${Math.min(40,filteredChoices.length-visibleChoices.length)} kartu lagi`:`Show ${Math.min(40,filteredChoices.length-visibleChoices.length)} more cards`}</button>}</div>
      <div className="vault-bulk-listing-fields"><label>{id?'Judul listing':'Listing title'}<input value={title} onChange={event=>setTitle(event.target.value)} maxLength={100} placeholder={id?'Bundle kartu':'Card bundle'}/></label><label>{id?'Kota asal':'Origin city'}<input value={city} readOnly placeholder={originLoaded?(id?'Tambahkan alamat pengiriman':'Add a delivery address'):(id?'Memuat alamat…':'Loading address…')}/>{originLoaded&&!city&&<small><a href="/market?profile=delivery">{id?'Atur alamat pengiriman':'Set delivery address'}</a></small>}</label></div>
      <MarketPriceMode value={negotiable} onChange={setNegotiable} language={language}/>
      <div className="vault-bulk-listing-summary"><span>{id?`${countLabel(chosen.length,'jenis kartu','jenis kartu')}, ${countLabel(quantity,'kartu','kartu')}`:`${countLabel(chosen.length,'card type','card types')}, ${countLabel(quantity,'card','cards')}`}<small>{id?'Batas: 30 jenis kartu, 999 kartu':'Limit: 30 card types, 999 cards'}</small></span><strong>{id?'Total':'Listing total'}: Rp {totalAmount.toLocaleString('id-ID')}</strong></div>
{error&&<p className="vault-bulk-listing-error" role="alert">{error}</p>}
      <footer><button type="button" className="vault-btn vault-btn-secondary" onClick={close} disabled={busy}>{id?'Batal':'Cancel'}</button><button type="submit" className="vault-btn vault-btn-primary" disabled={busy||chosen.length===0||totalAmount<=0||bundleEntryCount>30||quantity>999}><Store size={16}/>{busy?(id?'Menerbitkan…':'Publishing…'):(id?`Terbitkan listing · Rp ${totalAmount.toLocaleString('id-ID')}`:`Publish listing · Rp ${totalAmount.toLocaleString('id-ID')}`)}</button></footer>
    </form>
  </section></div>,document.body);
}
