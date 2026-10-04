'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus, Translate, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { printings } from '@/packages/card-data/catalog';
import { api } from '@/lib/client';
import { CardArt } from '../../card-art';
import type { EnrichedCollectionItem, VaultPrinting } from '../types';

type Props = {
  item: EnrichedCollectionItem;
  stackItems: EnrichedCollectionItem[];
  quantity: number;
  isAnonymous: boolean;
  onSaved: () => Promise<void> | void;
};

export function CardStackControls({ item, stackItems, quantity, isAnonymous, onSaved }: Props) {
  const options = useMemo<VaultPrinting[]>(() => item.card.availablePrintings?.length
    ? item.card.availablePrintings
    : printings.filter(printing => printing.cardId === item.card.id).map(printing => ({id:printing.id,language:printing.language,variant:printing.variant,set_code:printing.set})), [item.card.availablePrintings,item.card.id]);
  const [busy, setBusy] = useState(false);
  const [pickerOpen,setPickerOpen]=useState(false);
  // The collection record is the source of truth; local selection state can leak
  // when React reuses this control for another card in a mapped Vault list.
  const currentPrintingId=String(item.printingId);
  const chosen = options.find(printing => String(printing.id) === currentPrintingId);
  const chosenLanguage=chosen?.language??item.language??'EN';
  const languages=[...new Set(options.map(option=>option.language||'EN'))];
  const [pickerLanguage,setPickerLanguage]=useState(chosen?.language??item.language??'EN');
  useEffect(()=>{setPickerLanguage(chosen?.language??item.language??'EN')},[currentPrintingId,item.language]);
  const activeLanguage=languages.includes(pickerLanguage)?pickerLanguage:(chosen?.language??item.language??languages[0]??'EN');
  const languageOptions=options.filter(option=>(option.language||'EN')===activeLanguage);
  const hasActiveListing=stackItems.some(copy=>(copy.listedQuantity??0)>0);
  const listedQuantity=stackItems.reduce((total,copy)=>total+Math.min(copy.quantity,copy.listedQuantity??0),0);
  const removableQuantity=Math.max(0,quantity-listedQuantity);
  const unlistedItems=stackItems.filter(copy=>(copy.listedQuantity??0)===0);

  const update = async (changes: { quantity?: number; printingId?: string }) => {
    if (busy) return;
    setBusy(true);
    try {
      if (isAnonymous) {
        const { addLocalVaultItem, updateLocalVaultItem, deleteLocalVaultItem, updateLocalVaultItems } = await import('../local-vault');
        if(changes.printingId){
          if(hasActiveListing)throw new Error('Remove the active listing before changing this printing.');
          const targetOption=options.find(option=>option.id===changes.printingId)??chosen;
          if(!targetOption)throw new Error('That printing is not available.');
          const ids=stackItems.map(source=>source.id);
          const source=stackItems[0];
          updateLocalVaultItems(ids,{printingId:targetOption.id,language:targetOption.language,variant:targetOption.variant,setCode:targetOption.set_code,printingCode:targetOption.printing_code,card:{...source.card,language:targetOption.language,variant:targetOption.variant,setCode:targetOption.set_code,printingCode:targetOption.printing_code,imageUrl:targetOption.card_image_url||source.card.imageUrl}});
          toast.success(`Updated ${stackItems.length} printing${stackItems.length===1?'':'s'} to ${targetOption.language} · ${targetOption.variant}`);
        }else if(changes.quantity!==undefined){
          if(changes.quantity===0){
            const source=unlistedItems.at(-1);
            if(!source)throw new Error('All copies are reserved by an active listing.');
            deleteLocalVaultItem(source.id);
            toast.success(`${item.card.name} removed from your Vault`);
          }else if(changes.quantity>quantity){
            if(hasActiveListing){
              addLocalVaultItem({printingId:item.printingId,type:'RAW',quantity:1,condition:item.condition||'NM',provider:null,grade:null,certification:null,visibility:'private',acquisitionAmount:0,currency:'IDR',acquiredAt:new Date().toISOString(),notes:null,card:item.card});
            }else{
              const source=stackItems[0];
              updateLocalVaultItem(source.id,{quantity:source.quantity+1});
            }
          }else{
            const source=[...unlistedItems].reverse().find(copy=>copy.quantity>1);
            if(source)updateLocalVaultItem(source.id,{quantity:source.quantity-1});
            else if(unlistedItems.length)deleteLocalVaultItem(unlistedItems.at(-1)!.id);
            else throw new Error('A card stack must contain at least one copy.');
          }
          toast.success(`Quantity: ${changes.quantity}`);
        } else {
          return;
        }
      } else {
        if(changes.printingId){
          if(hasActiveListing)throw new Error('Remove the active listing before changing this printing.');
          const targetOption=options.find(option=>option.id===changes.printingId)??chosen;
          if(!targetOption)throw new Error('That printing is not available.');
          const catalogCard={code:item.card.code,name:item.card.name,color:item.card.color,type:item.card.type,cost:item.card.cost,power:item.card.power,rarity:targetOption.rarity??item.card.rarity,effect:item.card.effect,setCode:targetOption.set_code,language:targetOption.language,variant:targetOption.variant,printingCode:targetOption.printing_code??item.card.code,imageUrl:targetOption.card_image_url??item.card.imageUrl};
          for(const source of stackItems)await api('/api/collection',{id:source.id,printingId:changes.printingId,catalogCard},'PATCH');
          toast.success(`Updated printing for ${stackItems.length} card record${stackItems.length===1?'':'s'}`);
        }else if(changes.quantity!==undefined){
          if(changes.quantity===0){
            const source=unlistedItems.at(-1);
            if(!source)throw new Error('All copies are reserved by an active listing.');
            await api('/api/collection',{id:source.id},'DELETE');
            toast.success(`${item.card.name} removed from your Vault`);
          }else if(changes.quantity>quantity){
            if(hasActiveListing){
              await api('/api/collection',{printingId:item.printingId,catalogCard:{code:item.card.code,name:item.card.name,color:item.card.color,type:item.card.type,cost:item.card.cost,power:item.card.power,rarity:item.card.rarity,effect:item.card.effect,setCode:item.setCode??item.card.setCode,language:item.language??item.card.language,variant:item.variant??item.card.variant,printingCode:item.printingCode??item.card.printingCode,imageUrl:item.card.imageUrl},type:'RAW',quantity:1,condition:item.condition||'NM',visibility:'private',acquisitionAmount:0,currency:'IDR',acquiredAt:new Date().toISOString(),notes:null},'POST');
            }else{
              const source=stackItems[0];
              await api('/api/collection',{id:source.id,quantity:source.quantity+1},'PATCH');
            }
          }else{
            const source=[...unlistedItems].reverse().find(copy=>copy.quantity>1);
            if(source)await api('/api/collection',{id:source.id,quantity:source.quantity-1},'PATCH');
            else if(unlistedItems.length)await api('/api/collection',{id:unlistedItems.at(-1)!.id},'DELETE');
            else throw new Error('A card stack must contain at least one copy.');
          }
          toast.success(`Quantity: ${changes.quantity}`);
        }
      }
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update this card.');
    } finally {
      setBusy(false);
    }
  };

  if (item.type !== 'RAW') return null;
  const selectPrinting=(printingId:string)=>{
    const nextPrinting=options.find(option=>option.id===printingId);
    if(!nextPrinting||nextPrinting.id===item.printingId)return;
    void update({printingId:nextPrinting.id});
  };
  return (
    <div className="vault-stack-control-wrap" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <div className="vault-stack-controls">
        {options.length > 1 && <button type="button" className="vault-printing-trigger" aria-expanded={pickerOpen} aria-haspopup="dialog" title={hasActiveListing?'Remove the active listing before changing printing':'Change card printing'} disabled={busy||hasActiveListing} onClick={()=>setPickerOpen(value=>!value)}><Translate size={13}/><span><small>Printing</small><b>{chosen?.language??item.language??'EN'} · {chosen?.variant??item.variant??'Standard'}</b></span><span className="vault-printing-trigger-change">{hasActiveListing?'Listed':'Change'}</span></button>}
      <div className="vault-quantity-stepper" aria-label={`Quantity, ${quantity} copies`}>
        <button type="button" aria-label={removableQuantity===1?`Delete ${item.card.name} from Vault`:`Remove one ${item.card.name}`} title={removableQuantity===0?'All copies are listed':removableQuantity===1?'Delete unlisted copy from Vault':'Remove one unlisted copy'} disabled={busy||removableQuantity===0} onClick={() => {
          if(removableQuantity===1){if(window.confirm(`Remove ${item.card.name} from your Vault?`))void update({quantity:0});}
          else void update({quantity:quantity-1});
        }}>{removableQuantity===1?<Trash size={12}/>:<Minus size={12}/>}</button>
        <span>{quantity}</span>
        <button type="button" aria-label={`Add one ${item.card.name}`} disabled={busy || quantity >= 999} onClick={() => void update({ quantity: quantity + 1 })}><Plus size={12}/></button>
      </div>
      </div>
      {pickerOpen&&options.length>1&&<section className="vault-printing-panel" role="dialog" aria-label={`Choose a printing for ${item.card.name}`}>
        <header><div><strong>Choose printing</strong><span>{item.card.name} · {options.length} options</span></div><button type="button" onClick={()=>setPickerOpen(false)} aria-label="Close printing picker">×</button></header>
        {languages.length>1&&<div className="vault-language-tabs" role="tablist" aria-label="Language">{languages.map(language=><button type="button" role="tab" key={language} aria-selected={activeLanguage===language} className={activeLanguage===language?'is-selected':''} disabled={busy} onClick={()=>setPickerLanguage(language)}>{language}<small>{options.filter(option=>(option.language||'EN')===language).length}</small></button>)}</div>}
        <div className="vault-printing-grid" role="list" aria-label={`${activeLanguage} printings`}>{languageOptions.map(option=>{
          const preview={...item.card,language:option.language,variant:option.variant,setCode:option.set_code??item.card.setCode,printingCode:option.printing_code??item.card.printingCode,imageUrl:option.card_image_url??item.card.imageUrl};
          const selected=String(option.id)===currentPrintingId&&(option.language??'EN')===chosenLanguage;
          return <button type="button" role="listitem" key={option.id} className={`vault-printing-choice ${selected?'is-selected':''}`} aria-pressed={selected} disabled={busy} onClick={()=>selectPrinting(option.id)}><span className="vault-printing-choice-art"><CardArt card={preview} small/></span><span className="vault-printing-choice-meta"><b>{option.variant||'Standard'}</b><small>{option.printing_code??item.card.code}</small></span><span className="vault-printing-choice-check">{selected&&<Check size={14}/>}</span></button>;
        })}</div>
      </section>}
    </div>
  );
}
