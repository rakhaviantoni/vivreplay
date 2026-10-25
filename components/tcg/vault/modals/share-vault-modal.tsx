'use client';

import React, {useEffect, useMemo, useState} from 'react';
import {CheckIcon as Check, CopyIcon as Copy, DownloadSimpleIcon as Download, MoonIcon as Moon, ShareNetworkIcon as Share2, SunIcon as Sun} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {VivreMark} from '../../brand-assets';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {generateVaultShareBlob, type ShareCardItem} from '../../share';
import {vaultPublicCardReference} from '../views/vault-slot-meta-identity';
import type {EnrichedCollectionItem, SetProgress} from '../types';

interface ShareVaultModalProps {
  open:boolean; onClose:()=>void; username:string; items:EnrichedCollectionItem[]; hideValues:boolean;
  selectedSlab?:EnrichedCollectionItem|null; selectedSet?:SetProgress|null; language?:'EN'|'ID'; gameSlug:'one-piece'|'pokemon'|'all';
}

function shareMeta(item:EnrichedCollectionItem){
  const printing=item.card.availablePrintings?.find(candidate=>String(candidate.id)===String(item.printingId));
  const setCode=printing?.set_code??item.setCode??item.card.setCode;
  const language=printing?.language??item.language??item.card.language;
  const rarity=printing?.rarity??item.rarity??item.card.rarity;
  const isPokemon=item.card.gameSlug==='pokemon'||/^PK-/i.test(item.card.code);
  const reference=isPokemon?vaultPublicCardReference(item):[setCode,(printing?.printing_code??item.printingCode??item.card.printingCode??item.card.code).replace(/_p\d+$/i,'')].filter(Boolean).join(' ');
  return [reference,language,rarity].filter(Boolean).join('  ');
}

function slabShareLabel(item:EnrichedCollectionItem){
  const printing=item.card.availablePrintings?.find(candidate=>String(candidate.id)===String(item.printingId));
  const printCode=printing?.printing_code??item.printingCode??item.card.printingCode??item.card.code;
  return {
    setCode:printing?.set_code??item.setCode??item.card.setCode,
    language:printing?.language??item.language??item.card.language,
    number:printCode.match(/(\d+[A-Z]?)$/i)?.[1]??printCode,
    rarity:printing?.rarity??item.rarity??item.card.rarity,
  };
}

export function ShareVaultModal({open,onClose,username,items,selectedSlab,selectedSet,language='EN',gameSlug}:ShareVaultModalProps){
  const id=language==='ID';
  const activeSlab=selectedSlab??items.find(item=>item.type==='GRADED')??null;
  const [requestedFormat,setRequestedFormat]=useState<'top9'|'slab'|'set'|null>(null);
  const format=requestedFormat??(selectedSlab?'slab':selectedSet?'set':'top9');
  const [style,setStyle]=useState<'light'|'dark'>('light');
  const [copied,setCopied]=useState(false);
  const [preview,setPreview]=useState('');
  const [loading,setLoading]=useState(false);
  const topItems=useMemo(()=>items.slice(0,9),[items]);
  const shareItems:ShareCardItem[]=useMemo(()=>topItems.map(item=>({
    card:item.card,printingId:item.printingId,quantity:item.quantity,metaLine:shareMeta(item),
    productType:item.type,gradingCompany:item.provider??undefined,grade:item.grade??undefined,certification:item.certification??undefined,
    ...(item.type==='GRADED'?{slabLabel:slabShareLabel(item)}:{}),
  })),[topItems]);
  const origin=typeof window!=='undefined'&&['localhost','127.0.0.1'].includes(window.location.hostname)?window.location.origin:'https://vivreplay.com';
  const shareUrl=`${origin}/players/${username}`;
  const setData=useMemo(()=>selectedSet?{name:selectedSet.name,ownedCount:selectedSet.ownedCount,totalCards:selectedSet.totalCards,percentage:selectedSet.percentage,mainSetOwned:selectedSet.mainSetOwned,mainSetTotal:selectedSet.mainSetTotal,parallelsOwned:selectedSet.parallelsOwned,parallelsTotal:selectedSet.parallelsTotal}:undefined,[selectedSet]);
  const cardsForImage=useMemo(()=>format==='top9'?shareItems:format==='slab'&&activeSlab?[{card:activeSlab.card,printingId:activeSlab.printingId,quantity:1,metaLine:shareMeta(activeSlab),productType:'GRADED' as const,gradingCompany:activeSlab.provider??undefined,grade:activeSlab.grade??undefined,certification:activeSlab.certification??undefined,slabLabel:slabShareLabel(activeSlab)}]:[],[format,shareItems,activeSlab]);

  useEffect(()=>{
    if(!open)return;
    let active=true;let objectUrl='';
    void Promise.resolve().then(()=>{
      if(!active)return null;
      setLoading(true);setPreview('');
      return generateVaultShareBlob({title:format==='set'?(selectedSet?.name??(id?'Progres set':'Set progress')):format==='slab'?(activeSlab?.card.name??'Vault'):id?`Koleksi @${username}`:`@${username}'s Vault`,cards:cardsForImage,link:`vivreplay.com/players/${username}`,language,style,gameSlug,setProgress:format==='set'?setData:undefined});
    })
      .then(blob=>{if(!active||!blob)return;objectUrl=URL.createObjectURL(blob);setPreview(objectUrl)})
      .catch(()=>{})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
  },[open,format,selectedSet,activeSlab,username,language,style,gameSlug,cardsForImage,setData,id]);

  const copyLink=async()=>{try{await navigator.clipboard.writeText(shareUrl);setCopied(true);toast.success(id?'Tautan disalin':'Link copied');window.setTimeout(()=>setCopied(false),2000)}catch{toast.error(id?'Gagal menyalin tautan':'Could not copy link')}};
  const saveImage=async()=>{if(!preview)return;try{const response=await fetch(preview);const blob=await response.blob();const file=document.createElement('a');file.href=URL.createObjectURL(blob);file.download=`${username}_${format==='slab'?'slab':format==='set'?'set':'vault'}.png`;file.click();URL.revokeObjectURL(file.href)}catch{toast.error(id?'Gagal menyimpan gambar':'Could not save image')}};
  const nativeShare=async()=>{try{if(!navigator.share)return;if(preview){const response=await fetch(preview);const image=new File([await response.blob()],`${username}_${format}.png`,{type:'image/png'});if(navigator.canShare?.({files:[image]})){await navigator.share({title:`${username}'s Vault`,text:id?'Lihat koleksi kartu saya':'View my card collection',url:shareUrl,files:[image]});return}}await navigator.share({title:`${username}'s Vault`,text:id?'Lihat koleksi kartu saya':'View my card collection',url:shareUrl})}catch{}}

  return <Dialog open={open} onOpenChange={next=>{if(!next){setRequestedFormat(null);onClose()}}}>
    <DialogContent className={`vault-share-dialog${gameSlug==='pokemon'?' is-pokemon':''}`}>
      <DialogHeader className="vault-share-dialog-header">
        <div className="vault-share-brand"><VivreMark size={20} label="VivrePlay"/><span>VivrePlay</span></div>
        <DialogTitle>{id?'Bagikan koleksi':'Share your Vault'}</DialogTitle>
        <DialogDescription>{id?'Pilih tampilan, lalu bagikan tautan atau gambar.':'Choose a view, then share the link or image.'}</DialogDescription>
      </DialogHeader>
      <div className="vault-share-toolbar">
        <div className="vault-share-formats" role="group" aria-label={id?'Tampilan koleksi':'Collection view'}>
          <button type="button" aria-pressed={format==='top9'} className={format==='top9'?'is-selected':''} onClick={()=>setRequestedFormat('top9')}>{id?'Pilihan':'Top cards'}</button>
          {activeSlab&&<button type="button" aria-pressed={format==='slab'} className={format==='slab'?'is-selected':''} onClick={()=>setRequestedFormat('slab')}>Slab</button>}
          {selectedSet&&<button type="button" aria-pressed={format==='set'} className={format==='set'?'is-selected':''} onClick={()=>setRequestedFormat('set')}>Set</button>}
        </div>
        <button type="button" className="vault-share-theme-toggle" onClick={()=>setStyle(current=>current==='light'?'dark':'light')} aria-label={style==='light'?(id?'Gunakan tema gelap':'Use dark theme'):(id?'Gunakan tema terang':'Use light theme')}>
          {style==='light'?<Moon size={17}/>:<Sun size={17}/>}
        </button>
      </div>
      <div className={`vault-share-preview is-${style}${gameSlug==='pokemon'?' is-pokemon':''}`}>
        {loading&&<div className="vault-share-loading" aria-label={id?'Memuat pratinjau':'Loading preview'}/>}
        {!loading&&preview&&<img className="vault-share-image" src={preview} alt={id?'Pratinjau gambar koleksi':'Vault share image preview'}/>}
        {!loading&&!preview&&<p className="vault-share-error" role="status">{id?'Pratinjau tidak tersedia':'Preview unavailable'}</p>}
      </div>
      <div className="vault-share-link"><input readOnly value={shareUrl} aria-label={id?'Tautan koleksi':'Vault link'} onFocus={event=>event.currentTarget.select()}/><button type="button" onClick={copyLink}>{copied?<Check size={16}/>:<Copy size={16}/>}<span>{copied?(id?'Tersalin':'Copied'):(id?'Salin tautan':'Copy link')}</span></button></div>
      <div className="vault-share-actions"><button type="button" onClick={saveImage} disabled={!preview||loading}><Download size={16}/><span>{id?'Simpan gambar':'Save image'}</span></button><button type="button" onClick={nativeShare}><Share2 size={16}/><span>{id?'Bagikan':'Share'}</span></button></div>
    </DialogContent>
  </Dialog>;
}
