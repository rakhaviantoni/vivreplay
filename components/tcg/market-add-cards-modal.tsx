'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CheckIcon as Check,SpinnerGapIcon as Spinner,XIcon as Close} from '@phosphor-icons/react';
import {toast} from 'sonner';
import type {Card} from '@/packages/card-data/catalog';
import {CardArt} from './card-art';

type VaultChoice={id:string;printingId:string;type:'RAW'|'GRADED';quantity:number;condition:string;listedQuantity?:number;card?:Card;language?:string;variant?:string;printingCode?:string};
type ListingLine={instanceId?:string;printingId:string;quantity:number;condition?:string;unitAmount:number;card?:Card;language?:string};
type AddedCard=Omit<ListingLine,'condition'>&{id:string;condition:string;card:Card;language:string};

export function MarketAddCardsModal({open,listingId,listingItems,currency,language,onClose,onAdded}:{open:boolean;listingId:string;listingItems:ListingLine[];currency:string;language:'EN'|'ID';onClose:()=>void;onAdded:(cards:AddedCard[])=>void}){
  const id=language==='ID';
  const [choices,setChoices]=useState<VaultChoice[]>([]);
  const [choiceCache,setChoiceCache]=useState<Map<string,VaultChoice>>(()=>new Map());
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<Record<string,number>>({});
  const [prices,setPrices]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(open);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const busyRef=useRef(busy);
  const closeRef=useRef(onClose);
  useEffect(()=>{busyRef.current=busy;closeRef.current=onClose},[busy,onClose]);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();
    const start=window.setTimeout(()=>setLoading(true),0);
    const request=window.setTimeout(()=>{
      void fetch(`/api/listings/available-items?q=${encodeURIComponent(query.trim())}`,{cache:'no-store',signal:controller.signal}).then(async response=>{
        const data=await response.json() as {items?:VaultChoice[];error?:string};
        if(!response.ok)throw new Error(data.error||'Your Vault could not be loaded.');
        const items=data.items??[];setChoices(items);setChoiceCache(current=>{const next=new Map(current);for(const item of items)next.set(item.id,item);return next});setError('');
      }).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Your Vault could not be loaded.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    },250);
    return()=>{window.clearTimeout(start);window.clearTimeout(request);controller.abort()};
  },[open,query]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busyRef.current)closeRef.current()};
    document.addEventListener('keydown',onKeyDown);
    return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',onKeyDown)};
  },[open]);
  const filtered=useMemo(()=>{const term=query.trim().toLowerCase();return choices.filter(item=>!term||[item.card?.name,item.card?.code,item.printingCode,item.card?.setCode,item.variant].some(value=>String(value??'').toLowerCase().includes(term)))},[choices,query]);
  const available=(item:VaultChoice)=>Math.max(0,item.quantity-(item.listedQuantity??0));
  const selectedCards=Object.entries(selected).filter(([,quantity])=>quantity>0);
  const totalAdded=selectedCards.reduce((sum,[,quantity])=>sum+quantity,0);
  const nextEntryCount=listingItems.length+selectedCards.filter(([instanceId])=>!listingItems.some(line=>line.instanceId===instanceId)).length;
  const totalAfter=listingItems.reduce((sum,item)=>sum+item.quantity,0)+totalAdded;
  const totalAfterAmount=listingItems.reduce((sum,item)=>sum+item.quantity*item.unitAmount,0)+selectedCards.reduce((sum,[instanceId,quantity])=>{const item=choiceCache.get(instanceId);if(!item)return sum;const existing=listingItems.find(line=>line.printingId===item.printingId&&line.condition===item.condition);return sum+quantity*(existing?.unitAmount??(Number(prices[instanceId])||0))},0);
  const pricesReady=selectedCards.every(([instanceId])=>{const item=choiceCache.get(instanceId);if(!item)return false;const existing=listingItems.find(line=>line.printingId===item.printingId&&line.condition===item.condition);return Boolean(existing?.unitAmount)||Number.isSafeInteger(Number(prices[instanceId]))&&Number(prices[instanceId])>0});
  const setQuantity=(item:VaultChoice,raw:number)=>setSelected(previous=>({...previous,[item.id]:Math.max(0,Math.min(available(item),Math.floor(raw)||0))}));
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy)return;setError('');
    const additions=selectedCards.flatMap(([instanceId,quantity])=>{const item=choiceCache.get(instanceId);if(!item)return[];const existing=listingItems.find(line=>line.printingId===item.printingId&&line.condition===item.condition);const unitAmount=existing?.unitAmount??Number(prices[instanceId]);return[{instanceId,printingId:item.printingId,quantity,unitAmount}]});
    if(!additions.length){setError(id?'Pilih kartu yang ingin ditambahkan.':'Select cards to add.');return}
    if(additions.some(item=>!Number.isSafeInteger(item.unitAmount)||item.unitAmount<1)){setError(id?'Masukkan harga per kartu.':'Enter a price per card.');return}
    if(nextEntryCount>30||totalAfter>999){setError(id?'Batas listing adalah 30 entri dan 999 kartu.':'A listing can contain up to 30 entries and 999 cards.');return}
    setBusy(true);
    try{
      const response=await fetch(`/api/listings/${encodeURIComponent(listingId)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'add-items',items:additions})});
      const data=await response.json() as {error?:string;items?:Array<{instanceId?:string;printingId:string;quantity:number;condition?:string;unitAmount:number}>};
      if(!response.ok)throw new Error(data.error||(id?'Kartu tidak dapat ditambahkan.':'Cards could not be added.'));
      const updated=(data.items??[]).map(line=>{const choice=choiceCache.get(line.instanceId??'');const existing=listingItems.find(item=>item.instanceId===line.instanceId);const fallback=listingItems.find(item=>item.printingId===line.printingId);const card=choice?.card??existing?.card??fallback?.card;return card?{...line,condition:line.condition??choice?.condition??existing?.condition??fallback?.condition??'NM',id:line.printingId,card,language:choice?.language??existing?.language??fallback?.language??'EN'}:null}).filter((item):item is AddedCard=>Boolean(item));
      toast.success(id?'Kartu ditambahkan ke listing':'Cards added to listing');onAdded(updated);onClose();
    }catch(reason){setError(reason instanceof Error?reason.message:'Cards could not be added.')}
    finally{setBusy(false)}
  };
  if(!open||typeof document==='undefined')return null;
  return createPortal(<div className="vault-modal-overlay market-add-cards-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onClose()}}><section className="vault-bulk-listing-modal market-add-cards-modal" role="dialog" aria-modal="true" aria-labelledby="market-add-cards-title" aria-busy={busy}>
    <header><div><span className="vault-modal-eyebrow">MARKET</span><h2 id="market-add-cards-title">{id?'Tambah kartu':'Add cards'}</h2><p>{id?'Pilih kartu yang tersedia di Vault.':'Choose available cards from your Vault.'}</p></div><button type="button" className="vault-icon-btn" onClick={onClose} disabled={busy} aria-label={id?'Tutup':'Close'}><Close size={20}/></button></header>
    <form onSubmit={submit}>
      <div className="vault-bulk-listing-search"><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={id?'Cari nama atau kode kartu':'Search by card name or code'} aria-label={id?'Cari kartu di Vault':'Search Vault cards'}/><span>{filtered.length.toLocaleString(id?'id-ID':'en-US')}</span></div>
      <div className="vault-bulk-listing-choices market-add-cards-choices" role="group" aria-label={id?'Kartu tersedia':'Available cards'}>
        {loading&&<p className="vault-bulk-empty">{id?'Memuat Vault…':'Loading your Vault…'}</p>}
        {!loading&&filtered.map(item=>{const picked=selected[item.id]??0;const availableCount=available(item);const existing=listingItems.find(line=>line.printingId===item.printingId&&line.condition===item.condition);return <div key={item.id} className={`vault-bulk-listing-choice ${picked?'is-selected':''}`}>
          <button type="button" className="vault-bulk-listing-select" aria-pressed={picked>0} onClick={()=>setQuantity(item,picked?0:1)}><span className="vault-bulk-listing-art"><CardArt card={item.card!} small/></span><span className="vault-bulk-listing-copy"><strong>{item.card?.name}</strong><small>{item.card?.code} / {item.variant??item.card?.variant??'Standard'} / {id?'tersedia':'available'} {availableCount}</small></span><span className="vault-bulk-listing-check">{picked>0&&<Check size={14}/>}</span></button>
          {picked>0&&<div className="vault-bulk-listing-controls"><label className="vault-bulk-listing-price">{existing?(id?'Harga / kartu':'Price per card'):(id?'Harga / kartu':'Price per card')}<input aria-label={`${id?'Harga per kartu':'Price per card'}: ${item.card?.name}`} value={existing?String(existing.unitAmount):(prices[item.id]??'')} readOnly={Boolean(existing)} onChange={event=>setPrices(previous=>({...previous,[item.id]:event.target.value.replace(/\D/g,'')}))} inputMode="numeric" placeholder="0"/></label><label className="vault-bulk-listing-quantity">{id?'Jumlah':'Quantity'}<input type="number" min={0} max={availableCount} step={1} value={picked} onChange={event=>setQuantity(item,Number(event.target.value))}/><small>{id?`dari ${availableCount}`:`of ${availableCount}`}</small></label></div>}
        </div>})}
        {!loading&&!filtered.length&&<p className="vault-bulk-empty">{query.trim()?(id?'Kartu tidak ditemukan.':'No matching cards.'):(id?'Tidak ada kartu tersedia di Vault.':'No available cards in your Vault.')}</p>}
      </div>
      <div className="vault-bulk-listing-summary"><span>{id?`${totalAdded} kartu ditambahkan`:`${totalAdded} cards added`}<small>{id?`Listing setelah ditambahkan: ${totalAfter} kartu`:`Listing after update: ${totalAfter} cards`}</small></span><strong>{new Intl.NumberFormat(id?'id-ID':'en-US',{style:'currency',currency:currency||'IDR',maximumFractionDigits:0}).format(totalAfterAmount)}</strong></div>
      {error&&<p className="vault-bulk-listing-error" role="alert">{error}</p>}
      <footer><button type="button" className="vault-btn vault-btn-secondary" onClick={onClose} disabled={busy}>{id?'Batal':'Cancel'}</button><button type="submit" className="vault-btn vault-btn-primary" disabled={busy||loading||!totalAdded||!pricesReady||nextEntryCount>30||totalAfter>999}>{busy?<Spinner className="is-spinning" size={16}/>:<Check size={16}/>} {busy?(id?'Menyimpan…':'Saving…'):(id?'Tambahkan':'Add to listing')}</button></footer>
    </form>
  </section></div>,document.body);
}
