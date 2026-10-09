'use client';

import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowRightIcon as ArrowRight,PencilSimpleIcon as Pencil,PlusIcon as Plus,UserIcon as User} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {api,type AccountState} from '@/lib/client';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {AddEditItemModal} from './vault/modals/add-edit-item-modal';
import {enrichCollectionItem} from './vault/vault-utils';
import type {EnrichedCollectionItem} from './vault/types';
import {CardArt} from './card-art';
import {WishlistTab} from './vault/tabs/wishlist-tab';

type Panel='profile'|'vault'|'wishlist'|null;

export function MarketQuickPanel({panel,onOpenChange,locale,account,onSaved,onRefresh=()=>{}}:{panel:Panel;onOpenChange:(open:boolean)=>void;locale:'EN'|'ID';account:AccountState;onSaved:()=>Promise<void>|void;onRefresh?:()=>Promise<void>|void}){
  const profile=account.profile;
  return <Dialog open={Boolean(panel)} onOpenChange={onOpenChange}><DialogContent className={`market-quick-panel${panel==='wishlist'?' is-wishlist':''}`}>
    {panel==='profile'?<ProfileQuickEdit key={`${profile.id}:${profile.updated_at??''}`} profile={profile} locale={locale} onSaved={onSaved}/>:panel==='vault'?<>
      <VaultQuickActions account={account} locale={locale} onOpenChange={onOpenChange} onRefresh={onRefresh}/>
    </>:panel==='wishlist'?<div className="market-quick-wishlist" onClickCapture={event=>{if((event.target as HTMLElement).closest('a'))onOpenChange(false)}}>
      <WishlistTab wishlist={account.wishlist} language={locale} onUpdated={async()=>{await onRefresh()}} onRemoveFromWishlist={async printingId=>{try{await api('/api/wishlist',{printingId,saved:false});toast.success(locale==='ID'?'Dihapus dari wishlist':'Removed from wishlist');await onRefresh()}catch(error){toast.error(error instanceof Error?error.message:(locale==='ID'?'Kartu gagal dihapus':'Could not remove card'))}}}/>
    </div>:null}
  </DialogContent></Dialog>;
}

function VaultQuickActions({account,locale,onOpenChange,onRefresh}:{account:AccountState;locale:'EN'|'ID';onOpenChange:(open:boolean)=>void;onRefresh:()=>Promise<void>|void}){
  const [editorOpen,setEditorOpen]=useState(false);
  const [editingItem,setEditingItem]=useState<EnrichedCollectionItem|null>(null);
  const cards=account.collection.slice(0,5).map(item=>({source:item,item:enrichCollectionItem(item,new Set())}));
  const total=account.collection.reduce((sum,item)=>sum+(item.type==='GRADED'?1:item.quantity),0);
  const edit=(item:EnrichedCollectionItem|null)=>{setEditingItem(item);setEditorOpen(true)};
  return <>
    <DialogHeader><DialogTitle>{locale==='ID'?'Vault':'Vault'}</DialogTitle><DialogDescription>{total} {locale==='ID'?'kartu dalam koleksi':'cards in your collection'}</DialogDescription></DialogHeader>
    <div className="market-quick-vault-list">
      {cards.length?cards.map(({source,item})=><div className="market-quick-vault-row" key={source.id}><span className="market-quick-vault-art"><CardArt card={item.card}/></span><span className="market-quick-vault-copy"><strong>{item.card.name}</strong><small>{item.card.code} · {item.language??item.card.language??'EN'} · ×{item.quantity}</small></span><button type="button" className="market-quick-vault-edit" onClick={()=>edit(item)} aria-label={`${locale==='ID'?'Edit':'Edit'} ${item.card.name}`}><Pencil size={16}/></button></div>):<p className="market-quick-vault-empty">{locale==='ID'?'Koleksi Anda masih kosong.':'Your collection is empty.'}</p>}
    </div>
    <div className="market-quick-vault-actions"><button type="button" className="button primary" onClick={()=>edit(null)}><Plus size={16}/>{locale==='ID'?'Tambah kartu':'Add card'}</button><Link className="market-quick-secondary" href="/vault" onClick={()=>onOpenChange(false)}>{locale==='ID'?'Buka seluruh Vault':'Open full Vault'}<ArrowRight size={15}/></Link></div>
    <AddEditItemModal open={editorOpen} onClose={()=>{setEditorOpen(false);setEditingItem(null)}} onSaved={async()=>{await onRefresh();setEditorOpen(false);setEditingItem(null)}} editingItem={editingItem} language={locale}/>
  </>;
}

function ProfileQuickEdit({profile,locale,onSaved}:{profile:Record<string,unknown>;locale:'EN'|'ID';onSaved:()=>Promise<void>|void}){
  const [displayName,setDisplayName]=useState(String(profile.display_name??''));
  const [phone,setPhone]=useState(String(profile.phone??''));
  const [saving,setSaving]=useState(false);
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setSaving(true);
    try{
      await api('/api/profile',{username:String(profile.username??''),displayName,phone,region:String(profile.region??'ID'),currency:String(profile.currency??'IDR'),timezone:String(profile.timezone??'Asia/Jakarta'),locale:String(profile.locale??'en')});
      await onSaved();toast.success(locale==='ID'?'Profil diperbarui':'Profile updated');
    }catch(error){toast.error(error instanceof Error?error.message:(locale==='ID'?'Profil tidak dapat disimpan':'Could not save profile'));}
    finally{setSaving(false)}
  };
  return <>
    <DialogHeader><DialogTitle>{locale==='ID'?'Edit profil':'Edit profile'}</DialogTitle><DialogDescription>@{String(profile.username??'')}</DialogDescription></DialogHeader>
    <form className="market-quick-profile-form" onSubmit={submit}>
      <label>{locale==='ID'?'Nama tampilan':'Display name'}<input required minLength={2} maxLength={50} value={displayName} onChange={event=>setDisplayName(event.target.value)}/></label>
      <label>{locale==='ID'?'Nomor telepon':'Phone number'}<input type="tel" maxLength={24} value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+62"/></label>
      <button className="button primary" type="submit" disabled={saving}><User size={16}/>{saving?(locale==='ID'?'Menyimpan…':'Saving…'):(locale==='ID'?'Simpan':'Save')}</button>
    </form>
    <Link className="market-quick-secondary" href="/profile" onClick={()=>onSaved()}>{locale==='ID'?'Pengaturan lainnya':'More profile settings'}<ArrowRight size={15}/></Link>
  </>;
}
