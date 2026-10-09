'use client';

import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowRightIcon as ArrowRight,BookmarkSimpleIcon as Bookmark,CardsIcon as VaultIcon,ChatCircleDotsIcon as OffersIcon,ClipboardTextIcon as ListingsIcon,CrownSimpleIcon as Crown,HeartIcon as Heart,MapPinIcon as MapPin,PencilSimpleIcon as Pencil,PlusIcon as Plus,ShoppingBagIcon as OrdersIcon,TruckIcon as Truck,UserIcon as User,WalletIcon as Wallet} from '@phosphor-icons/react';
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
  const [editorOpen,setEditorOpen]=useState(false);
  const [editingItem,setEditingItem]=useState<EnrichedCollectionItem|null>(null);
  const profile=account.profile;
  const title=sections.find(([key])=>key===panel);
  const choose=(value:MarketAccountPanel)=>onPanelChange(value);
  return <><Dialog open={Boolean(panel)} onOpenChange={onOpenChange}><DialogContent className="market-account-dialog market-account-unified">
    <header className="market-account-unified-heading">
      <div className="market-account-unified-avatar">{String(profile.display_name??profile.username??'V').slice(0,1).toUpperCase()}</div>
      <div><DialogHeader><DialogTitle>{String(profile.display_name||`@${profile.username}`)}</DialogTitle><DialogDescription>@{String(profile.username??'')}</DialogDescription></DialogHeader></div>
      {String(profile.tier??'free').toLowerCase()==='pro'&&<span className="market-pro-user-badge"><Crown size={13} weight="fill"/>Pro</span>}
      <strong className="market-account-section-title">{locale==='ID'?title?.[2]:title?.[1]}</strong>
    </header>
    <nav className="market-account-unified-tabs" role="tablist" aria-label={locale==='ID'?'Menu akun':'Account sections'}>
      {sections.map(([key,en,id,Icon])=><button key={key} type="button" role="tab" aria-selected={panel===key} className={panel===key?'is-active':''} onClick={()=>choose(key)}><Icon size={16}/><span>{locale==='ID'?id:en}</span>{key in activityCounts&&activityCounts[key as keyof ActivityCounts]>0&&<b className="market-activity-badge">{activityCounts[key as keyof ActivityCounts]>99?'99+':activityCounts[key as keyof ActivityCounts]}</b>}</button>)}
    </nav>
    <label className="market-account-mobile-select"><span>{locale==='ID'?'Bagian':'Section'}</span><select value={panel??'listings'} onChange={event=>choose(event.target.value as MarketAccountPanel)}>{sections.map(([key,en,id])=><option key={key} value={key}>{locale==='ID'?id:en}</option>)}</select></label>
    <div className={`market-account-unified-body is-${panel??'listings'}`} onClickCapture={event=>{if((event.target as HTMLElement).closest('a'))onOpenChange(false)}}>
      {panel==='listings'?<ListingsTab language={locale} onCreateListing={onCreateListing}/>:panel==='offers'?<OffersTab language={locale} initialConversationId={initialConversationId??undefined}/>:panel==='orders'?<OrdersTab language={locale} initialOrderId={initialOrderId??undefined}/>:panel==='saved'?<SavedListings language={locale}/>:panel==='vault'?<VaultQuickActions account={account} locale={locale} onOpenChange={onOpenChange} onEdit={item=>{setEditingItem(item);onOpenChange(false);setEditorOpen(true)}}/>:panel==='wishlist'?<WishlistTab wishlist={account.wishlist} language={locale} onUpdated={async()=>{await onRefresh()}} onRemoveFromWishlist={async printingId=>{try{await api('/api/wishlist',{printingId,saved:false});toast.success(locale==='ID'?'Dihapus dari wishlist':'Removed from wishlist');await onRefresh()}catch(error){toast.error(error instanceof Error?error.message:(locale==='ID'?'Kartu gagal dihapus':'Could not remove card'))}}}/>:panel==='profile'?<ProfileQuickEdit key={`${profile.id}:${profile.updated_at??''}`} profile={profile} locale={locale} onSaved={onSaved}/>:null}
    </div>
  </DialogContent></Dialog>
  <AddEditItemModal open={editorOpen} onClose={()=>{setEditorOpen(false);setEditingItem(null)}} onSaved={async()=>{await onRefresh();setEditorOpen(false);setEditingItem(null)}} editingItem={editingItem} language={locale}/>
  </>;
}

function VaultQuickActions({account,locale,onOpenChange,onEdit}:{account:AccountState;locale:'EN'|'ID';onOpenChange:(open:boolean)=>void;onEdit:(item:EnrichedCollectionItem|null)=>void}){
  const cards=account.collection.slice(0,6).map(item=>({source:item,item:enrichCollectionItem(item,new Set())}));
  const total=account.collection.reduce((sum,item)=>sum+(item.type==='GRADED'?1:item.quantity),0);
  return <>
    <div className="market-vault-quick-summary"><div><strong>{total.toLocaleString(locale==='ID'?'id-ID':'en-US')}</strong><span>{locale==='ID'?'kartu':'cards'}</span></div><div className="market-vault-summary-links"><Link href="/vault" onClick={()=>onOpenChange(false)}>{locale==='ID'?'Buka Vault':'Open Vault'}<ArrowRight size={15}/></Link><Link href="/vault?tab=portfolio" onClick={()=>onOpenChange(false)}>{locale==='ID'?'Portofolio':'Portfolio'}<ArrowRight size={15}/></Link></div></div>
    <div className="market-quick-vault-list">
      {cards.length?cards.map(({source,item})=><div className="market-quick-vault-row" key={source.id}><Link href={`/cards/${encodeURIComponent(item.card.code)}`} className="market-quick-vault-art" onClick={()=>onOpenChange(false)} aria-label={`${locale==='ID'?'Lihat':'View'} ${item.card.name}`}><CardArt card={item.card}/></Link><Link href={`/cards/${encodeURIComponent(item.card.code)}`} className="market-quick-vault-copy" onClick={()=>onOpenChange(false)}><strong>{item.card.name}</strong><small>{item.card.code} | {item.language??item.card.language??'EN'} | ×{item.quantity}</small></Link><button type="button" className="market-quick-vault-edit" onClick={()=>onEdit(item)} aria-label={`${locale==='ID'?'Edit':'Edit'} ${item.card.name}`} title={locale==='ID'?'Edit kartu':'Edit card'}><Pencil size={16}/></button></div>):<p className="market-quick-vault-empty">{locale==='ID'?'Koleksi Anda masih kosong.':'Your collection is empty.'}</p>}
    </div>
    <div className="market-quick-vault-actions"><button type="button" className="button primary" onClick={()=>onEdit(null)}><Plus size={16}/>{locale==='ID'?'Tambah kartu':'Add card'}</button><Link className="market-quick-secondary" href="/decks" onClick={()=>onOpenChange(false)}>{locale==='ID'?`Deck (${account.decks.length})`:`Decks (${account.decks.length})`}<ArrowRight size={15}/></Link></div>
  </>;
}

type ProfileQuickTab='account'|'delivery'|'membership'|'payouts';
function ProfileQuickEdit({profile,locale,onSaved}:{profile:Record<string,unknown>;locale:'EN'|'ID';onSaved:()=>Promise<void>|void}){
  const [displayName,setDisplayName]=useState(String(profile.display_name??''));
  const [phone,setPhone]=useState(String(profile.phone??''));
  const [saving,setSaving]=useState(false);
  const [tab,setTab]=useState<ProfileQuickTab>('account');
  const [shipping,setShipping]=useState<Record<string,unknown>|null>(null);
  const [pendingProCount,setPendingProCount]=useState(0);
  const isPro=String(profile.tier??'free').toLowerCase()==='pro';
  const t=(en:string,id:string)=>locale==='ID'?id:en;
  useEffect(()=>{let live=true;api<{origin:Record<string,unknown>|null}>('/api/shipping/origin').then(value=>{if(live)setShipping(value.origin)}).catch(()=>{if(live)setShipping(null)});fetch('/api/checkout/pro/orders',{cache:'no-store'}).then(response=>response.ok?response.json() as Promise<{orders?:{status?:string}[]}>:null).then(value=>{if(live&&value&&Array.isArray(value.orders))setPendingProCount(value.orders.filter(order=>order.status==='PENDING_PAYMENT').length)}).catch(()=>undefined);return()=>{live=false}},[]);
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setSaving(true);
    try{await api('/api/profile',{username:String(profile.username??''),displayName,phone,region:String(profile.region??'ID'),currency:String(profile.currency??'IDR'),timezone:String(profile.timezone??'Asia/Jakarta'),locale:String(profile.locale??'en')});await onSaved();toast.success(locale==='ID'?'Profil diperbarui':'Profile updated')}
    catch(error){toast.error(error instanceof Error?error.message:(locale==='ID'?'Profil tidak dapat disimpan':'Could not save profile'))}
    finally{setSaving(false)}
  };
  return <div className="market-profile-quick"><div className="market-profile-quick-identity"><span className="market-profile-quick-avatar">{String(profile.display_name??profile.username??'V').slice(0,1).toUpperCase()}</span><span><strong>{String(profile.display_name||`@${profile.username}`)}</strong><small>@{String(profile.username??'')}</small></span>{isPro&&<span className="market-pro-user-badge"><Crown size={13} weight="fill"/>Pro</span>}</div>
    <nav className="market-profile-quick-tabs" role="tablist" aria-label={t('Profile sections','Bagian profil')}>{(['account','delivery','membership','payouts'] as const).map(key=><button type="button" role="tab" aria-selected={tab===key} key={key} className={tab===key?'is-active':''} onClick={()=>setTab(key)}>{key==='account'?<User size={15}/>:key==='delivery'?<Truck size={15}/>:key==='membership'?<Crown size={15}/>:<Wallet size={15}/>}<span>{key==='account'?t('Account','Akun'):key==='delivery'?t('Delivery','Pengiriman'):key==='membership'?'Market Pro':t('Payouts','Pencairan')}</span>{key==='membership'&&pendingProCount>0&&<b className="market-activity-badge">{pendingProCount>99?'99+':pendingProCount}</b>}</button>)}</nav>
    {tab==='account'?<form className="market-quick-profile-form" onSubmit={submit}>
      <label>{t('Display name','Nama tampilan')}<input required minLength={2} maxLength={50} value={displayName} onChange={event=>setDisplayName(event.target.value)}/></label>
      <label>{t('Phone number','Nomor telepon')}<input type="tel" maxLength={24} value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+62"/></label>
      <button className="button primary" type="submit" disabled={saving}><User size={16}/>{saving?t('Saving…','Menyimpan…'):t('Save changes','Simpan perubahan')}</button>
    </form>:tab==='delivery'?<div className="market-profile-quick-card"><span className="market-profile-quick-card-icon"><MapPin size={18}/></span><div><strong>{shipping?String(shipping.label??t('Delivery address','Alamat pengiriman')):t('No delivery address saved','Belum ada alamat pengiriman')}</strong><p>{shipping?[shipping.addressLine,shipping.city,shipping.postalCode].filter(Boolean).join(', '):t('Add an address to get delivery rates at checkout.','Tambahkan alamat untuk melihat ongkir saat checkout.')}</p>{shipping&&<small>{String(shipping.recipientName??'')}{shipping.phone?` | ${String(shipping.phone)}`:''}</small>}</div><Link href="/profile?tab=shipping" className="market-profile-quick-edit-link"><Pencil size={15}/>{t('Edit','Ubah')}</Link></div>:tab==='membership'?<div className="market-membership-quick"><div className="market-profile-quick-card"><span className="market-profile-quick-card-icon"><Crown size={18}/></span><div><strong>{isPro?t('Market Pro is active','Market Pro aktif'):t('Free plan','Paket Free')}</strong><p>{isPro&&profile.pro_expires_at?t(`Active until ${new Date(String(profile.pro_expires_at)).toLocaleDateString()}`,`Aktif sampai ${new Date(String(profile.pro_expires_at)).toLocaleDateString('id-ID')}`):isPro?t('Lower fees and more room to list.','Biaya lebih rendah dan kuota listing lebih besar.'):t('Lower fees, more listings, and monthly shipping vouchers.','Biaya lebih rendah, listing lebih banyak, dan voucher ongkir bulanan.')}</p></div><Link href="/checkout/pro" className="market-profile-quick-edit-link">{t(isPro?'Manage':'See plans',isPro?'Kelola':'Lihat paket')}</Link></div><div className="market-membership-compare" aria-label={t('Free and Pro plan comparison','Perbandingan paket Free dan Pro')}><div className="market-membership-compare-head"><span></span><strong>Free</strong><strong>Pro</strong></div><div><span>{t('Active listings','Listing aktif')}</span><b>25</b><b>2,500</b></div><div><span>{t('Listing period','Masa listing')}</span><b>7 {t('days','hari')}</b><b>30 {t('days','hari')}</b></div><div><span>{t('Seller fee','Biaya penjual')}</span><b>1.5%</b><b>0.75%</b></div><div><span>{t('Buyer fee','Biaya pembeli')}</span><b>0.75%</b><b>0.5%</b></div><div><span>{t('Delivery vouchers','Voucher ongkir')}</span><b>—</b><b>2 / {t('month','bulan')}</b></div></div></div>:<div className="market-profile-quick-card"><span className="market-profile-quick-card-icon"><Wallet size={18}/></span><div><strong>{t('Payout account','Rekening pencairan')}</strong><p>{t('Manage where your sales are paid out.','Atur rekening untuk pencairan hasil penjualan.')}</p></div><Link href="/profile?tab=bank" className="market-profile-quick-edit-link">{t('Manage','Kelola')}</Link></div>}
    <Link className="market-quick-secondary" href="/profile">{t('Full profile settings','Pengaturan profil lengkap')}<ArrowRight size={15}/></Link></div>;
}
