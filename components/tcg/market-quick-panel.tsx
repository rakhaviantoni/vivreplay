'use client';

import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowRightIcon as ArrowRight,CardsIcon as Cards,HeartIcon as Heart,UserIcon as User} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {api,type AccountState} from '@/lib/client';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';

type Panel='profile'|'vault'|null;

export function MarketQuickPanel({panel,onOpenChange,locale,account,onSaved}:{panel:Panel;onOpenChange:(open:boolean)=>void;locale:'EN'|'ID';account:AccountState;onSaved:()=>Promise<void>|void}){
  const profile=account.profile;
  return <Dialog open={Boolean(panel)} onOpenChange={onOpenChange}><DialogContent className="market-quick-panel">
    {panel==='profile'?<ProfileQuickEdit key={`${profile.id}:${profile.updated_at??''}`} profile={profile} locale={locale} onSaved={onSaved}/>:panel==='vault'?<>
      <DialogHeader><DialogTitle>{locale==='ID'?'Koleksi':'Vault'}</DialogTitle><DialogDescription>{locale==='ID'?'Kelola kartu dan daftar incaran.':'Your cards and saved picks.'}</DialogDescription></DialogHeader>
      <div className="market-quick-links">
        <Link href="/vault" onClick={()=>onOpenChange(false)}><Cards size={19}/><span><strong>{locale==='ID'?'Koleksi':'Collection'}</strong><small>{account.collection.length} {locale==='ID'?'kartu':'cards'}</small></span><ArrowRight size={17}/></Link>
        <Link href="/vault?tab=wishlist" onClick={()=>onOpenChange(false)}><Heart size={19}/><span><strong>{locale==='ID'?'Wishlist':'Wishlist'}</strong><small>{account.wishlist.length} {locale==='ID'?'kartu':'cards'}</small></span><ArrowRight size={17}/></Link>
        <Link href="/decks" onClick={()=>onOpenChange(false)}><Cards size={19}/><span><strong>{locale==='ID'?'Deck':'Decks'}</strong><small>{account.decks.length} {locale==='ID'?'deck tersimpan':'saved decks'}</small></span><ArrowRight size={17}/></Link>
      </div>
    </>:null}
  </DialogContent></Dialog>;
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
