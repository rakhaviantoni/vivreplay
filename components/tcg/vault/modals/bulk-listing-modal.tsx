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
import {useMarketListingLimits} from '@/lib/market/use-listing-limits';
import {FeedbackLaunchButton} from '../../feedback-launch';
import {vaultPublicCardReference} from '../views/vault-slot-meta-identity';
import {matchesSearchText} from '@/lib/card-search';

const countLabel=(count:number,singular:string,plural:string)=>`${count} ${count===1?singular:plural}`;

export function BulkListingModal({open,onClose,stacks,onPublished,language}:{open:boolean;onClose:(wasPublished?:boolean)=>void;stacks:VaultStackGroup[];onPublished:()=>Promise<void>|void;language:'EN'|'ID'}){
  const id=language==='ID';
  const listingLimits=useMarketListingLimits(open?'open':'closed');
  const [quantities,setQuantities]=useState<Record<string,number>>({});
  const [prices,setPrices]=useState<Record<string,string>>({});
  const [cardSearch,setCardSearch]=useState('');
  const [choiceLimit,setChoiceLimit]=useState(40);
  const [title,setTitle]=useState('');
  const [city,setCity]=useState('');
  const [originLoaded,setOriginLoaded]=useState(false);
  const [negotiable,setNegotiable]=useState(true);
  const [error,setError]=useState('');
  const [missingImageIds,setMissingImageIds]=useState<Record<string,boolean>>({});
  const [busy,setBusy]=useState(false);
  const [published,setPublished]=useState<{id:string;title:string;amount:number;cards:ShareCardItem[];city?:string;expiresAt?:string}|null>(null);
  const choices=useMemo(()=>stacks.filter(stack=>stack.items.some(copy=>copy.quantity-(copy.listedQuantity??0)>0)),[stacks]);
  const filteredChoices=useMemo(()=>{if(!cardSearch.trim())return choices;return choices.filter(stack=>matchesSearchText([stack.item.card.name,stack.item.card.code,stack.item.card.setCode,stack.printingLabel],cardSearch))},[choices,cardSearch]);
  const visibleChoices=filteredChoices.slice(0,choiceLimit);
  const lineQuantity=(stack:VaultStackGroup)=>stack.item.type==='GRADED'?(stack.items.some(copy=>(copy.listedQuantity??0)<1)?1:0):stack.items.reduce((sum,copy)=>sum+Math.max(0,copy.quantity-(copy.listedQuantity??0)),0);
  const selectedQuantity=(stack:VaultStackGroup)=>Math.min(lineQuantity(stack),quantities[stack.item.id]??0);
  const allocation=(stack:VaultStackGroup)=>{let remaining=selectedQuantity(stack);return stack.items.flatMap(copy=>{const amount=Math.min(Math.max(0,copy.quantity-(copy.listedQuantity??0)),remaining);remaining-=amount;return amount>0?[{copy,quantity:amount}]:[]})};
  const chosen=choices.filter(stack=>selectedQuantity(stack)>0);
  const quantity=chosen.reduce((sum,stack)=>sum+selectedQuantity(stack),0);
  const totalAmount=chosen.reduce((sum,stack)=>sum+(Number(prices[stack.item.id])||0)*selectedQuantity(stack),0);
  const cardIdentity=(stack:VaultStackGroup)=>`${stack.item.card.gameSlug??'one-piece'}:${stack.item.card.code}`;
  const chosenTypeCount=new Set(chosen.map(cardIdentity)).size;
  const copiesForIdentity=(stack:VaultStackGroup,exceptId?:string)=>choices.reduce((sum,candidate)=>sum+(cardIdentity(candidate)===cardIdentity(stack)&&candidate.item.id!==exceptId?selectedQuantity(candidate):0),0);
  const maxForStack=(stack:VaultStackGroup)=>Math.max(0,Math.min(lineQuantity(stack),listingLimits.maxCopiesPerCard-copiesForIdentity(stack,stack.item.id),listingLimits.maxListingCopies-quantity+selectedQuantity(stack)));
  useEffect(()=>{if(!open)return;let active=true;void fetch('/api/shipping/origin',{cache:'no-store'}).then(response=>response.json() as Promise<{origin?:{city?:string}|null}>).then(data=>{if(active)setCity(data.origin?.city?.trim()??'')}).catch(()=>{}).finally(()=>{if(active)setOriginLoaded(true)});return()=>{active=false}},[open]);
  useEffect(()=>{if(!open&&!published)return;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy){const wasPublished=Boolean(published);setPublished(null);onClose(wasPublished)}};document.addEventListener('keydown',onKeyDown);return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKeyDown)}},[open,published,busy,onClose]);
  if((!open&&!published)||typeof document==='undefined')return null;
  const close=()=>{if(busy)return;const wasPublished=Boolean(published);setPublished(null);onClose(wasPublished)};
  const toggle=(stack:VaultStackGroup)=>{const isSelected=selectedQuantity(stack)>0;if(!isSelected&&(maxForStack(stack)<1||(copiesForIdentity(stack)===0&&chosenTypeCount>=listingLimits.maxCardTypes)))return;if(!isSelected&&!title)setTitle(stack.item.card.name);setQuantities(previous=>{const next={...previous};if(isSelected)delete next[stack.item.id];else next[stack.item.id]=1;return next});setPrices(previous=>({...previous,[stack.item.id]:previous[stack.item.id]??String(Math.round((stack.estimatedValue||0)/Math.max(1,stack.quantity))||'')}))};
  const setStackQuantity=(stack:VaultStackGroup,value:number)=>{const maximum=maxForStack(stack);if(maximum<1)return;const nextQuantity=Math.max(1,Math.min(maximum,Math.floor(value)||1));setQuantities(previous=>({...previous,[stack.item.id]:nextQuantity}))};
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy)return;setError('');
    if(!chosen.length){setError(id?'Pilih minimal satu kartu.':'Select at least one card.');return}
    if(chosenTypeCount>listingLimits.maxCardTypes||quantity>listingLimits.maxListingCopies||chosen.some(stack=>copiesForIdentity(stack)>listingLimits.maxCopiesPerCard)){setError(id?`Listing maksimal ${listingLimits.maxListingCopies} kartu, dengan ${listingLimits.maxCopiesPerCard} salinan untuk kartu yang sama.`:`A listing can include up to ${listingLimits.maxListingCopies} cards, with no more than ${listingLimits.maxCopiesPerCard} copies of the same card.`);return}
    if(!title.trim()||title.trim().length<3){setError(id?'Judul listing minimal 3 karakter.':'Enter a listing title with at least 3 characters.');return}
    if(!city.trim()||city.trim().length<2){setError(id?'Masukkan kota asal.':'Enter your shipping origin city.');return}
    if(chosen.some(stack=>!Number.isSafeInteger(Number(prices[stack.item.id]))||Number(prices[stack.item.id])<=0)){setError(id?'Masukkan harga per kartu untuk setiap pilihan.':'Enter a per-card price for every selected line.');return}
    if(!Number.isSafeInteger(totalAmount)||totalAmount<=0){setError(id?'Total harga listing tidak valid.':'The listing total is invalid.');return}
    setBusy(true);
    try{
      const bundle=chosen.flatMap(stack=>allocation(stack).map(({copy,quantity:copyQuantity})=>({instanceId:copy.id,printingId:copy.printingId,quantity:copyQuantity,condition:copy.condition,unitAmount:Number(prices[stack.item.id])})));
      const response=await fetch('/api/listings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({instanceId:bundle[0].instanceId,title:title.trim(),amount:totalAmount,quantity,city:city.trim(),type:'WTS',negotiable,items:bundle})});
      const result=await response.json() as {error?:string;id?:string;expiresAt?:string};if(!response.ok)throw new Error(result.error||'Listing could not be published.');if(!result.id)throw new Error(id?'Listing berhasil dibuat, tetapi tautannya tidak tersedia. Muat ulang koleksi Anda.':'Listing was created, but its link is missing. Refresh your Vault.');
      setPublished({id:result.id,title:title.trim(),amount:totalAmount,cards:chosen.map(stack=>({card:stack.item.card,printingId:stack.item.printingId,quantity:selectedQuantity(stack),condition:stack.item.type==='RAW'?stack.items[0]?.condition:undefined,unitAmount:Number(prices[stack.item.id]),productType:stack.item.type,gradingCompany:stack.item.type==='GRADED'?stack.item.provider??undefined:undefined,grade:stack.item.type==='GRADED'?stack.item.grade??undefined:undefined,certification:stack.item.type==='GRADED'?stack.item.certification??undefined:undefined,metaLine:stack.item.type==='GRADED'?[stack.item.provider,stack.item.grade,stack.item.certification?`Cert #${stack.item.certification}`:null].filter(Boolean).join(' '):undefined})),city:city.trim(),expiresAt:result.expiresAt});toast.success(id?'Listing berhasil dipublikasikan':'Listing published');
      try{await onPublished()}catch{/* The listing is already published; keep the success state visible. */}
    }catch(cause){setError(cause instanceof Error?cause.message:'Listing could not be published.')}
    finally{setBusy(false)}
  };
  if(published){const totalCards=published.cards.reduce((sum,item)=>sum+(item.quantity??1),0);return <ShareButton title={published.title} path={marketListingPath(published.title,published.id)} cards={published.cards} subtitle={id?countLabel(totalCards,'kartu','kartu'):countLabel(totalCards,'card','cards')} listingInfo={{city:published.city,expiresAt:published.expiresAt}} price={`Rp ${published.amount.toLocaleString('id-ID')}`} openOnMount hideTrigger onOpenChange={isOpen=>{if(!isOpen)close()}}/>}
  return createPortal(<div className="vault-modal-overlay" role="presentation" onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="vault-bulk-listing-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-listing-title">
    <header><div><span className="vault-modal-eyebrow">MARKET</span><h2 id="bulk-listing-title">{id?'Buat listing gabungan':'Create a bundle listing'}</h2><p>{id?'Gabungkan kartu Vault dalam satu listing.':'Choose cards from your Vault to list together.'}</p></div><button type="button" className="vault-icon-btn" onClick={close} disabled={busy} aria-label={id?'Tutup':'Close'}><Close size={20}/></button></header>
    <form onSubmit={submit}>
      <div className="vault-bulk-listing-search"><input type="search" value={cardSearch} onChange={event=>{setCardSearch(event.target.value);setChoiceLimit(40)}} placeholder={id?'Cari nama atau kode kartu':'Search by card name or code'} aria-label={id?'Cari kartu di Vault':'Search Vault cards'}/><span>{filteredChoices.length.toLocaleString(id?'id-ID':'en-US')} {id?'kartu':'cards'}</span></div>
      <p className="vault-bulk-listing-limit">{id?`Maks. ${listingLimits.maxListingCopies} kartu, ${listingLimits.maxCopiesPerCard} salinan per kartu.`:`Up to ${listingLimits.maxListingCopies} cards, ${listingLimits.maxCopiesPerCard} copies per card.`}</p>
      <div className="vault-bulk-listing-choices" role="group" aria-label={id?'Pilih kartu':'Select cards'}>{visibleChoices.map(stack=>{const available=lineQuantity(stack);const selected=selectedQuantity(stack);const checked=selected>0;const isSlab=stack.item.type==='GRADED';const identityCount=copiesForIdentity(stack);const max=maxForStack(stack);const disabled=!checked&&(max<1||(identityCount===0&&chosenTypeCount>=listingLimits.maxCardTypes));return <div key={stack.item.id} className={`vault-bulk-listing-choice ${checked?'is-selected':''}`}><button type="button" className="vault-bulk-listing-select" aria-pressed={checked} disabled={disabled} onClick={()=>toggle(stack)}><span className="vault-bulk-listing-art"><CardArt card={stack.item.card} small onImageMissing={()=>setMissingImageIds(current=>({...current,[stack.item.id]:true}))} onImageLoaded={()=>setMissingImageIds(current=>{if(!current[stack.item.id])return current;const next={...current};delete next[stack.item.id];return next})}/></span><span className="vault-bulk-listing-copy"><strong>{stack.item.card.name}</strong><small>{isSlab?[stack.item.provider,stack.item.grade,stack.item.certification?`Cert #${stack.item.certification}`:null].filter(Boolean).join(' '):`${vaultPublicCardReference(stack.item)} / ${stack.printingLabel}`}</small><small>{id?`${available} tersedia di Vault`:`${available} available in Vault`}</small></span><span className="vault-bulk-listing-check">{checked&&<Check size={14}/>}</span></button>{missingImageIds[stack.item.id]&&stack.item.card.gameSlug==='pokemon'&&<FeedbackLaunchButton className="vault-bulk-missing-image-report" request={{initialCategory:'missing-printing',cardCode:stack.item.card.code,printingId:stack.item.printingId}} title="Report this missing card image">Report</FeedbackLaunchButton>}{checked&&<div className="vault-bulk-listing-controls"><label className="vault-bulk-listing-price">{id?'Harga / kartu':'Price per card'}<input aria-label={`${id?'Harga per kartu':'Price per card'}: ${stack.item.card.name}`} value={prices[stack.item.id]??''} onChange={event=>setPrices(previous=>({...previous,[stack.item.id]:event.target.value.replace(/\D/g,'')}))} inputMode="numeric" placeholder="0"/></label><label className="vault-bulk-listing-quantity">{id?'Jumlah':'Quantity'}<input type="number" aria-label={`${id?'Jumlah':'Quantity'}: ${stack.item.card.name}`} min={1} max={max} step={1} value={selected} onChange={event=>setStackQuantity(stack,Number(event.target.value))}/><small>{id?`Maks. ${max}`:`Max ${max}`}</small></label></div>}</div>})}{filteredChoices.length===0&&<p className="vault-bulk-empty">{choices.length===0?(id?'Tidak ada kartu tersedia untuk dijual.':'No available cards to list for sale.'):(id?'Kartu tidak ditemukan.':'No matching cards.')}</p>}{visibleChoices.length<filteredChoices.length&&<button className="vault-bulk-listing-more" type="button" onClick={()=>setChoiceLimit(current=>current+40)}>{id?`Tampilkan ${Math.min(40,filteredChoices.length-visibleChoices.length)} kartu lagi`:`Show ${Math.min(40,filteredChoices.length-visibleChoices.length)} more cards`}</button>}</div>
      <div className="vault-bulk-listing-fields"><label>{id?'Judul listing':'Listing title'}<input value={title} onChange={event=>setTitle(event.target.value)} maxLength={100} placeholder={id?'Bundle kartu':'Card bundle'}/></label><div className="vault-bulk-listing-origin"><span>{id?'Dikirim dari':'Ships from'}</span><div className="vault-bulk-listing-origin-control"><strong>{city||(!originLoaded?(id?'Memuat alamat':'Loading address'):(id?'Alamat pengiriman belum diatur':'Delivery address not set'))}</strong>{originLoaded&&<button type="button" onClick={()=>window.dispatchEvent(new Event('vivreplay:open-market-delivery'))}>{city?(id?'Ubah alamat':'Change address'):(id?'Atur alamat':'Set address')}</button>}</div></div></div>
      <MarketPriceMode value={negotiable} onChange={setNegotiable} language={language}/>
      <div className="vault-bulk-listing-summary"><span>{id?`${countLabel(chosenTypeCount,'jenis kartu','jenis kartu')}, ${countLabel(quantity,'kartu','kartu')}`:`${countLabel(chosenTypeCount,'card type','card types')}, ${countLabel(quantity,'card','cards')}`}<small>{id?`Maks. ${listingLimits.maxListingCopies} kartu, ${listingLimits.maxCopiesPerCard} salinan untuk kartu yang sama`:`Max ${listingLimits.maxListingCopies} cards, ${listingLimits.maxCopiesPerCard} copies of the same card`}</small></span><strong>{id?'Total':'Listing total'}: Rp {totalAmount.toLocaleString('id-ID')}</strong></div>
{error&&<p className="vault-bulk-listing-error" role="alert">{error}</p>}
      <footer><button type="button" className="vault-btn vault-btn-secondary" onClick={close} disabled={busy}>{id?'Batal':'Cancel'}</button><button type="submit" className="vault-btn vault-btn-primary" disabled={busy||chosen.length===0||totalAmount<=0||quantity>listingLimits.maxListingCopies||chosen.some(stack=>copiesForIdentity(stack)>listingLimits.maxCopiesPerCard)}><Store size={16}/>{busy?(id?'Menerbitkan…':'Publishing…'):(id?`Terbitkan listing, Rp ${totalAmount.toLocaleString('id-ID')}`:`Publish listing for Rp ${totalAmount.toLocaleString('id-ID')}`)}</button></footer>
    </form>
  </section></div>,document.body);
}
