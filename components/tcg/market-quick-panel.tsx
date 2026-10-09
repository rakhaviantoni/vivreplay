'use client';

import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowRightIcon as ArrowRight,BookmarkSimpleIcon as Bookmark,CardsIcon as VaultIcon,ChatCircleDotsIcon as OffersIcon,ClipboardTextIcon as ListingsIcon,HeartIcon as Heart,PlusIcon as Plus,ShoppingBagIcon as OrdersIcon,UserIcon as User} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {api,type AccountState} from '@/lib/client';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {SavedListings} from './market-saved';
import {ListingsTab} from './vault/tabs/listings-tab';
import {OffersTab} from './vault/tabs/offers-tab';
import {OrdersTab} from './vault/tabs/orders-tab';
import {AddEditItemModal} from './vault/modals/add-edit-item-modal';
import {enrichCollectionItem} from './vault/vault-utils';
import type {EnrichedCollectionItem} from './vault/types';
import {CardArt} from './card-art';
import {WishlistTab} from './vault/tabs/wishlist-tab';

export type MarketAccountPanel='listings'|'offers'|'orders'|'saved'|'vault'|'wishlist'|'profile';
type ActivityCounts={listings:number;offers:number;orders:number};
const sections:[MarketAccountPanel,string,string,typeof ListingsIcon][]=[
  ['listings','My listings','Listing saya',ListingsIcon],
  ['offers','Offers','Penawaran',OffersIcon],
  ['orders','Orders','Pesanan',OrdersIcon],
  ['saved','Saved','Tersimpan',Bookmark],
  ['vault','Vault','Vault',VaultIcon],
  ['wishlist','Wishlist','Wishlist',Heart],
  ['profile','Profile','Profil',User],
];

export function MarketQuickPanel({panel,onOpenChange,onPanelChange,locale,account,activityCounts,onSaved,onRefresh=()=>{},onCreateListing,initialOrderId,initialConversationId}:{panel:MarketAccountPanel|null;onOpenChange:(open:boolean)=>void;onPanelChange:(panel:MarketAccountPanel)=>void;locale:'EN'|'ID';account:AccountState;activityCounts:ActivityCounts;onSaved:()=>Promise<void>|void;onRefresh?:()=>Promise<void>|void;onCreateListing:()=>void;initialOrderId?:string|null;initialConversationId?:string|null}){
  const profile=account.profile;
  const title=sections.find(([key])=>key===panel);
  const choose=(value:MarketAccountPanel)=>onPanelChange(value);
  return <Dialog open={Boolean(panel)} onOpenChange={onOpenChange}><DialogContent className="market-account-dialog market-account-unified">
    <header className="market-account-unified-heading">
      <div className="market-account-unified-avatar">{String(profile.display_name??profile.username??'V').slice(0,1).toUpperCase()}</div>
      <div><DialogHeader><DialogTitle>{String(profile.display_name||`@${profile.username}`)}</DialogTitle><DialogDescription>@{String(profile.username??'')}</DialogDescription></DialogHeader></div>
      {String(profile.tier??'free').toLowerCase()==='pro'&&<span className="market-pro-user-badge">Pro</span>}
      <strong className="market-account-section-title">{locale==='ID'?title?.[2]:title?.[1]}</strong>
    </header>
    <nav className="market-account-unified-tabs" role="tablist" aria-label={locale==='ID'?'Menu akun':'Account sections'}>
      {sections.map(([key,en,id,Icon])=><button key={key} type="button" role="tab" aria-selected={panel===key} className={panel===key?'is-active':''} onClick={()=>choose(key)}><Icon size={16}/><span>{locale==='ID'?id:en}</span>{key in activityCounts&&activityCounts[key as keyof ActivityCounts]>0&&<b className="market-activity-badge">{activityCounts[key as keyof ActivityCounts]>99?'99+':activityCounts[key as keyof ActivityCounts]}</b>}</button>)}
    </nav>
    <label className="market-account-mobile-select"><span>{locale==='ID'?'Bagian':'Section'}</span><select value={panel??'listings'} onChange={event=>choose(event.target.value as MarketAccountPanel)}>{sections.map(([key,en,id])=><option key={key} value={key}>{locale==='ID'?id:en}</option>)}</select></label>
    <div className={`market-account-unified-body is-${panel??'listings'}`} onClickCapture={event=>{if((event.target as HTMLElement).closest('a'))onOpenChange(false)}}>
      {panel==='listings'?<ListingsTab language={locale} onCreateListing={onCreateListing}/>:panel==='offers'?<OffersTab language={locale} initialConversationId={initialConversationId??undefined}/>:panel==='orders'?<OrdersTab language={locale} initialOrderId={initialOrderId??undefined}/>:panel==='saved'?<SavedListings language={locale}/>:panel==='vault'?<VaultQuickActions account={account} locale={locale} onOpenChange={onOpenChange} onRefresh={onRefresh}/>:panel==='wishlist'?<WishlistTab wishlist={account.wishlist} language={locale} onUpdated={async()=>{await onRefresh()}} onRemoveFromWishlist={async printingId=>{try{await api('/api/wishlist',{printingId,saved:false});toast.success(locale==='ID'?'Dihapus dari wishlist':'Removed from wishlist');await onRefresh()}catch(error){toast.error(error instanceof Error?error.message:(locale==='ID'?'Kartu gagal dihapus':'Could not remove card'))}}}/>:panel==='profile'?<ProfileQuickEdit key={`${profile.id}:${profile.updated_at??''}`} profile={profile} locale={locale} onSaved={onSaved}/>:null}
    </div>
  </DialogContent></Dialog>;
}

function VaultQuickActions({account,locale,onOpenChange,onRefresh}:{account:AccountState;locale:'EN'|'ID';onOpenChange:(open:boolean)=>void;onRefresh:()=>Promise<void>|void}){
  const [editorOpen,setEditorOpen]=useState(false);
  const [editingItem,setEditingItem]=useState<EnrichedCollectionItem|null>(null);
  const cards=account.collection.slice(0,6).map(item=>({source:item,item:enrichCollectionItem(item,new Set())}));
  const total=account.collection.reduce((sum,item)=>sum+(item.type==='GRADED'?1:item.quantity),0);
  const edit=(item:EnrichedCollectionItem|null)=>{setEditingItem(item);setEditorOpen(true)};
  return <>
    <div className="market-vault-quick-summary"><div><strong>{total.toLocaleString(locale==='ID'?'id-ID':'en-US')}</strong><span>{locale==='ID'?'kartu dalam Vault':'cards in Vault'}</span></div><Link href="/vault" onClick={()=>onOpenChange(false)}>{locale==='ID'?'Buka Vault':'Open Vault'}<ArrowRight size={15}/></Link></div>
    <div className="market-quick-vault-list">
      {cards.length?cards.map(({source,item})=><div className="market-quick-vault-row" key={source.id}><span className="market-quick-vault-art"><CardArt card={item.card}/></span><span className="market-quick-vault-copy"><strong>{item.card.name}</strong><small>{item.card.code} | {item.language??item.card.language??'EN'} | ×{item.quantity}</small></span><button type="button" className="market-quick-vault-edit" onClick={()=>edit(item)} aria-label={`Edit ${item.card.name}`}><span aria-hidden="true">✎</span></button></div>):<p className="market-quick-vault-empty">{locale==='ID'?'Koleksi Anda masih kosong.':'Your collection is empty.'}</p>}
    </div>
    <div className="market-quick-vault-actions"><button type="button" className="button primary" onClick={()=>edit(null)}><Plus size={16}/>{locale==='ID'?'Tambah kartu':'Add card'}</button><Link className="market-quick-secondary" href="/decks" onClick={()=>onOpenChange(false)}>{locale==='ID'?`Deck (${account.decks.length})`:`Decks (${account.decks.length})`}<ArrowRight size={15}/></Link></div>
    <AddEditItemModal open={editorOpen} onClose={()=>{setEditorOpen(false);setEditingItem(null)}} onSaved={async()=>{await onRefresh();setEditorOpen(false);setEditingItem(null)}} editingItem={editingItem} language={locale}/>
  </>;
}

function ProfileQuickEdit({profile,locale,onSaved}:{profile:Record<string,unknown>;locale:'EN'|'ID';onSaved:()=>Promise<void>|void}){
  const [displayName,setDisplayName]=useState(String(profile.display_name??''));
  const [phone,setPhone]=useState(String(profile.phone??''));
  const [saving,setSaving]=useState(false);
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setSaving(true);
    try{await api('/api/profile',{username:String(profile.username??''),displayName,phone,region:String(profile.region??'ID'),currency:String(profile.currency??'IDR'),timezone:String(profile.timezone??'Asia/Jakarta'),locale:String(profile.locale??'en')});await onSaved();toast.success(locale==='ID'?'Profil diperbarui':'Profile updated')}
    catch(error){toast.error(error instanceof Error?error.message:(locale==='ID'?'Profil tidak dapat disimpan':'Could not save profile'))}
    finally{setSaving(false)}
  };
  return <div className="market-profile-quick"><div className="market-profile-quick-identity"><span className="market-profile-quick-avatar">{String(profile.display_name??profile.username??'V').slice(0,1).toUpperCase()}</span><span><strong>{String(profile.display_name||`@${profile.username}`)}</strong><small>@{String(profile.username??'')}</small></span></div><form className="market-quick-profile-form" onSubmit={submit}>
    <label>{locale==='ID'?'Nama tampilan':'Display name'}<input required minLength={2} maxLength={50} value={displayName} onChange={event=>setDisplayName(event.target.value)}/></label>
    <label>{locale==='ID'?'Nomor telepon':'Phone number'}<input type="tel" maxLength={24} value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+62"/></label>
    <button className="button primary" type="submit" disabled={saving}><User size={16}/>{saving?(locale==='ID'?'Menyimpan…':'Saving…'):(locale==='ID'?'Simpan perubahan':'Save changes')}</button>
  </form><Link className="market-quick-secondary" href="/profile">{locale==='ID'?'Pengaturan akun':'Account settings'}<ArrowRight size={15}/></Link></div>;
}
