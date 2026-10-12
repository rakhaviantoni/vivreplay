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
import {MarketActivityEmpty} from './vault/tabs/market-activity-state';
import {PhoneInput} from '@/components/tcg/phone-input';
import {BuyerFeeInfo} from '@/components/tcg/market-buyer-fee-cap-table';

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
  const choose=(value:MarketAccountPanel)=>onPanelChange(value);
  return <><Dialog open={Boolean(panel)} onOpenChange={onOpenChange}><DialogContent className="market-account-dialog market-account-unified">
    <header className="market-account-unified-heading">
      <div className="market-account-unified-avatar">{String(profile.display_name??profile.username??'V').slice(0,1).toUpperCase()}</div>
      <div><DialogHeader><DialogTitle>{String(profile.display_name||`@${profile.username}`)}</DialogTitle><DialogDescription>@{String(profile.username??'')}</DialogDescription></DialogHeader></div>
      {String(profile.tier??'free').toLowerCase()==='pro'&&<span className="market-pro-user-badge"><Crown size={13} weight="fill"/>Pro</span>}
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
    {cards.length?<div className="market-quick-vault-list">{cards.map(({source,item})=><div className="market-quick-vault-row" key={source.id}><Link href={`/cards/${encodeURIComponent(item.card.code)}`} className="market-quick-vault-art" onClick={()=>onOpenChange(false)} aria-label={`${locale==='ID'?'Lihat':'View'} ${item.card.name}`}><CardArt card={item.card}/></Link><Link href={`/cards/${encodeURIComponent(item.card.code)}`} className="market-quick-vault-copy" onClick={()=>onOpenChange(false)}><strong>{item.card.name}</strong><small>{item.card.code} | {item.language??item.card.language??'EN'} | ×{item.quantity}</small></Link><button type="button" className="market-quick-vault-edit" onClick={()=>onEdit(item)} aria-label={`${locale==='ID'?'Edit':'Edit'} ${item.card.name}`} title={locale==='ID'?'Edit kartu':'Edit card'}><Pencil size={16}/></button></div>)}</div>:<MarketActivityEmpty title={locale==='ID'?'Koleksi masih kosong':'Your Vault is empty'} description={locale==='ID'?'Tambahkan kartu untuk mulai mengelola koleksi.':'Add cards to start managing your collection.'} action={<button type="button" className="market-activity-empty-action" onClick={()=>onEdit(null)}><Plus size={14}/>{locale==='ID'?'Tambah kartu':'Add cards'}</button>}/>}
    <div className="market-quick-vault-actions">{cards.length>0&&<button type="button" className="button primary" onClick={()=>onEdit(null)}><Plus size={16}/>{locale==='ID'?'Tambah kartu':'Add card'}</button>}<Link className="market-quick-secondary" href="/decks" onClick={()=>onOpenChange(false)}>{locale==='ID'?`Deck (${account.decks.length})`:`Decks (${account.decks.length})`}<ArrowRight size={15}/></Link></div>
  </>;
}

type ProfileQuickTab='account'|'delivery'|'membership'|'payouts';
function ProfileQuickEdit({profile,locale,onSaved}:{profile:Record<string,unknown>;locale:'EN'|'ID';onSaved:()=>Promise<void>|void}){
  const [displayName,setDisplayName]=useState(String(profile.display_name??''));
  const [phone,setPhone]=useState(String(profile.phone??''));
  const [preferredLocale,setPreferredLocale]=useState(String(profile.locale??'en'));
  const [currency,setCurrency]=useState(String(profile.currency??'IDR'));
  const [saving,setSaving]=useState(false);
  const [tab,setTab]=useState<ProfileQuickTab>('account');
  const [shipping,setShipping]=useState<Record<string,unknown>|null>(null);
  const [addressEditing,setAddressEditing]=useState(false);
  const [addressSaving,setAddressSaving]=useState(false);
  const [addressDraft,setAddressDraft]=useState({recipientName:String(profile.display_name??''),phone:String(profile.phone??''),addressLine:'',city:'',postalCode:''});
  const [proOrders,setProOrders]=useState<{id:string;status:string;amount:number;currency:string;createdAt:string;paidAt:string|null}[]>([]);
  const [payoutAccounts,setPayoutAccounts]=useState<{id:string;bankName:string;accountHolder:string;lastFour:string;isDefault:boolean}[]>([]);
  const [payoutEditing,setPayoutEditing]=useState(false);
  const [payoutSaving,setPayoutSaving]=useState(false);
  const [payoutDraft,setPayoutDraft]=useState({id:'',bankName:'',accountHolder:'',accountNumber:'',makeDefault:true});
  const [proPlan,setProPlan]=useState<{amount:number|null;durationDays:number|null;introOffer:boolean;introOfferEndsAt:string|null;introOfferLimit:number|null;standardAmount:number|null;shippingVouchersPerMonth:number;shippingVoucherSharePercent:number;shippingVoucherCap:number;shippingVoucherMinSubtotal:number}|null>(null);
  const [proSubmitting,setProSubmitting]=useState(false);
  const [confirmingPro,setConfirmingPro]=useState(false);
  const isPro=String(profile.tier??'free').toLowerCase()==='pro';
  const t=(en:string,id:string)=>locale==='ID'?id:en;
  const proPrice=proPlan?.amount!=null?new Intl.NumberFormat(locale==='ID'?'id-ID':'en-US',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(proPlan.amount):'IDR 24,900';
  const proIntroEndLabel=proPlan?.introOfferEndsAt?new Intl.DateTimeFormat(locale==='ID'?'id-ID':'en-US',{dateStyle:'medium',timeZone:'Asia/Jakarta'}).format(new Date(proPlan.introOfferEndsAt)):'';
  const proStandardPrice=new Intl.NumberFormat(locale==='ID'?'id-ID':'en-US',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(proPlan?.standardAmount??24900);
  const proIntroTerms=proPlan?.introOffer?(proPlan.introOfferLimit&&proIntroEndLabel?t(`Limited to ${proPlan.introOfferLimit} checkouts until ${proIntroEndLabel}. Then ${proStandardPrice} per 30 days. Renew manually.`,`Maksimal ${proPlan.introOfferLimit} checkout sampai ${proIntroEndLabel}. Setelah itu ${proStandardPrice} per 30 hari. Perpanjang manual.`):proPlan.introOfferLimit?t(`Limited to ${proPlan.introOfferLimit} checkouts. Then ${proStandardPrice} per 30 days. Renew manually.`,`Maksimal ${proPlan.introOfferLimit} checkout. Setelah itu ${proStandardPrice} per 30 hari. Perpanjang manual.`):proIntroEndLabel?t(`Available until ${proIntroEndLabel}. Then ${proStandardPrice} per 30 days. Renew manually.`,`Berlaku sampai ${proIntroEndLabel}. Setelah itu ${proStandardPrice} per 30 hari. Perpanjang manual.`):t(`First month ${proPrice}, then ${proStandardPrice} per 30 days. Renew manually.`,`Bulan pertama ${proPrice}, lalu ${proStandardPrice} per 30 hari. Perpanjang manual.`)):'';
  const loadShipping=async()=>{try{const value=await api<{origin:Record<string,unknown>|null}>('/api/shipping/origin');setShipping(value.origin);if(value.origin)setAddressDraft({recipientName:String(value.origin.recipientName??''),phone:String(value.origin.phone??''),addressLine:String(value.origin.addressLine??''),city:String(value.origin.city??''),postalCode:String(value.origin.postalCode??'')})}catch{setShipping(null)}};
  const loadPayoutAccounts=async()=>{try{const value=await api<{accounts:typeof payoutAccounts}>('/api/profile/bank-accounts');setPayoutAccounts(value.accounts??[])}catch{setPayoutAccounts([])}};
  useEffect(()=>{
    let active=true;
    Promise.all([
      api<{origin:Record<string,unknown>|null}>('/api/shipping/origin').catch(()=>({origin:null})),
      fetch('/api/checkout/pro/orders',{cache:'no-store'}).then(response=>response.ok?response.json() as Promise<{orders?:typeof proOrders}>:{orders:[]}).catch(()=>({orders:[]})),
      api<{accounts:typeof payoutAccounts}>('/api/profile/bank-accounts').catch(()=>({accounts:[]})),
      api<typeof proPlan>('/api/checkout/pro').catch(()=>null),
    ]).then(([shippingResult,ordersResult,payoutResult,planResult])=>{
      if(!active)return;
      setShipping(shippingResult.origin);
      setAddressDraft({recipientName:String(shippingResult.origin?.recipientName??profile.display_name??''),phone:String(shippingResult.origin?.phone??profile.phone??''),addressLine:String(shippingResult.origin?.addressLine??''),city:String(shippingResult.origin?.city??''),postalCode:String(shippingResult.origin?.postalCode??'')});
      setProOrders(Array.isArray(ordersResult.orders)?ordersResult.orders:[]);
      setPayoutAccounts(payoutResult.accounts??[]);
      setProPlan(planResult);
    });
    return()=>{active=false};
  },[profile.display_name,profile.phone]);
  const pendingProCount=proOrders.filter(order=>order.status==='PENDING_PAYMENT').length;
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setSaving(true);
    try{await api('/api/profile',{username:String(profile.username??''),displayName,phone,region:String(profile.region??'ID'),currency,timezone:String(profile.timezone??'Asia/Jakarta'),locale:preferredLocale});await onSaved();toast.success(locale==='ID'?'Profil diperbarui':'Profile updated')}
    catch(error){toast.error(error instanceof Error?error.message:(locale==='ID'?'Profil tidak dapat disimpan':'Could not save profile'))}
    finally{setSaving(false)}
  };
  const saveAddress=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setAddressSaving(true);const sameLocation=shipping?.postalCode===addressDraft.postalCode&&shipping?.city===addressDraft.city;const savedRegions=shipping?.regionNames&&typeof shipping.regionNames==='object'?shipping.regionNames as Record<string,string>:{};try{await api('/api/shipping/origin',{...addressDraft,areaId:sameLocation?shipping?.areaId:null,latitude:sameLocation?shipping?.latitude:null,longitude:sameLocation?shipping?.longitude:null,shippingMethods:shipping?.shippingMethods??['jnt','jne'],regions:{...savedRegions,city:addressDraft.city}},'POST');await loadShipping();setAddressEditing(false);window.dispatchEvent(new Event('vivreplay:shipping-updated'));toast.success(t('Delivery address saved','Alamat pengiriman disimpan'))}catch(error){toast.error(error instanceof Error?error.message:t('Could not save address','Alamat tidak dapat disimpan'))}finally{setAddressSaving(false)}};
  const savePayout=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setPayoutSaving(true);try{await api('/api/profile/bank-accounts',{...(payoutDraft.id?{id:payoutDraft.id}:{}),bankName:payoutDraft.bankName,accountHolder:payoutDraft.accountHolder,...(payoutDraft.accountNumber?{accountNumber:payoutDraft.accountNumber}:{}),makeDefault:payoutDraft.makeDefault},'POST');await loadPayoutAccounts();setPayoutEditing(false);setPayoutDraft({id:'',bankName:'',accountHolder:'',accountNumber:'',makeDefault:true});toast.success(t('Payout account saved','Rekening pencairan disimpan'))}catch(error){toast.error(error instanceof Error?error.message:t('Could not save payout account','Rekening tidak dapat disimpan'))}finally{setPayoutSaving(false)}};
  const beginProCheckout=async()=>{if(!phone.trim()){setTab('account');toast.error(t('Add your phone number in Account to continue.','Tambahkan nomor telepon di bagian Akun untuk melanjutkan.'));return}setProSubmitting(true);try{const result=await api<{checkoutUrl:string}>('/api/checkout/pro',{introOffer:Boolean(proPlan?.introOffer)});window.location.assign(result.checkoutUrl)}catch(error){toast.error(error instanceof Error?error.message:t('Could not start checkout','Checkout tidak dapat dimulai'));setProSubmitting(false)}};
  return <div className="market-profile-quick">
    <nav className="market-profile-quick-tabs" role="tablist" aria-label={t('Profile sections','Bagian profil')}>
      {(['account','delivery','membership','payouts'] as const).map(key=><button type="button" role="tab" aria-selected={tab===key} key={key} className={tab===key?'is-active':''} onClick={()=>setTab(key)}>
        {key==='account'?<User size={15}/>:key==='delivery'?<Truck size={15}/>:key==='membership'?<Crown size={15}/>:<Wallet size={15}/>}
        <span>{key==='account'?t('Account','Akun'):key==='delivery'?t('Delivery','Pengiriman'):key==='membership'?'Market Pro':t('Payouts','Pencairan')}</span>
        {key==='membership'&&pendingProCount>0&&<b className="market-activity-badge">{pendingProCount>99?'99+':pendingProCount}</b>}
      </button>)}
    </nav>
    {tab==='account'&&<form className="market-quick-profile-form" onSubmit={submit}>
      <label>{t('Display name','Nama tampilan')}<input required minLength={2} maxLength={50} value={displayName} onChange={event=>setDisplayName(event.target.value)}/></label>
      <PhoneInput label={t('Phone number','Nomor telepon')} value={phone} onChange={setPhone} locale={locale}/>
      <label>{t('Language','Bahasa')}<select value={preferredLocale} onChange={event=>setPreferredLocale(event.target.value)}><option value="en">English</option><option value="id">Bahasa Indonesia</option></select></label>
      <label>{t('Currency','Mata uang')}<select value={currency} onChange={event=>setCurrency(event.target.value)}><option value="IDR">IDR</option><option value="USD">USD</option><option value="JPY">JPY</option></select></label>
      <button className="button primary" type="submit" disabled={saving}><User size={16}/>{saving?t('Saving…','Menyimpan…'):t('Save changes','Simpan perubahan')}</button>
    </form>}
    {tab==='delivery'&&<section className="market-profile-quick-section">
      <div className="market-profile-quick-card">
        <span className="market-profile-quick-card-icon"><MapPin size={18}/></span>
        <div><strong>{shipping?t('Default delivery address','Alamat pengiriman utama'):t('No delivery address saved','Belum ada alamat pengiriman')}</strong>
          {shipping?<><p>{String(shipping.recipientName??'')}{shipping.phone?` | ${String(shipping.phone)}`:''}</p><p>{[shipping.addressLine,shipping.regionNames&&typeof shipping.regionNames==='object'?Object.values(shipping.regionNames as Record<string,string>).filter(Boolean).join(', '):'',shipping.city,shipping.postalCode].filter(Boolean).join(', ')}</p><small>{t('Used for shipping at checkout.','Digunakan untuk pengiriman saat checkout.')}</small></>:<p>{t('Add an address to get delivery rates at checkout.','Tambahkan alamat untuk melihat ongkir saat checkout.')}</p>}
        </div>
        <button type="button" className="market-profile-quick-edit-link" onClick={()=>setAddressEditing(value=>!value)}><Pencil size={15}/>{t(shipping?'Edit address':'Add address',shipping?'Ubah alamat':'Tambah alamat')}</button>
      </div>
      {addressEditing&&<form className="market-quick-profile-form market-quick-address-form" onSubmit={event=>void saveAddress(event)}>
        <label>{t('Recipient','Penerima')}<input required minLength={2} maxLength={100} autoComplete="name" value={addressDraft.recipientName} onChange={event=>setAddressDraft({...addressDraft,recipientName:event.target.value})}/></label>
        <PhoneInput required label={t('Phone number','Nomor telepon')} autoComplete="tel" value={addressDraft.phone} onChange={value=>setAddressDraft({...addressDraft,phone:value})} locale={locale}/>
        <label className="market-quick-address-wide">{t('Street address','Alamat jalan')}<textarea required minLength={5} maxLength={260} rows={3} autoComplete="street-address" value={addressDraft.addressLine} onChange={event=>setAddressDraft({...addressDraft,addressLine:event.target.value})}/></label>
        <label>{t('City / Regency','Kota / Kabupaten')}<input required autoComplete="address-level2" value={addressDraft.city} onChange={event=>setAddressDraft({...addressDraft,city:event.target.value})}/></label>
        <label>{t('Postal code','Kode pos')}<input required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="postal-code" value={addressDraft.postalCode} onChange={event=>setAddressDraft({...addressDraft,postalCode:event.target.value.replace(/\D/g,'').slice(0,5)})}/></label>
        <div className="market-quick-form-actions"><button type="button" className="market-quick-secondary" onClick={()=>setAddressEditing(false)}>{t('Cancel','Batal')}</button><button className="button primary" type="submit" disabled={addressSaving}>{addressSaving?t('Saving…','Menyimpan…'):t('Save address','Simpan alamat')}</button></div>
      </form>}
    </section>}
    {tab==='membership'&&<div className="market-membership-quick">
      <div className="market-profile-quick-card"><span className="market-profile-quick-card-icon"><Crown size={18}/></span><div>
        <strong>{isPro?t('Market Pro is active','Market Pro aktif'):t('Free plan','Paket Free')}</strong>
        <p>{isPro&&profile.pro_expires_at?t(`Active until ${new Date(String(profile.pro_expires_at)).toLocaleDateString()}`,`Aktif sampai ${new Date(String(profile.pro_expires_at)).toLocaleDateString('id-ID')}`):isPro?t('Lower fees and more room to list.','Biaya lebih rendah dan kuota listing lebih besar.'):t('Lower fees, more listings, and monthly shipping vouchers.','Biaya lebih rendah, listing lebih banyak, dan voucher ongkir bulanan.')}</p>
      </div></div>
      <div className="market-membership-compare" aria-label={t('Free and Pro plan comparison','Perbandingan paket Free dan Pro')}>
        <div className="market-membership-compare-head"><span></span><strong>Free</strong><strong>Pro</strong></div>
        <div><span>{t('Active listings','Listing aktif')}</span><b>25</b><b>2,500</b></div>
        <div><span>{t('Listing period','Masa listing')}</span><b>7 {t('days','hari')}</b><b>30 {t('days','hari')}</b></div>
        <div><span>{t('Seller fee','Biaya penjual')}</span><b>1%</b><b>0.5%</b></div>
        <div><span className="buyer-fee-row-label">{t('Buyer fee','Biaya pembeli')}<BuyerFeeInfo locale={locale==='ID'?'id':'en'}/></span><b>1.5%</b><b>0.75%</b></div>
        <div><span>{t('Delivery vouchers','Voucher ongkir')}</span><b>—</b><b>2 / {t('month','bulan')}</b></div>
      </div>
      <p className="market-membership-compare-note">{t(`${proPlan?.shippingVouchersPerMonth??2} delivery vouchers each month. Each saves ${proPlan?.shippingVoucherSharePercent??50}% on delivery, up to IDR ${(proPlan?.shippingVoucherCap??5000).toLocaleString('en-US')}, on card orders of IDR ${(proPlan?.shippingVoucherMinSubtotal??200000).toLocaleString('en-US')} or more.`,`${proPlan?.shippingVouchersPerMonth??2} voucher ongkir tiap bulan. Hemat ${proPlan?.shippingVoucherSharePercent??50}% hingga IDR ${(proPlan?.shippingVoucherCap??5000).toLocaleString('id-ID')} per voucher, untuk pesanan kartu minimal IDR ${(proPlan?.shippingVoucherMinSubtotal??200000).toLocaleString('id-ID')}.`)}</p>
      <div className="market-membership-quick-actions">
        {!isPro&&!confirmingPro&&<><strong className="market-membership-quick-price">{proPrice}<small> / {proPlan?.durationDays??30} {t('days','hari')}</small></strong>{proIntroTerms&&<small className="market-membership-intro-note">{proIntroTerms}</small>}<button type="button" className="button primary" onClick={()=>setConfirmingPro(true)}><Crown size={16}/>{t('Get Market Pro','Dapatkan Market Pro')}<ArrowRight size={15}/></button></>}
        {!isPro&&confirmingPro&&<div className="market-pro-purchase-confirm" role="group" aria-label={t('Confirm Market Pro checkout','Konfirmasi checkout Market Pro')}><p>{t(`Start Market Pro for ${proPrice} / ${proPlan?.durationDays??30} days?`,`Mulai Market Pro seharga ${proPrice} untuk ${proPlan?.durationDays??30} hari?`)}</p>{proIntroTerms&&<small className="market-membership-intro-note">{proIntroTerms}</small>}<div><button type="button" className="market-quick-secondary" onClick={()=>setConfirmingPro(false)}>{t('Back','Kembali')}</button><button type="button" className="button primary" onClick={()=>void beginProCheckout()} disabled={proSubmitting}>{proSubmitting?t('Opening checkout…','Membuka checkout…'):t('Continue to payment','Lanjut ke pembayaran')}</button></div></div>}
      </div>
      <section className="market-membership-history"><h3>{t('Plan history','Riwayat paket')}</h3>
        {proOrders.length?<div className="market-membership-history-list">{proOrders.map(order=><Link href={`/checkout/order/${order.id}`} className="market-membership-history-row" key={order.id}>
          <span><strong>Market Pro</strong><small>{new Date(order.createdAt).toLocaleDateString(locale==='ID'?'id-ID':'en-US',{year:'numeric',month:'short',day:'numeric'})}</small></span>
          <b>{order.status==='PAID'?t('Paid','Dibayar'):order.status==='PENDING_PAYMENT'?t('Awaiting payment','Menunggu pembayaran'):order.status==='EXPIRED'?t('Expired','Kedaluwarsa'):order.status==='CANCELLED'?t('Cancelled','Dibatalkan'):order.status}</b>
          <strong>{new Intl.NumberFormat(locale==='ID'?'id-ID':'en-US',{style:'currency',currency:order.currency||'IDR',maximumFractionDigits:0}).format(order.amount)}</strong>
        </Link>)}</div>:<MarketActivityEmpty title={t('No plan payments yet','Belum ada pembayaran paket')} description={t('Your Market Pro payments will appear here.','Pembayaran Market Pro akan muncul di sini.')}/>}
      </section>
    </div>}
    {tab==='payouts'&&<section className="market-payout-quick">
      <div className="market-payout-quick-heading"><div><strong>{t('Payout accounts','Rekening pencairan')}</strong><p>{t('Choose where your sale proceeds are sent.','Pilih rekening tujuan hasil penjualan.')}</p></div>
        <button type="button" className="market-profile-quick-edit-link" onClick={()=>{setPayoutDraft({id:'',bankName:'',accountHolder:String(profile.display_name??''),accountNumber:'',makeDefault:payoutAccounts.length===0});setPayoutEditing(true)}}><Plus size={15}/>{t('Add account','Tambah rekening')}</button>
      </div>
      {payoutAccounts.length?<div className="market-payout-account-list">{payoutAccounts.map(account=><article className="market-payout-account-row" key={account.id}>
        <Wallet size={17}/><div><strong>{account.bankName}</strong><small>{account.accountHolder} | •••• {account.lastFour}</small></div>
        {account.isDefault?<span className="market-payout-default">{t('Default','Utama')}</span>:<button type="button" className="market-profile-quick-edit-link" onClick={async()=>{try{await api('/api/profile/bank-accounts',{id:account.id},'PATCH');await loadPayoutAccounts()}catch(error){toast.error(error instanceof Error?error.message:t('Could not update account','Rekening tidak dapat diperbarui'))}}}>{t('Set default','Jadikan utama')}</button>}
        <button type="button" className="market-quick-vault-edit" aria-label={t('Edit payout account','Ubah rekening pencairan')} onClick={()=>{setPayoutDraft({id:account.id,bankName:account.bankName,accountHolder:account.accountHolder,accountNumber:'',makeDefault:account.isDefault});setPayoutEditing(true)}}><Pencil size={15}/></button>
      </article>)}</div>:<MarketActivityEmpty title={t('No payout account','Belum ada rekening')} description={t('Add a bank account to receive sales payouts.','Tambahkan rekening bank untuk menerima hasil penjualan.')} action={<button type="button" className="market-activity-empty-action" onClick={()=>{setPayoutDraft({id:'',bankName:'',accountHolder:String(profile.display_name??''),accountNumber:'',makeDefault:true});setPayoutEditing(true)}}><Plus size={14}/>{t('Add bank account','Tambah rekening bank')}</button>}/>}
      {payoutEditing&&<form className="market-quick-profile-form market-payout-quick-form" onSubmit={event=>void savePayout(event)}>
        <label>{t('Bank','Bank')}<input required minLength={2} maxLength={80} value={payoutDraft.bankName} onChange={event=>setPayoutDraft({...payoutDraft,bankName:event.target.value})}/></label>
        <label>{t('Account holder','Nama pemilik rekening')}<input required minLength={2} maxLength={120} value={payoutDraft.accountHolder} onChange={event=>setPayoutDraft({...payoutDraft,accountHolder:event.target.value})}/></label>
        <label className="market-payout-number-field">{t('Account number','Nomor rekening')}<input required={!payoutDraft.id} inputMode="numeric" minLength={6} maxLength={34} value={payoutDraft.accountNumber} onChange={event=>setPayoutDraft({...payoutDraft,accountNumber:event.target.value.replace(/\D/g,'')})} placeholder={payoutDraft.id?t('Leave blank to keep the current number','Kosongkan untuk tetap memakai nomor saat ini'):''}/></label>
        <label className="market-payout-default-toggle"><input type="checkbox" checked={payoutDraft.makeDefault} onChange={event=>setPayoutDraft({...payoutDraft,makeDefault:event.target.checked})}/>{t('Use as default payout account','Jadikan rekening pencairan utama')}</label>
        <div className="market-quick-form-actions"><button type="button" className="market-quick-secondary" onClick={()=>setPayoutEditing(false)}>{t('Cancel','Batal')}</button><button type="submit" className="button primary" disabled={payoutSaving}>{payoutSaving?t('Saving…','Menyimpan…'):t('Save account','Simpan rekening')}</button></div>
      </form>}
    </section>}
    <Link className="market-quick-secondary" href="/profile">{t('Full profile settings','Pengaturan profil lengkap')}<ArrowRight size={15}/></Link>
  </div>;
}
