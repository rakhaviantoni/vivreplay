'use client';

import {useEffect,useMemo,useState} from 'react';
import {XIcon as Close,CheckIcon as Check,StorefrontIcon as Store} from '@phosphor-icons/react';
import {toast} from 'sonner';
import type {VaultStackGroup} from '../types';
import {CardArt} from '../../card-art';
import {MarketPriceMode} from '../../market-price-mode';
import {ShareButton,type ShareCardItem} from '../../share';

export function BulkListingModal({open,onClose,stacks,onPublished,language}:{open:boolean;onClose:()=>void;stacks:VaultStackGroup[];onPublished:()=>Promise<void>|void;language:'EN'|'ID'}){
  const id=language==='ID';
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [prices,setPrices]=useState<Record<string,string>>({});
  const [title,setTitle]=useState('');
  const [city,setCity]=useState('');
  const [negotiable,setNegotiable]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [published,setPublished]=useState<{id:string;title:string;amount:number;cards:ShareCardItem[]}|null>(null);
  const choices=useMemo(()=>stacks.filter(stack=>stack.item.type==='RAW'&&stack.items.some(copy=>copy.quantity-(copy.listedQuantity??0)>0)),[stacks]);
  const chosen=choices.filter(stack=>selected.has(stack.item.id));
  const quantity=chosen.reduce((sum,stack)=>sum+stack.items.reduce((n,copy)=>n+Math.max(0,copy.quantity-(copy.listedQuantity??0)),0),0);
  const lineQuantity=(stack:VaultStackGroup)=>stack.items.reduce((sum,copy)=>sum+Math.max(0,copy.quantity-(copy.listedQuantity??0)),0);
  const totalAmount=chosen.reduce((sum,stack)=>sum+(Number(prices[stack.item.id])||0)*lineQuantity(stack),0);
  useEffect(()=>{if(!open)return;void fetch('/api/shipping/origin').then(response=>response.json() as Promise<{origin?:{city?:string}|null}>).then(data=>{if(data.origin?.city)setCity(data.origin.city)}).catch(()=>{})},[open]);
  if(!open&&!published)return null;
  const toggle=(stack:VaultStackGroup)=>{setSelected(previous=>{const next=new Set(previous);if(next.has(stack.item.id))next.delete(stack.item.id);else next.add(stack.item.id);if(!title&&next.size===1)setTitle(stack.item.card.name);return next});setPrices(previous=>({...previous,[stack.item.id]:previous[stack.item.id]??String(Math.round((stack.estimatedValue||0)/Math.max(1,stack.quantity))||'')}))};
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();setError('');
    if(!chosen.length){setError(id?'Pilih minimal satu kartu.':'Select at least one card.');return}
    if(!title.trim()||title.trim().length<3){setError(id?'Judul listing minimal 3 karakter.':'Enter a listing title with at least 3 characters.');return}
    if(!city.trim()||city.trim().length<2){setError(id?'Masukkan kota asal.':'Enter your shipping origin city.');return}
    if(chosen.some(stack=>!Number.isSafeInteger(Number(prices[stack.item.id]))||Number(prices[stack.item.id])<=0)){setError(id?'Masukkan harga per kartu untuk setiap pilihan.':'Enter a per-card price for every selected line.');return}
    if(!Number.isSafeInteger(totalAmount)||totalAmount<=0){setError(id?'Total harga listing tidak valid.':'The listing total is invalid.');return}
    setBusy(true);
    try{
      const bundle=chosen.flatMap(stack=>stack.items.filter(copy=>copy.quantity-(copy.listedQuantity??0)>0).map(copy=>({instanceId:copy.id,printingId:copy.printingId,quantity:copy.quantity-(copy.listedQuantity??0),condition:copy.condition,unitAmount:Number(prices[stack.item.id])})));
      const response=await fetch('/api/listings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({instanceId:bundle[0].instanceId,title:title.trim(),amount:totalAmount,quantity,city:city.trim(),type:'WTS',negotiable,items:bundle})});
      const result=await response.json() as {error?:string;id?:string};if(!response.ok)throw new Error(result.error||'Listing could not be published.');
      await onPublished();
      if(result.id){setPublished({id:result.id,title:title.trim(),amount:totalAmount,cards:chosen.map(stack=>({card:stack.item.card,quantity:lineQuantity(stack),condition:stack.items[0]?.condition,unitAmount:Number(prices[stack.item.id])}))});toast.success(id?'Listing berhasil dipublikasikan':'Listing published');}
    }catch(cause){setError(cause instanceof Error?cause.message:'Listing could not be published.')}
  };
  if(published)return <div className="vault-modal-overlay" role="presentation"><section className="vault-bulk-listing-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-listing-published-title"><header><div><span className="vault-modal-eyebrow">MARKET</span><h2 id="bulk-listing-published-title">{id?'Listing sudah tayang':'Your listing is live'}</h2><p>{id?'Bagikan listing agar kolektor lain dapat menemukannya.':'Share the listing so other collectors can find it.'}</p></div><button type="button" className="vault-icon-btn" onClick={()=>{setPublished(null);onClose()}} aria-label={id?'Tutup':'Close'}><Close size={20}/></button></header><div className="vault-bulk-listing-summary"><span>{published.title}</span><strong>Rp {published.amount.toLocaleString('id-ID')}</strong></div><div className="vault-bulk-listing-fields"><a className="vault-btn vault-btn-primary" href={`/market/${encodeURIComponent(published.id)}`}>{id?'Lihat listing':'View listing'}</a><button className="vault-btn vault-btn-secondary" type="button" onClick={()=>{setPublished(null);onClose()}}>{id?'Selesai':'Done'}</button></div><ShareButton title={published.title} path={`/market/${encodeURIComponent(published.id)}`} cards={published.cards} subtitle={id?`${published.cards.reduce((sum,item)=>sum+(item.quantity??1),0)} kartu`:`${published.cards.reduce((sum,item)=>sum+(item.quantity??1),0)} cards`} price={`Rp ${published.amount.toLocaleString('id-ID')}`} openOnMount hideTrigger/></section></div>;
  return <div className="vault-modal-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onClose()}}><section className="vault-bulk-listing-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-listing-title">
    <header><div><span className="vault-modal-eyebrow">{id?'MARKET':'MARKET'}</span><h2 id="bulk-listing-title">{id?'Buat satu listing bundle':'Create one bundle listing'}</h2><p>{id?'Pilih kartu koleksi yang tersedia untuk digabungkan dalam satu halaman listing.':'Select available Vault cards to publish together on one listing page.'}</p></div><button type="button" className="vault-icon-btn" onClick={onClose} disabled={busy} aria-label={id?'Tutup':'Close'}><Close size={20}/></button></header>
    <form onSubmit={submit}>
      <div className="vault-bulk-listing-choices" role="group" aria-label={id?'Pilih kartu':'Select cards'}>{choices.map(stack=>{const available=lineQuantity(stack);const checked=selected.has(stack.item.id);return <div key={stack.item.id} className={`vault-bulk-listing-choice ${checked?'is-selected':''}`}><button type="button" className="vault-bulk-listing-select" aria-pressed={checked} onClick={()=>toggle(stack)}><span className="vault-bulk-listing-art"><CardArt card={stack.item.card} small/></span><span className="vault-bulk-listing-copy"><strong>{stack.item.card.name}</strong><small>{stack.item.card.code} · {stack.printingLabel} · x{available}</small></span><span className="vault-bulk-listing-check">{checked&&<Check size={14}/>}</span></button>{checked&&<label className="vault-bulk-listing-price">{id?'Harga / kartu (IDR)':'Price per card (IDR)'}<input aria-label={`${id?'Harga per kartu':'Price per card'}: ${stack.item.card.name}`} value={prices[stack.item.id]??''} onChange={event=>setPrices(previous=>({...previous,[stack.item.id]:event.target.value.replace(/\D/g,'')}))} inputMode="numeric" placeholder="0"/></label>}</div>})}{choices.length===0&&<p className="vault-bulk-empty">{id?'Tidak ada kartu mentah yang tersedia untuk dijual.':'No available raw cards to list for sale.'}</p>}</div>
      <div className="vault-bulk-listing-fields"><label>{id?'Judul listing':'Listing title'}<input value={title} onChange={event=>setTitle(event.target.value)} maxLength={100} placeholder={id?'Bundle kartu':'Card bundle'}/></label><label>{id?'Kota asal':'Origin city'}<input value={city} onChange={event=>setCity(event.target.value)} maxLength={60} placeholder={id?'Jakarta':'Jakarta'}/></label></div>
      <MarketPriceMode value={negotiable} onChange={setNegotiable} language={language}/>
      <div className="vault-bulk-listing-summary"><span>{chosen.length} {id?'jenis kartu dipilih':'card types selected'} · {quantity} {id?'kartu':'cards'}</span><strong>{id?'Total':'Listing total'}: Rp {totalAmount.toLocaleString('id-ID')}</strong></div>
{error&&<p className="vault-bulk-listing-error" role="alert">{error}</p>}
      <footer><button type="button" className="vault-btn vault-btn-secondary" onClick={onClose} disabled={busy}>{id?'Batal':'Cancel'}</button><button type="submit" className="vault-btn vault-btn-primary" disabled={busy||chosen.length===0||totalAmount<=0}><Store size={16}/>{busy?(id?'Menerbitkan…':'Publishing…'):(id?`Terbitkan listing · Rp ${totalAmount.toLocaleString('id-ID')}`:`Publish listing · Rp ${totalAmount.toLocaleString('id-ID')}`)}</button></footer>
    </form>
  </section></div>;
}
