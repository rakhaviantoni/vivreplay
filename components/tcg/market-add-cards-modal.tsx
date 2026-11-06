'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CheckIcon as Check,SpinnerGapIcon as Spinner,XIcon as Close} from '@phosphor-icons/react';
import {toast} from 'sonner';
import type {Card} from '@/packages/card-data/catalog';
import {CardArt} from './card-art';
import {listingLimitMessage,listingLimitViolation} from '@/lib/market/listing-limits';
import {useMarketListingLimits} from '@/lib/market/use-listing-limits';
import {AddEditItemModal} from './vault/modals/add-edit-item-modal';

type VaultChoice={id:string;printingId:string;type:'RAW'|'GRADED';quantity:number;condition:string;listedQuantity?:number;card?:Card;language?:string;variant?:string;printingCode?:string;provider?:string;grade?:string;certification?:string};
type CatalogPrinting={id:string;rarity?:string;variant?:string;set_code?:string;set_name?:string;printing_code?:string;language?:string;card_image_url?:string|null;tcg_card_identities?:{code:string;name:string;color?:string;card_type?:string;cost?:number;power?:number;effect_text?:string}};
type ListingLine={instanceId?:string;printingId:string;quantity:number;condition?:string;unitAmount:number;card?:Card;language?:string;productType?:'RAW'|'GRADED';gradingCompany?:string;grade?:string;certification?:string};
type AddedCard=Omit<ListingLine,'condition'>&{id:string;condition:string;card:Card;language:string;productType?:'RAW'|'GRADED';gradingCompany?:string;grade?:string;certification?:string};

export function MarketAddCardsModal({open,listingId,listingItems,currency,language,onClose,onAdded}:{open:boolean;listingId:string;listingItems:ListingLine[];currency:string;language:'EN'|'ID';onClose:()=>void;onAdded:(cards:AddedCard[])=>void}){
  const id=language==='ID';
  const listingLimits=useMarketListingLimits(open?'open':'closed');
  const [choices,setChoices]=useState<VaultChoice[]>([]);
  const [choiceCache,setChoiceCache]=useState<Map<string,VaultChoice>>(()=>new Map());
  const [query,setQuery]=useState('');
  const [source,setSource]=useState<'vault'|'catalog'>('vault');
  const [catalogPrintings,setCatalogPrintings]=useState<CatalogPrinting[]>([]);
  const [catalogLoading,setCatalogLoading]=useState(false);
  const [addTarget,setAddTarget]=useState<{card:Card;printingId:string}|null>(null);
  const [selected,setSelected]=useState<Record<string,number>>({});
  const [prices,setPrices]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(open);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const busyRef=useRef(busy);
  const closeRef=useRef(onClose);
  const gameSlug=listingItems.some(item=>/^PK-/i.test(item.card?.code??''))?'pokemon':'one-piece';
  const catalogLanguage=(listingItems.find(item=>item.language)?.language??language).toUpperCase();
  useEffect(()=>{busyRef.current=busy;closeRef.current=onClose},[busy,onClose]);
  useEffect(()=>{
    if(!open||source!=='vault')return;
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
  },[open,query,source]);
  useEffect(()=>{
    if(!open||source!=='catalog'||query.trim().length<2){setCatalogPrintings([]);setCatalogLoading(false);return}
    const controller=new AbortController();const timer=window.setTimeout(()=>{
      setCatalogLoading(true);
      void fetch(`/api/cards/catalog?game=${gameSlug}&language=${catalogLanguage}&q=${encodeURIComponent(query.trim())}&limit=40`,{cache:'no-store',signal:controller.signal})
        .then(async response=>{const data=await response.json() as {cards?:CatalogPrinting[];error?:string};if(!response.ok)throw new Error(data.error||'Card catalog could not be loaded.');return data.cards??[]})
        .then(setCatalogPrintings).catch(error=>{if(!controller.signal.aborted){setCatalogPrintings([]);setError(error instanceof Error?error.message:'Card catalog could not be loaded.')}})
        .finally(()=>{if(!controller.signal.aborted)setCatalogLoading(false)});
    },180);
    return()=>{window.clearTimeout(timer);controller.abort()};
  },[open,source,query,gameSlug,catalogLanguage]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busyRef.current)closeRef.current()};
    document.addEventListener('keydown',onKeyDown);
    return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',onKeyDown)};
  },[open]);
  const filtered=useMemo(()=>{const term=query.trim().toLowerCase();return choices.filter(item=>!term||[item.card?.name,item.card?.code,item.printingCode,item.card?.setCode,item.variant].some(value=>String(value??'').toLowerCase().includes(term)))},[choices,query]);
  const reloadVault=async()=>{
    const response=await fetch(`/api/listings/available-items?q=${encodeURIComponent(query.trim())}`,{cache:'no-store'});
    const data=await response.json() as {items?:VaultChoice[];error?:string};
    if(!response.ok)throw new Error(data.error||'Your Vault could not be loaded.');
    const items=data.items??[];setChoices(items);setChoiceCache(current=>{const next=new Map(current);for(const item of items)next.set(item.id,item);return next});setSource('vault');
  };
  const available=(item:VaultChoice)=>Math.max(0,item.quantity-(item.listedQuantity??0));
  const selectedCards=Object.entries(selected).filter(([,quantity])=>quantity>0);
  const totalAdded=selectedCards.reduce((sum,[,quantity])=>sum+quantity,0);
  const totalAfter=listingItems.reduce((sum,item)=>sum+item.quantity,0)+totalAdded;
  const identityByPrinting=new Map<string,string>();
  for(const item of listingItems)identityByPrinting.set(item.printingId,item.card?.code??item.printingId);
  for(const item of choices)identityByPrinting.set(item.printingId,item.card?.code??item.printingId);
  for(const item of choiceCache.values())identityByPrinting.set(item.printingId,item.card?.code??item.printingId);
  const resultingItems=[...listingItems.map(item=>({printingId:item.printingId,quantity:item.quantity})),...selectedCards.flatMap(([instanceId,quantity])=>{const item=choiceCache.get(instanceId);return item?[{printingId:item.printingId,quantity}]:[]})];
  const limitViolation=listingLimitViolation(resultingItems,identityByPrinting,listingLimits);
  const identityFor=(printingId:string)=>identityByPrinting.get(printingId)??printingId;
  const maxQuantityFor=(item:VaultChoice)=>{
    if(item.type==='GRADED')return Math.min(1,available(item),listingLimits.maxListingCopies-totalAfter);
    const identity=identityFor(item.printingId);
    const alreadyListed=listingItems.filter(line=>identityFor(line.printingId)===identity).reduce((sum,line)=>sum+line.quantity,0);
    const selectedElsewhere=selectedCards.reduce((sum,[instanceId,quantity])=>{const selectedItem=choiceCache.get(instanceId);return selectedItem&&instanceId!==item.id&&identityFor(selectedItem.printingId)===identity?sum+quantity:sum},0);
    return Math.max(0,Math.min(available(item),listingLimits.maxCopiesPerCard-alreadyListed-selectedElsewhere,listingLimits.maxListingCopies-totalAfter+(selected[item.id]??0)));
  };
  const totalAfterAmount=listingItems.reduce((sum,item)=>sum+item.quantity*item.unitAmount,0)+selectedCards.reduce((sum,[instanceId,quantity])=>{const item=choiceCache.get(instanceId);if(!item)return sum;const existing=listingItems.find(line=>line.printingId===item.printingId&&line.condition===item.condition);return sum+quantity*(existing?.unitAmount??(Number(prices[instanceId])||0))},0);
  const pricesReady=selectedCards.every(([instanceId])=>{const item=choiceCache.get(instanceId);if(!item)return false;const existing=listingItems.find(line=>line.printingId===item.printingId&&line.condition===item.condition);return Boolean(existing?.unitAmount)||Number.isSafeInteger(Number(prices[instanceId]))&&Number(prices[instanceId])>0});
  const setQuantity=(item:VaultChoice,raw:number)=>setSelected(previous=>({...previous,[item.id]:Math.max(0,Math.min(maxQuantityFor(item),Math.floor(raw)||0))}));
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy)return;setError('');
    const additions=selectedCards.flatMap(([instanceId,quantity])=>{const item=choiceCache.get(instanceId);if(!item)return[];const existing=listingItems.find(line=>line.printingId===item.printingId&&line.condition===item.condition);const unitAmount=existing?.unitAmount??Number(prices[instanceId]);return[{instanceId,printingId:item.printingId,quantity,unitAmount}]});
    if(!additions.length){setError(id?'Pilih kartu yang ingin ditambahkan.':'Select cards to add.');return}
    if(additions.some(item=>!Number.isSafeInteger(item.unitAmount)||item.unitAmount<1)){setError(id?'Masukkan harga per kartu.':'Enter a price per card.');return}
    if(limitViolation){setError(listingLimitMessage(limitViolation,id?'ID':'EN',listingLimits));return}
    setBusy(true);
    try{
      const response=await fetch(`/api/listings/${encodeURIComponent(listingId)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'add-items',items:additions})});
      const data=await response.json() as {error?:string;items?:Array<{instanceId?:string;printingId:string;quantity:number;condition?:string;unitAmount:number;productType?:'RAW'|'GRADED';gradingCompany?:string;grade?:string;certification?:string}>};
      if(!response.ok)throw new Error(data.error||(id?'Kartu tidak dapat ditambahkan.':'Cards could not be added.'));
      const updated:AddedCard[]=(data.items??[]).flatMap(line=>{const choice=choiceCache.get(line.instanceId??'');const existing=listingItems.find(item=>item.instanceId===line.instanceId);const fallback=listingItems.find(item=>item.printingId===line.printingId);const card=choice?.card??existing?.card??fallback?.card;return card?[{...line,condition:line.condition??choice?.condition??existing?.condition??fallback?.condition??'NM',id:line.printingId,card,language:choice?.language??existing?.language??fallback?.language??'EN',productType:line.productType??choice?.type??existing?.productType??fallback?.productType,gradingCompany:line.gradingCompany??choice?.provider??existing?.gradingCompany??fallback?.gradingCompany,grade:line.grade??choice?.grade??existing?.grade??fallback?.grade,certification:line.certification??choice?.certification??existing?.certification??fallback?.certification}]:[]});
      toast.success(id?'Kartu ditambahkan ke listing':'Cards added to listing');onAdded(updated);onClose();
    }catch(reason){setError(reason instanceof Error?reason.message:'Cards could not be added.')}
    finally{setBusy(false)}
  };
  if(!open||typeof document==='undefined')return null;
  return createPortal(<div className="vault-modal-overlay market-add-cards-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onClose()}}><section className="vault-bulk-listing-modal market-add-cards-modal" role="dialog" aria-modal="true" aria-labelledby="market-add-cards-title" aria-busy={busy}>
    <header><div><span className="vault-modal-eyebrow">MARKET</span><h2 id="market-add-cards-title">{id?'Tambah kartu':'Add cards'}</h2><p>{id?'Cari di katalog atau pilih salinan dari Vault.':'Search the catalog or choose a copy from your Vault.'}</p></div><button type="button" className="vault-icon-btn" onClick={onClose} disabled={busy} aria-label={id?'Tutup':'Close'}><Close size={20}/></button></header>
    <form onSubmit={submit}>
      <div className="market-add-cards-source" role="tablist" aria-label={id?'Sumber kartu':'Card source'}><button type="button" role="tab" aria-selected={source==='vault'} className={source==='vault'?'active':''} onClick={()=>{setSource('vault');setError('')}}>{id?'Vault':'My Vault'}</button><button type="button" role="tab" aria-selected={source==='catalog'} className={source==='catalog'?'active':''} onClick={()=>{setSource('catalog');setError('')}}>{id?'Katalog':'Catalog'}</button></div>
      <div className="vault-bulk-listing-search"><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={id?'Cari nama atau kode kartu':'Search by card name or code'} aria-label={id?'Cari kartu':'Search cards'}/></div>
      <div className="vault-bulk-listing-choices market-add-cards-choices" role="group" aria-label={source==='vault'?(id?'Kartu tersedia':'Available cards'):(id?'Hasil katalog':'Catalog results')}>
        {source==='vault'&&loading&&<p className="vault-bulk-empty">{id?'Memuat Vault…':'Loading your Vault…'}</p>}
        {source==='vault'&&!loading&&filtered.map(item=>{const picked=selected[item.id]??0;const availableCount=available(item);const max=maxQuantityFor(item);const existing=listingItems.find(line=>line.printingId===item.printingId&&item.type==='RAW'&&line.condition===item.condition);const variant=item.variant??item.card?.variant;const printingRef=item.card?.code?.startsWith('PK-')?[item.card.setCode,item.printingCode].filter((value,index,array)=>Boolean(value)&&array.indexOf(value)===index).join(' '):item.card?.code;return <div key={item.id} className={`vault-bulk-listing-choice ${picked?'is-selected':''}`}>
          <button type="button" className="vault-bulk-listing-select" aria-pressed={picked>0} disabled={!picked&&max<1} onClick={()=>setQuantity(item,picked?0:1)}><span className="vault-bulk-listing-art"><CardArt card={item.card!} small/></span><span className="vault-bulk-listing-copy"><strong>{item.card?.name}</strong><small>{item.type==='GRADED'?[item.provider,item.grade&&`Grade ${item.grade}`,item.certification&&`Cert ${item.certification}`].filter(Boolean).join(' '):[printingRef,variant&&variant!=='Standard'?variant:'',`${id?'tersedia':'available'} ${availableCount}`].filter(Boolean).join(' ')}</small></span><span className="vault-bulk-listing-check">{picked>0&&<Check size={14}/>}</span></button>
          {picked>0&&<div className="vault-bulk-listing-controls"><label className="vault-bulk-listing-price">{id?'Harga / kartu':'Price per card'}<input aria-label={`${id?'Harga per kartu':'Price per card'}: ${item.card?.name}`} value={existing?String(existing.unitAmount):(prices[item.id]??'')} readOnly={Boolean(existing)} onChange={event=>setPrices(previous=>({...previous,[item.id]:event.target.value.replace(/\D/g,'')}))} inputMode="numeric" placeholder="0"/></label><label className="vault-bulk-listing-quantity">{id?'Jumlah':'Quantity'}<input type="number" min={0} max={max} step={1} value={picked} onChange={event=>setQuantity(item,Number(event.target.value))}/><small>{id?`Maks. ${max}`:`Max ${max}`}</small></label></div>}
        </div>})}
        {source==='vault'&&!loading&&!filtered.length&&<p className="vault-bulk-empty">{query.trim()?(id?'Kartu tidak ditemukan.':'No matching cards.'):(id?'Tidak ada kartu tersedia di Vault.':'No available cards in your Vault.')}</p>}
        {source==='catalog'&&query.trim().length<2&&<p className="vault-bulk-empty">{id?'Cari nama, nomor, atau kode set.':'Search by card name, number, or set code.'}</p>}
        {source==='catalog'&&catalogLoading&&<p className="vault-bulk-empty">{id?'Mencari katalog…':'Searching the catalog…'}</p>}
        {source==='catalog'&&!catalogLoading&&catalogPrintings.map(printing=>{const identity=printing.tcg_card_identities;if(!identity)return null;const card:Card={id:identity.code,code:identity.code,name:identity.name,color:identity.color||'Red',type:(identity.card_type||'Character') as Card['type'],cost:identity.cost||0,power:identity.power||0,rarity:printing.rarity||'',art:0,effect:identity.effect_text||'',imageUrl:printing.card_image_url??undefined,setCode:printing.set_code,language:printing.language,printingCode:printing.printing_code,variant:printing.variant,gameSlug} as Card&{gameSlug:string};const details=[printing.set_code,printing.set_name,printing.printing_code,printing.language,printing.variant&&printing.variant!=='Standard'?printing.variant:''].filter((value,index,array)=>Boolean(value)&&array.indexOf(value)===index);return <div key={printing.id} className="market-add-catalog-result"><span className="vault-bulk-listing-art"><CardArt card={card} small/></span><span className="vault-bulk-listing-copy"><strong>{card.name}</strong><small>{details.join(' ')}</small></span><button type="button" className="vault-btn vault-btn-secondary" disabled={busy} onClick={()=>setAddTarget({card,printingId:printing.id})}>{id?'Tambah ke Vault':'Add to Vault'}</button></div>})}
        {source==='catalog'&&!catalogLoading&&query.trim().length>=2&&!catalogPrintings.length&&<p className="vault-bulk-empty">{id?'Kartu tidak ditemukan.':'No matching cards.'}</p>}
      </div>
      <div className="vault-bulk-listing-summary"><span>{id?`${totalAdded} kartu ditambahkan`:`${totalAdded} cards added`}<small>{id?`Listing: ${totalAfter} dari ${listingLimits.maxListingCopies} kartu maksimal`:`Listing: ${totalAfter} of ${listingLimits.maxListingCopies} cards max`}</small></span><strong>{new Intl.NumberFormat(id?'id-ID':'en-US',{style:'currency',currency:currency||'IDR',maximumFractionDigits:0}).format(totalAfterAmount)}</strong></div>
      {error&&<p className="vault-bulk-listing-error" role="alert">{error}</p>}
      <footer><button type="button" className="vault-btn vault-btn-secondary" onClick={onClose} disabled={busy}>{id?'Batal':'Cancel'}</button><button type="submit" className="vault-btn vault-btn-primary" disabled={busy||loading||!totalAdded||!pricesReady||Boolean(limitViolation)}>{busy?<Spinner className="is-spinning" size={16}/>:<Check size={16}/>} {busy?(id?'Menyimpan…':'Saving…'):(id?'Tambahkan':'Add to listing')}</button></footer>
    </form>
  </section><AddEditItemModal open={Boolean(addTarget)} onClose={()=>setAddTarget(null)} onSaved={async()=>{await reloadVault();setAddTarget(null);setSelected({});setError('')}} initialCard={addTarget?.card} initialPrintingId={addTarget?.printingId} language={language} gameSlug={gameSlug}/></div>,document.body);
}
