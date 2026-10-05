'use client';

import {useEffect, useState, type ReactNode} from 'react';
import {toast} from 'sonner';
import {MinusIcon as Minus,PlusIcon as Plus,SignInIcon as SignIn,SpinnerGapIcon as Spinner} from '@phosphor-icons/react';
import type {Card} from '@/packages/card-data/catalog';
import type {CollectionItem} from '@/packages/domain';
import {api} from '@/lib/client';
import {authClient} from '@/lib/auth-client';

export type CardPrinting={id:string;language:string;variant:string|null;printing_code:string|null;card_image_url:string|null;set_code?:string|null;rarity?:string|null};

export function printingLabel(variant:string|null) {
  if(!variant)return 'Standard';
  const label=variant.replace(/(?:^|[\s·,/_-])p\d+(?=$|[\s·,/_-])/ig,'').replace(/[·,/_-]+\s*$/,'').trim();
  return label||'Alt art';
}

export function printingPriority(variant:string|null) { return /^(standard|base)$/i.test(variant??'')?0:1; }

export function orderPrintings<T extends CardPrinting>(printings:T[]) { return [...printings].sort((a,b)=>printingPriority(a.variant)-printingPriority(b.variant)||printingLabel(a.variant).localeCompare(printingLabel(b.variant))); }

export function uniquePrintings<T extends CardPrinting>(printings:T[]) { return [...new Map(printings.map(item=>[item.printing_code??item.id,item])).values()]; }

function PrintingVaultControl({printing,card,collection,signedIn,busy,locale,onChange}:{printing:CardPrinting;card:Card;collection:CollectionItem[];signedIn:boolean|null;busy:boolean;locale:'EN'|'ID';onChange:(printing:CardPrinting,card:Card,delta:number)=>void}){
  const allRows=collection.filter(item=>item.printingId===printing.id);
  const rows=allRows.filter(item=>item.type==='RAW');
  const count=allRows.reduce((sum,item)=>sum+item.quantity,0);
  const removable=rows.reduce((sum,item)=>sum+Math.max(0,item.quantity-(item.listedQuantity??0)),0);
  if(signedIn===null)return <div className="printing-vault-loading" aria-hidden="true"/>;
  if(signedIn!==true)return <button type="button" className="printing-vault-add" onClick={()=>onChange(printing,card,1)} disabled={busy} aria-label={locale==='ID'?'Tambahkan cetakan mentah ke koleksi':'Add raw printing to Vault'}>{busy?<Spinner className="is-spinning" size={12}/>:<SignIn size={12}/>}<span>{locale==='ID'?'Simpan':'Add to Vault'}</span></button>;
  return <div className="printing-vault-stepper" aria-label={locale==='ID'?`${count} salinan cetakan ini di koleksi, termasuk slab`:`${count} copies of this printing in Vault, including slabs`}><button type="button" onClick={()=>onChange(printing,card,-1)} disabled={busy||removable===0} aria-label="Remove one available raw copy"><Minus size={12}/></button><b>{count}</b><button type="button" onClick={()=>onChange(printing,card,1)} disabled={busy} aria-label="Add one raw copy">{busy?<Spinner className="is-spinning" size={12}/>:<Plus size={12}/>}</button></div>;
}

export function CardPrintingSelector<T extends CardPrinting>({printings,language,selectedId,onLanguageChange,onSelect,renderCard,vaultCard}:{printings:T[];language:string;selectedId?:string;onLanguageChange:(language:string)=>void;onSelect:(id:string)=>void;renderCard:(printing:T)=>ReactNode;vaultCard?:Card}) {
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  const [collection,setCollection]=useState<CollectionItem[]>([]);
  const [signedIn,setSignedIn]=useState<boolean|null>(null);
  const [busyPrinting,setBusyPrinting]=useState<string|null>(null);
  const {data:session}=authClient.useSession();
  useEffect(()=>{
    let active=true;
    if(session){void api<{collection:CollectionItem[]}>('/api/state').then(result=>{if(active)setCollection(result.collection??[])}).catch(()=>undefined)}
    else void api<{collection:CollectionItem[]}>('/api/state').then(result=>{if(active){setCollection(result.collection??[]);setSignedIn(true)}}).catch(()=>{if(active)setSignedIn(false)});
    const syncLocale=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail);
    syncLocale();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>{active=false;window.removeEventListener('vivreplay:locale',onLocale)};
  },[session]);
  const changePrinting=async(printing:CardPrinting,card:Card,delta:number)=>{
    if(busyPrinting)return;
    if(!session&&signedIn!==true){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return;}
    const rows=collection.filter(item=>item.printingId===printing.id&&item.type==='RAW');
    const removable=rows.reduce((sum,item)=>sum+Math.max(0,item.quantity-(item.listedQuantity??0)),0);
    const imageUrl=printing.card_image_url??card.imageUrl;
    const catalogCard={code:card.code,name:card.name,color:card.color,type:card.type,cost:card.cost,power:card.power,rarity:printing.rarity??card.rarity,effect:card.effect,setCode:printing.set_code??card.setCode,language:printing.language==='JP'?'JP':'EN',variant:printing.variant??'Standard',printingCode:printing.printing_code??card.printingCode??card.code,...(imageUrl&&/^https?:\/\//i.test(imageUrl)?{imageUrl}:{})};
    setBusyPrinting(printing.id);
    try{
      if(delta>0){
        const row=rows.find(item=>item.condition==='NM'&&item.quantity>(item.listedQuantity??0));
        if(row)await api('/api/collection',{id:row.id,quantity:row.quantity+1,printingId:printing.id,catalogCard},'PATCH');
        else await api('/api/collection',{printingId:printing.id,catalogCard,type:'RAW',quantity:1,condition:'NM',provider:null,grade:null,certification:null,visibility:'private',acquisitionAmount:0,currency:'IDR'});
      }else if(removable>0){
        const row=[...rows].reverse().find(item=>item.quantity>(item.listedQuantity??0));
        if(!row)return;
        if(row.quantity>1)await api('/api/collection',{id:row.id,quantity:row.quantity-1},'PATCH');
        else await api('/api/collection',{id:row.id},'DELETE');
      }else return;
      const result=await api<{collection:CollectionItem[]}>('/api/state');setCollection(result.collection??[]);setSignedIn(true);
      const quantity=Math.max(1,Math.abs(delta));
      const message=delta>0
        ? (locale==='ID'?`Menambahkan ${quantity} salinan ${card.name} ke koleksi`:`Added ${quantity} ${quantity===1?'copy':'copies'} of ${card.name} to your Vault`)
        : (locale==='ID'?`Menghapus ${quantity} salinan ${card.name} dari koleksi`:`Removed ${quantity} ${quantity===1?'copy':'copies'} of ${card.name} from your Vault`);
      toast.success(message,{action:{label:locale==='ID'?'Lihat koleksi':'View Vault',onClick:()=>window.location.assign(locale==='ID'?'/id/vault':'/vault')}});
    }catch(error){
      if(error instanceof Error&&/sign in|401/i.test(error.message)){setSignedIn(false);window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));}
      else toast.error(error instanceof Error?error.message:(locale==='ID'?'Tidak dapat memperbarui koleksi.':'Could not update your Vault.'));
    }finally{setBusyPrinting(null)}
  };
  const id=locale==='ID';
  const languages=[...new Set(printings.map(item=>item.language))].sort((a,b)=>a.localeCompare(b));
  const visible=uniquePrintings(orderPrintings(printings.filter(item=>item.language===language&&item.card_image_url)));
  return <section className="viewer-printings"><div className="printing-title"><h3>{id?'Versi Cetak':'Printings'}</h3><div aria-label={id?'Bahasa':'Language'}>{languages.map(item=><button type="button" key={item} aria-pressed={language===item} className={language===item?'active':''} onClick={()=>onLanguageChange(item)}>{item==='JP'?'日本語 · JP':item==='ID'?'Indonesia · ID':'English · EN'}</button>)}</div></div><div className="printing-strip">{visible.map(item=>{const label=printingLabel(item.variant);return <div className="printing-option" key={item.id}><button type="button" className={`printing-choice ${item.id===selectedId?'selected':''}`} aria-pressed={item.id===selectedId} onClick={()=>onSelect(item.id)}>{renderCard(item)}<span>{id&&label==='Standard'?'Standar':label}</span></button>{vaultCard&&<PrintingVaultControl printing={item} card={vaultCard} collection={collection} signedIn={session?true:signedIn} busy={busyPrinting===item.id} locale={locale} onChange={changePrinting}/>}</div>})}</div></section>;
}
