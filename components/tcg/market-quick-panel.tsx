'use client';

import {useCallback,useEffect,useState,type FormEvent} from 'react';
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
import {BuyerFeeInfo,SellerFeeInfo} from '@/components/tcg/market-buyer-fee-cap-table';
import {MARKET_BUYER_FEE_MINIMUM,MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL} from '@/lib/market/policy';
import {MapPicker} from './map-picker';
import {enabledShippingCouriers} from '@/lib/shipping/couriers';
import {INDONESIAN_REGIONS,getCities,getDistricts,getSubdistricts} from '@/lib/indonesia-areas';
import {formatDateTimeWithOffset} from '@/components/tcg/market-timestamp';
import {MarketPaymentMethodPicker,defaultPaymentOptions,estimatePaymentFee,type PaymentMethod,type PaymentOption} from '@/components/tcg/market-payment-method-picker';

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

export function MarketQuickPanel({panel,onOpenChange,onPanelChange,locale,account,activityCounts,onSaved,onRefresh=()=>{},onCreateListing,initialOrderId,initialConversationId,initialProfileTab='account'}:{panel:MarketAccountPanel|null;onOpenChange:(open:boolean)=>void;onPanelChange:(panel:MarketAccountPanel)=>void;locale:'EN'|'ID';account:AccountState;activityCounts:ActivityCounts;onSaved:()=>Promise<void>|void;onRefresh?:()=>Promise<void>|void;onCreateListing:()=>void;initialOrderId?:string|null;initialConversationId?:string|null;initialProfileTab?:ProfileQuickTab}){
  const [editorOpen,setEditorOpen]=useState(false);
  const [editingItem,setEditingItem]=useState<EnrichedCollectionItem|null>(null);
  const profile=account.profile;
  const choose=(value:MarketAccountPanel)=>onPanelChange(value);
  return <><Dialog open={Boolean(panel)} onOpenChange={onOpenChange}><DialogContent className="market-account-dialog market-account-unified">
    <header className="market-account-unified-heading">
      <div className="market-account-unified-avatar">{String(profile.display_name??profile.username??'V').slice(0,1).toUpperCase()}</div>
      <div><DialogHeader><DialogTitle>{String(profile.display_name||(locale==='ID'?'Akun':'Account'))}</DialogTitle><DialogDescription>@{String(profile.username??'')}</DialogDescription></DialogHeader></div>
      {String(profile.tier??'free').toLowerCase()==='pro'&&<span className="market-pro-user-badge"><Crown size={13} weight="fill"/>Pro</span>}
    </header>
    <nav className="market-account-unified-tabs" role="tablist" aria-label={locale==='ID'?'Menu akun':'Account sections'}>
      {sections.map(([key,en,id,Icon])=><button key={key} type="button" role="tab" aria-selected={panel===key} className={panel===key?'is-active':''} onClick={()=>choose(key)}><Icon size={16}/><span>{locale==='ID'?id:en}</span>{key in activityCounts&&activityCounts[key as keyof ActivityCounts]>0&&<b className="market-activity-badge">{activityCounts[key as keyof ActivityCounts]>99?'99+':activityCounts[key as keyof ActivityCounts]}</b>}</button>)}
    </nav>
    <label className="market-account-mobile-select"><span>{locale==='ID'?'Bagian':'Section'}</span><select value={panel??'listings'} onChange={event=>choose(event.target.value as MarketAccountPanel)}>{sections.map(([key,en,id])=><option key={key} value={key}>{locale==='ID'?id:en}</option>)}</select></label>
    <div className={`market-account-unified-body is-${panel??'listings'}`} onClickCapture={event=>{if((event.target as HTMLElement).closest('a'))onOpenChange(false)}}>
      {panel==='listings'?<ListingsTab language={locale} timeZone={String(profile.timezone||'Asia/Jakarta')} onCreateListing={onCreateListing} onListingChanged={onRefresh}/>:panel==='offers'?<OffersTab key={initialConversationId??'offers'} language={locale} timeZone={String(profile.timezone||'Asia/Jakarta')} initialConversationId={initialConversationId??undefined}/>:panel==='orders'?<OrdersTab language={locale} initialOrderId={initialOrderId??undefined}/>:panel==='saved'?<SavedListings language={locale}/>:panel==='vault'?<VaultQuickActions account={account} locale={locale} onOpenChange={onOpenChange} onEdit={item=>{setEditingItem(item);onOpenChange(false);setEditorOpen(true)}}/>:panel==='wishlist'?<WishlistTab wishlist={account.wishlist} language={locale} onUpdated={async()=>{await onRefresh()}} onRemoveFromWishlist={async printingId=>{try{await api('/api/wishlist',{printingId,saved:false});toast.success(locale==='ID'?'Dihapus dari wishlist':'Removed from wishlist');await onRefresh()}catch(error){toast.error(error instanceof Error?error.message:(locale==='ID'?'Kartu gagal dihapus':'Could not remove card'))}}}/>:panel==='profile'?<ProfileQuickEdit key={`${profile.id}:${profile.updated_at??''}`} profile={profile} locale={locale} initialTab={initialProfileTab} onSaved={onSaved}/>:null}
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
const QUICK_COURIER_NAMES:Record<string,string>={jnt:'J&T Express',jne:'JNE Express',sicepat:'SiCepat',anteraja:'Anteraja',tiki:'TIKI',pos:'Pos Indonesia',lion:'Lion Parcel',ninja:'Ninja Xpress',wahana:'Wahana',grab:'GrabExpress',gojek:'GoSend'};
const QUICK_POPULAR_COURIERS=['jnt','jne','sicepat','grab','gojek'];
type QuickRegion={id:string;name:string;postalCode?:string|null;latitude?:number|null;longitude?:number|null};
const normalizeQuickRegion=(value:string)=>value.toLocaleLowerCase('id').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^(provinsi|province|kota administrasi|kabupaten administrasi|kabupaten|kota|kab\.?|kec\.?|kecamatan)\s+/,'').replace(/[^a-z0-9]+/g,' ').trim();
async function loadQuickRegions(level:'provinces'|'regencies'|'districts'|'villages',parent?:string,context:{province?:string;city?:string;district?:string}={}):Promise<QuickRegion[]>{
  if(parent?.startsWith('local:')){
    const province=INDONESIAN_REGIONS.find(item=>normalizeQuickRegion(item.name)===normalizeQuickRegion(context.province??''));
    const city=province&&getCities(province.name).find(item=>normalizeQuickRegion(item.name)===normalizeQuickRegion(context.city??''));
    const district=province&&city&&getDistricts(province.name,city.name).find(item=>normalizeQuickRegion(item.name)===normalizeQuickRegion(context.district??''));
    if(level==='provinces')return INDONESIAN_REGIONS.map(item=>({id:`local:province:${item.name}`,name:item.name}));
    if(level==='regencies'&&province)return getCities(province.name).map(item=>({id:`local:city:${province.name}:${item.name}`,name:item.name,latitude:item.latitude,longitude:item.longitude}));
    if(level==='districts'&&province&&city)return getDistricts(province.name,city.name).map(item=>({id:`local:district:${province.name}:${city.name}:${item.name}`,name:item.name,latitude:item.latitude,longitude:item.longitude}));
    if(level==='villages'&&province&&city&&district)return getSubdistricts(province.name,city.name,district.name).map(item=>({id:`local:village:${item.name}`,name:item.name,postalCode:item.postalCode,latitude:item.latitude,longitude:item.longitude}));
  }
  const params=new URLSearchParams({level});if(parent)params.set('parent',parent);
  try{const response=await fetch(`/api/shipping/regions?${params}`);const payload=await response.json() as {items?:QuickRegion[]};if(response.ok&&Array.isArray(payload.items)&&payload.items.length)return payload.items}catch{}
  const province=INDONESIAN_REGIONS.find(item=>normalizeQuickRegion(item.name)===normalizeQuickRegion(context.province??''));
  const city=province&&getCities(province.name).find(item=>normalizeQuickRegion(item.name)===normalizeQuickRegion(context.city??''));
  const district=province&&city&&getDistricts(province.name,city.name).find(item=>normalizeQuickRegion(item.name)===normalizeQuickRegion(context.district??''));
  if(level==='provinces')return INDONESIAN_REGIONS.map(item=>({id:`local:province:${item.name}`,name:item.name}));
  if(level==='regencies'&&province)return getCities(province.name).map(item=>({id:`local:city:${province.name}:${item.name}`,name:item.name,latitude:item.latitude,longitude:item.longitude}));
  if(level==='districts'&&province&&city)return getDistricts(province.name,city.name).map(item=>({id:`local:district:${province.name}:${city.name}:${item.name}`,name:item.name,latitude:item.latitude,longitude:item.longitude}));
  if(level==='villages'&&province&&city&&district)return getSubdistricts(province.name,city.name,district.name).map(item=>({id:`local:village:${item.name}`,name:item.name,postalCode:item.postalCode,latitude:item.latitude,longitude:item.longitude}));
  return [];
}
function ProfileQuickEdit({profile,locale,onSaved,initialTab='account'}:{profile:Record<string,unknown>;locale:'EN'|'ID';onSaved:()=>Promise<void>|void;initialTab?:ProfileQuickTab}){
  const [displayName,setDisplayName]=useState(String(profile.display_name??''));
  const [phone,setPhone]=useState(String(profile.phone??''));
  const [preferredLocale,setPreferredLocale]=useState(String(profile.locale??'en'));
  const [currency,setCurrency]=useState(String(profile.currency??'IDR'));
  const [saving,setSaving]=useState(false);
  const [tab,setTab]=useState<ProfileQuickTab>(initialTab);
  const [shipping,setShipping]=useState<Record<string,unknown>|null>(null);
  const [shippingLoadError,setShippingLoadError]=useState('');
  const [addressEditing,setAddressEditing]=useState(false);
  const [addressSaving,setAddressSaving]=useState(false);
  const [addressDraft,setAddressDraft]=useState({recipientName:String(profile.display_name??''),phone:String(profile.phone??''),addressLine:'',province:'',city:'',district:'',subdistrict:'',postalCode:''});
  const [addressProvinces,setAddressProvinces]=useState<QuickRegion[]>([]);
  const [addressCities,setAddressCities]=useState<QuickRegion[]>([]);
  const [addressDistricts,setAddressDistricts]=useState<QuickRegion[]>([]);
  const [addressSubdistricts,setAddressSubdistricts]=useState<QuickRegion[]>([]);
  const [addressRegionLoading,setAddressRegionLoading]=useState({provinces:true,cities:false,districts:false,subdistricts:false});
  const [shippingLatitude,setShippingLatitude]=useState<number|null>(null);
  const [shippingLongitude,setShippingLongitude]=useState<number|null>(null);
  const [shippingMethods,setShippingMethods]=useState<string[]>(['jnt','jne']);
  const [proOrders,setProOrders]=useState<{id:string;status:string;amount:number;currency:string;createdAt:string;paidAt:string|null}[]>([]);
  const [payoutAccounts,setPayoutAccounts]=useState<{id:string;bankName:string;accountHolder:string;lastFour:string;isDefault:boolean}[]>([]);
  const [payoutEditing,setPayoutEditing]=useState(false);
  const [payoutSaving,setPayoutSaving]=useState(false);
  const [payoutDraft,setPayoutDraft]=useState({id:'',bankName:'',accountHolder:'',accountNumber:'',makeDefault:true});
  const [proPlan,setProPlan]=useState<{amount:number|null;durationDays:number|null;introOffer:boolean;introOfferEndsAt:string|null;introOfferLimit:number|null;standardAmount:number|null;commissionPercent:number;freeCommissionPercent:number;buyerFeePercent:number;freeBuyerFeePercent:number;buyerFeeMinimum:number;sellerFeeMinimum:number;shippingVouchersPerMonth:number;shippingVoucherSharePercent:number;shippingVoucherCap:number;shippingVoucherMinSubtotal:number;paymentChannels?:PaymentOption[]}|null>(null);
  const [proPayment,setProPayment]=useState<{method:PaymentMethod;channel:string}>({method:'qris',channel:'mpm'});
  const [proSubmitting,setProSubmitting]=useState(false);
  const [confirmingPro,setConfirmingPro]=useState(false);
  const isPro=String(profile.tier??'free').toLowerCase()==='pro';
  const t=(en:string,id:string)=>locale==='ID'?id:en;
  const proPrice=proPlan?.amount!=null?new Intl.NumberFormat(locale==='ID'?'id-ID':'en-US',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(proPlan.amount):'IDR 24,900';
  const proPaymentOptions=proPlan?.paymentChannels?.length?proPlan.paymentChannels:defaultPaymentOptions;
  const proSelectedOption=proPaymentOptions.find(option=>option.method===proPayment.method&&option.channel===proPayment.channel)??proPaymentOptions.find(option=>option.method==='qris')??proPaymentOptions[0];
  const proPaymentFee=estimatePaymentFee(proSelectedOption,proPlan?.amount??0);
  const proIntroEndLabel=proPlan?.introOfferEndsAt?new Intl.DateTimeFormat(locale==='ID'?'id-ID':'en-US',{dateStyle:'medium',timeZone:'Asia/Jakarta'}).format(new Date(proPlan.introOfferEndsAt)):'';
  const proStandardPrice=new Intl.NumberFormat(locale==='ID'?'id-ID':'en-US',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(proPlan?.standardAmount??24900);
  const proIntroTerms=proPlan?.introOffer?(proPlan.introOfferLimit&&proIntroEndLabel?t(`Limited to ${proPlan.introOfferLimit} checkouts until ${proIntroEndLabel}. Then ${proStandardPrice} per 30 days. Renew manually.`,`Maksimal ${proPlan.introOfferLimit} checkout sampai ${proIntroEndLabel}. Setelah itu ${proStandardPrice} per 30 hari. Perpanjang manual.`):proPlan.introOfferLimit?t(`Limited to ${proPlan.introOfferLimit} checkouts. Then ${proStandardPrice} per 30 days. Renew manually.`,`Maksimal ${proPlan.introOfferLimit} checkout. Setelah itu ${proStandardPrice} per 30 hari. Perpanjang manual.`):proIntroEndLabel?t(`Available until ${proIntroEndLabel}. Then ${proStandardPrice} per 30 days. Renew manually.`,`Berlaku sampai ${proIntroEndLabel}. Setelah itu ${proStandardPrice} per 30 hari. Perpanjang manual.`):t(`First month ${proPrice}, then ${proStandardPrice} per 30 days. Renew manually.`,`Bulan pertama ${proPrice}, lalu ${proStandardPrice} per 30 hari. Perpanjang manual.`)):'';
  const fetchShippingOrigin=useCallback(async()=>{
    const response=await fetch('/api/shipping/origin',{cache:'no-store',credentials:'same-origin'});
    const value=await response.json() as {origin:Record<string,unknown>|null;error?:string};
    if(!response.ok)throw new Error(value.error||'Could not load the delivery address.');
    if(value.origin&&String(value.origin.ownerId??'')!==String(profile.id??''))throw new Error('We could not verify this delivery address. Reload before editing it.');
    return value.origin;
  },[profile.id]);
  const applyShippingOrigin=useCallback((origin:Record<string,unknown>|null)=>{
    setShipping(origin);
    if(origin){const regions=origin.regionNames&&typeof origin.regionNames==='object'?origin.regionNames as Record<string,string>:{};setAddressDraft({recipientName:String(origin.recipientName??''),phone:String(origin.phone??''),addressLine:String(origin.addressLine??''),province:String(regions.province??''),city:String(regions.city??origin.city??''),district:String(regions.district??''),subdistrict:String(regions.subdistrict??''),postalCode:String(origin.postalCode??'')});setShippingLatitude(typeof origin.latitude==='number'?origin.latitude:null);setShippingLongitude(typeof origin.longitude==='number'?origin.longitude:null);const couriers=enabledShippingCouriers(Array.isArray(origin.shippingMethods)?origin.shippingMethods:[]);setShippingMethods(couriers.length?couriers:['jnt','jne'])}
    else{setAddressDraft({recipientName:String(profile.display_name??''),phone:String(profile.phone??''),addressLine:'',province:'',city:'',district:'',subdistrict:'',postalCode:''});setShippingLatitude(null);setShippingLongitude(null)}
  },[profile.display_name,profile.phone]);
  const loadShipping=async()=>{try{const origin=await fetchShippingOrigin();applyShippingOrigin(origin);setShippingLoadError('');return true}catch(error){setShipping(null);setShippingLoadError(error instanceof Error?error.message:'Could not load the delivery address.');return false}};
  const loadPayoutAccounts=async()=>{try{const value=await api<{accounts:typeof payoutAccounts}>('/api/profile/bank-accounts');setPayoutAccounts(value.accounts??[])}catch{setPayoutAccounts([])}};
  useEffect(()=>{
    let active=true;
    Promise.all([
      fetchShippingOrigin().then(origin=>({origin,error:''})).catch(error=>({origin:null,error:error instanceof Error?error.message:'Could not load the delivery address.'})),
      fetch('/api/checkout/pro/orders',{cache:'no-store'}).then(response=>response.ok?response.json() as Promise<{orders?:typeof proOrders}>:{orders:[]}).catch(()=>({orders:[]})),
      api<{accounts:typeof payoutAccounts}>('/api/profile/bank-accounts').catch(()=>({accounts:[]})),
      api<typeof proPlan>('/api/checkout/pro').catch(()=>null),
    ]).then(([shippingResult,ordersResult,payoutResult,planResult])=>{
      if(!active)return;
      applyShippingOrigin(shippingResult.origin);
      setShippingLoadError(shippingResult.error);
      setProOrders(Array.isArray(ordersResult.orders)?ordersResult.orders:[]);
      setPayoutAccounts(payoutResult.accounts??[]);
      setProPlan(planResult);
      const options=planResult?.paymentChannels?.length?planResult.paymentChannels:defaultPaymentOptions;const preferred=options.find(option=>option.method==='qris')??options[0];if(preferred)setProPayment({method:preferred.method,channel:preferred.channel});
    });
    return()=>{active=false};
  },[profile.id,profile.display_name,profile.phone,fetchShippingOrigin,applyShippingOrigin]);
  useEffect(()=>{let active=true;setAddressRegionLoading(current=>({...current,provinces:true}));void loadQuickRegions('provinces').then(items=>{if(active)setAddressProvinces(items)}).finally(()=>{if(active)setAddressRegionLoading(current=>({...current,provinces:false}))});return()=>{active=false}},[]);
  useEffect(()=>{if(!addressDraft.province){setAddressCities([]);setAddressRegionLoading(current=>({...current,cities:false}));return}let active=true;setAddressRegionLoading(current=>({...current,cities:true}));const parent=addressProvinces.find(item=>normalizeQuickRegion(item.name)===normalizeQuickRegion(addressDraft.province));void loadQuickRegions('regencies',parent?.id,{province:addressDraft.province}).then(items=>{if(active)setAddressCities(items)}).finally(()=>{if(active)setAddressRegionLoading(current=>({...current,cities:false}))});return()=>{active=false}},[addressDraft.province,addressProvinces]);
  useEffect(()=>{if(!addressDraft.city){setAddressDistricts([]);setAddressRegionLoading(current=>({...current,districts:false}));return}let active=true;setAddressRegionLoading(current=>({...current,districts:true}));const parent=addressCities.find(item=>normalizeQuickRegion(item.name)===normalizeQuickRegion(addressDraft.city));void loadQuickRegions('districts',parent?.id,{province:addressDraft.province,city:addressDraft.city}).then(items=>{if(active)setAddressDistricts(items)}).finally(()=>{if(active)setAddressRegionLoading(current=>({...current,districts:false}))});return()=>{active=false}},[addressDraft.province,addressDraft.city,addressCities]);
  useEffect(()=>{if(!addressDraft.district){setAddressSubdistricts([]);setAddressRegionLoading(current=>({...current,subdistricts:false}));return}let active=true;setAddressRegionLoading(current=>({...current,subdistricts:true}));const parent=addressDistricts.find(item=>normalizeQuickRegion(item.name)===normalizeQuickRegion(addressDraft.district));void loadQuickRegions('villages',parent?.id,{province:addressDraft.province,city:addressDraft.city,district:addressDraft.district}).then(items=>{if(active)setAddressSubdistricts(items)}).finally(()=>{if(active)setAddressRegionLoading(current=>({...current,subdistricts:false}))});return()=>{active=false}},[addressDraft.province,addressDraft.city,addressDraft.district,addressDistricts]);
  const pendingProCount=proOrders.filter(order=>order.status==='PENDING_PAYMENT').length;
  const latestPaidProOrder=proOrders.filter(order=>order.paidAt).sort((a,b)=>Date.parse(b.paidAt??'')-Date.parse(a.paidAt??''))[0];
  const proDate=(value:string)=>formatDateTimeWithOffset(value,locale==='ID'?'id':'en',String(profile.timezone||'Asia/Jakarta'));
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setSaving(true);
    try{await api('/api/profile',{username:String(profile.username??''),displayName,phone,region:String(profile.region??'ID'),currency,timezone:String(profile.timezone??'Asia/Jakarta'),locale:preferredLocale});await onSaved();toast.success(locale==='ID'?'Profil diperbarui':'Profile updated')}
    catch(error){toast.error(error instanceof Error?error.message:(locale==='ID'?'Profil tidak dapat disimpan':'Could not save profile'))}
    finally{setSaving(false)}
  };
  const saveAddress=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(shippingMethods.some(method=>method==='grab'||method==='gojek')&&(shippingLatitude===null||shippingLongitude===null)){toast.error(t('Pin your pickup point to use instant couriers.','Tandai titik penjemputan untuk memakai kurir instan.'));return}setAddressSaving(true);const sameLocation=shipping?.postalCode===addressDraft.postalCode&&shipping?.city===addressDraft.city;try{await api('/api/shipping/origin',{...addressDraft,areaId:sameLocation?shipping?.areaId:null,latitude:shippingLatitude,longitude:shippingLongitude,shippingMethods,regions:{province:addressDraft.province,city:addressDraft.city,district:addressDraft.district,subdistrict:addressDraft.subdistrict}},'POST');if(!await loadShipping())throw new Error('The address was submitted but could not be reloaded. Please reload before leaving this page.');setAddressEditing(false);window.dispatchEvent(new Event('vivreplay:shipping-updated'));toast.success(t('Delivery settings saved','Pengaturan pengiriman disimpan'))}catch(error){toast.error(error instanceof Error?error.message:t('Could not save delivery settings','Pengaturan pengiriman tidak dapat disimpan'))}finally{setAddressSaving(false)}};
  const savePayout=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setPayoutSaving(true);try{await api('/api/profile/bank-accounts',{...(payoutDraft.id?{id:payoutDraft.id}:{}),bankName:payoutDraft.bankName,accountHolder:payoutDraft.accountHolder,...(payoutDraft.accountNumber?{accountNumber:payoutDraft.accountNumber}:{}),makeDefault:payoutDraft.makeDefault},'POST');await loadPayoutAccounts();setPayoutEditing(false);setPayoutDraft({id:'',bankName:'',accountHolder:'',accountNumber:'',makeDefault:true});toast.success(t('Payout account saved','Rekening pencairan disimpan'))}catch(error){toast.error(error instanceof Error?error.message:t('Could not save payout account','Rekening tidak dapat disimpan'))}finally{setPayoutSaving(false)}};
  const beginProCheckout=async()=>{if(!phone.trim()){setTab('account');toast.error(t('Add your phone number in Account to continue.','Tambahkan nomor telepon di bagian Akun untuk melanjutkan.'));return}setProSubmitting(true);try{const result=await api<{checkoutUrl:string}>('/api/checkout/pro',{introOffer:Boolean(proPlan?.introOffer),paymentMethod:proPayment.method,paymentChannel:proPayment.channel});window.location.assign(result.checkoutUrl)}catch(error){toast.error(error instanceof Error?error.message:t('Could not start checkout','Checkout tidak dapat dimulai'));setProSubmitting(false)}};
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
        <div><strong>{shipping?t('Default delivery address','Alamat pengiriman utama'):shippingLoadError?t('Address could not be verified','Alamat tidak dapat diverifikasi'):t('No delivery address saved','Belum ada alamat pengiriman')}</strong>
          {shippingLoadError&&<p role="alert">{shippingLoadError}</p>}
          {shipping?<><p>{String(shipping.recipientName??'')}{shipping.phone?` | ${String(shipping.phone)}`:''}</p><p>{[shipping.addressLine,shipping.regionNames&&typeof shipping.regionNames==='object'?Object.values(shipping.regionNames as Record<string,string>).filter(Boolean).join(', '):'',shipping.city,shipping.postalCode].filter(Boolean).join(', ')}</p><small>{t('Used for shipping at checkout.','Digunakan untuk pengiriman saat checkout.')}</small></>:<p>{t('Add an address to get delivery rates at checkout.','Tambahkan alamat untuk melihat ongkir saat checkout.')}</p>}
          {shipping&&<div className="market-profile-courier-summary"><span>{t('Couriers','Kurir')}</span><strong>{shippingMethods.map(method=>QUICK_COURIER_NAMES[method]).filter(Boolean).join(', ')||t('None selected','Belum dipilih')}</strong></div>}
        </div>
        {shippingLoadError?<button type="button" className="market-profile-quick-edit-link" onClick={()=>void loadShipping()}>{t('Reload address','Muat ulang alamat')}</button>:<button type="button" className="market-profile-quick-edit-link" onClick={()=>setAddressEditing(value=>!value)}><Pencil size={15}/>{t(shipping?'Edit address':'Add address',shipping?'Ubah alamat':'Tambah alamat')}</button>}
      </div>
      {addressEditing&&!shippingLoadError&&<form className="market-quick-profile-form market-quick-address-form" onSubmit={event=>void saveAddress(event)}>
        <label>{t('Recipient','Penerima')}<input required minLength={2} maxLength={100} autoComplete="name" value={addressDraft.recipientName} onChange={event=>setAddressDraft({...addressDraft,recipientName:event.target.value})}/></label>
        <PhoneInput required label={t('Phone number','Nomor telepon')} autoComplete="tel" value={addressDraft.phone} onChange={value=>setAddressDraft({...addressDraft,phone:value})} locale={locale}/>
        <label className="market-quick-address-wide">{t('Street address','Alamat jalan')}<textarea required minLength={5} maxLength={260} rows={3} autoComplete="street-address" value={addressDraft.addressLine} onChange={event=>{setAddressDraft({...addressDraft,addressLine:event.target.value});if(event.target.value!==String(shipping?.addressLine??'')){setShippingLatitude(null);setShippingLongitude(null)}}}/></label>
        <div className="shipping-cascading-grid market-quick-region-grid market-quick-address-wide">
          <label>{t('Province','Provinsi')}<select required value={addressDraft.province} onChange={event=>{setAddressDraft({...addressDraft,province:event.target.value,city:'',district:'',subdistrict:'',postalCode:''});setShippingLatitude(null);setShippingLongitude(null)}}><option value="">{addressRegionLoading.provinces?t('Loading provinces…','Memuat provinsi…'):t('Select province','Pilih provinsi')}</option>{addressProvinces.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}{addressDraft.province&&!addressProvinces.some(item=>normalizeQuickRegion(item.name)===normalizeQuickRegion(addressDraft.province))&&<option value={addressDraft.province}>{addressDraft.province}</option>}</select></label>
          <label>{t('City / Regency','Kota / Kabupaten')}<select required value={addressDraft.city} disabled={!addressDraft.province||addressRegionLoading.cities} onChange={event=>{setAddressDraft({...addressDraft,city:event.target.value,district:'',subdistrict:'',postalCode:''});setShippingLatitude(null);setShippingLongitude(null)}}><option value="">{addressRegionLoading.cities?t('Loading cities…','Memuat kota…'):t('Select city / regency','Pilih kota / kabupaten')}</option>{addressCities.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}{addressDraft.city&&!addressCities.some(item=>normalizeQuickRegion(item.name)===normalizeQuickRegion(addressDraft.city))&&<option value={addressDraft.city}>{addressDraft.city}</option>}</select></label>
          <label>{t('District','Kecamatan')}<select value={addressDraft.district} disabled={!addressDraft.city||addressRegionLoading.districts} onChange={event=>{setAddressDraft({...addressDraft,district:event.target.value,subdistrict:'',postalCode:''});setShippingLatitude(null);setShippingLongitude(null)}}><option value="">{addressRegionLoading.districts?t('Loading districts…','Memuat kecamatan…'):t('Select district','Pilih kecamatan')}</option>{addressDistricts.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}{addressDraft.district&&!addressDistricts.some(item=>normalizeQuickRegion(item.name)===normalizeQuickRegion(addressDraft.district))&&<option value={addressDraft.district}>{addressDraft.district}</option>}</select></label>
          <label>{t('Sub-district','Kelurahan / Desa')}<select value={addressDraft.subdistrict} disabled={!addressDraft.district||addressRegionLoading.subdistricts} onChange={event=>{const selected=addressSubdistricts.find(item=>item.name===event.target.value);setAddressDraft({...addressDraft,subdistrict:event.target.value,postalCode:selected?.postalCode?String(selected.postalCode):addressDraft.postalCode});setShippingLatitude(selected?.latitude??null);setShippingLongitude(selected?.longitude??null)}}><option value="">{addressRegionLoading.subdistricts?t('Loading sub-districts…','Memuat kelurahan/desa…'):t('Select sub-district','Pilih kelurahan / desa')}</option>{addressSubdistricts.map(item=><option key={item.id} value={item.name}>{item.name}{item.postalCode?` (${item.postalCode})`:''}</option>)}{addressDraft.subdistrict&&!addressSubdistricts.some(item=>normalizeQuickRegion(item.name)===normalizeQuickRegion(addressDraft.subdistrict))&&<option value={addressDraft.subdistrict}>{addressDraft.subdistrict}</option>}</select></label>
        </div>
        <label>{t('Postal code','Kode pos')}<input required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="postal-code" value={addressDraft.postalCode} onChange={event=>{const postalCode=event.target.value.replace(/\D/g,'').slice(0,5);setAddressDraft({...addressDraft,postalCode});if(postalCode!==String(shipping?.postalCode??'')){setShippingLatitude(null);setShippingLongitude(null)}}}/></label>
        <fieldset className="market-quick-courier-options"><legend>{t('Couriers you offer','Kurir yang tersedia')}</legend><div className="shipping-presets-row" role="group" aria-label={t('Courier presets','Preset kurir')}><button type="button" className="shipping-preset-btn" onClick={()=>setShippingMethods(Object.keys(QUICK_COURIER_NAMES))}>{t('All','Semua')} (11)</button><button type="button" className="shipping-preset-btn" onClick={()=>setShippingMethods(QUICK_POPULAR_COURIERS)}>{t('Popular','Populer')} (5)</button><button type="button" className="shipping-preset-btn" onClick={()=>setShippingMethods(Object.keys(QUICK_COURIER_NAMES).filter(code=>code!=='grab'&&code!=='gojek'))}>{t('Regular','Reguler')} (9)</button><button type="button" className="shipping-preset-btn" onClick={()=>setShippingMethods(['grab','gojek'])}>{t('Instant','Instan')} (2)</button></div><div>{Object.entries(QUICK_COURIER_NAMES).map(([code,label])=>{const active=shippingMethods.includes(code);const instant=code==='grab'||code==='gojek';return <button type="button" key={code} className={`shipping-method-item market-quick-courier-option ${active?'is-active':''}`} aria-pressed={active} onClick={()=>setShippingMethods(current=>active?current.filter(method=>method!==code):[...current,code])}><span className="shipping-method-main"><span className="shipping-method-title-row"><strong>{label}</strong><span className="shipping-method-badge">{instant?t('Instant','Instan'):t('Regular','Reguler')}</span></span><p>{instant?t('Same-day delivery','Pengiriman di hari yang sama'):t('Regular or express delivery','Pengiriman reguler atau express')}</p></span><span className={`shipping-method-toggle ${active?'is-on':''}`} aria-hidden="true"><span className="shipping-toggle-thumb"/></span></button>})}</div></fieldset>
        <div className="market-quick-map-field"><div><strong>{t('Pin delivery address','Titik alamat pengiriman')}</strong><small>{t('Adjust the pin to your exact address. This also sets the pickup point for instant couriers.','Sesuaikan pin ke alamat Anda. Titik ini juga digunakan untuk kurir instan.')}</small></div><MapPicker latitude={shippingLatitude} longitude={shippingLongitude} onChange={coords=>{setShippingLatitude(coords.lat);setShippingLongitude(coords.lng)}} language={locale} cityHint={[addressDraft.subdistrict,addressDraft.district,addressDraft.city].filter(Boolean).join(', ')||undefined} purpose="delivery"/></div>
        <div className="market-quick-form-actions"><button type="button" className="market-quick-secondary" onClick={()=>setAddressEditing(false)}>{t('Cancel','Batal')}</button><button className="button primary" type="submit" disabled={addressSaving}>{addressSaving?t('Saving…','Menyimpan…'):t('Save address','Simpan alamat')}</button></div>
      </form>}
    </section>}
    {tab==='membership'&&<div className="market-membership-quick">
      {isPro&&<div className="market-membership-active"><Crown size={16} weight="fill"/><span><strong>{t('Market Pro active','Market Pro aktif')}</strong><small>{latestPaidProOrder?.paidAt&&`${t('Since','Sejak')} ${proDate(latestPaidProOrder.paidAt)}${profile.pro_expires_at?' | ':''}`}{profile.pro_expires_at?`${t('Until','Sampai')} ${proDate(String(profile.pro_expires_at))}`:!latestPaidProOrder?.paidAt?t('Active','Aktif'):''}</small></span></div>}
      <div className="market-membership-compare" aria-label={t('Free and Pro plan comparison','Perbandingan paket Free dan Pro')}>
        <div className="market-membership-compare-head"><span></span><strong>Free</strong><strong>Pro</strong></div>
        <div><span>{t('Active listings','Listing aktif')}</span><b>25</b><b>2,500</b></div>
        <div><span>{t('Listing period','Masa listing')}</span><b>7 {t('days','hari')}</b><b>30 {t('days','hari')}</b></div>
        <div><span className="buyer-fee-row-label">{t('Seller fee','Biaya penjual')}<SellerFeeInfo locale={locale==='ID'?'id':'en'} minimumFee={proPlan?.sellerFeeMinimum} freePercent={proPlan?.freeCommissionPercent??1.25} proPercent={proPlan?.commissionPercent??0.75}/></span><b>{proPlan?.freeCommissionPercent??1.25}%</b><b>{proPlan?.commissionPercent??0.75}%</b></div>
        <div><span className="buyer-fee-row-label">{t('Buyer fee','Biaya pembeli')}<BuyerFeeInfo locale={locale==='ID'?'id':'en'} minimumFee={proPlan?.buyerFeeMinimum??MARKET_BUYER_FEE_MINIMUM}/></span><b>{proPlan?.freeBuyerFeePercent??1.5}%</b><b>{proPlan?.buyerFeePercent??0.75}%</b></div>
        <div><span>{t('Delivery vouchers','Voucher ongkir')}</span><b>—</b><b>{proPlan?.shippingVouchersPerMonth??2} / {t('month','bulan')}</b></div>
      </div>
      <p className="market-membership-compare-note">{t(`${proPlan?.shippingVouchersPerMonth??2} delivery vouchers each month. Each takes ${proPlan?.shippingVoucherSharePercent??50}% off delivery, up to IDR ${(proPlan?.shippingVoucherCap??5000).toLocaleString('en-US')}, on card orders of IDR ${(proPlan?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL).toLocaleString('en-US')} or more.`,`${proPlan?.shippingVouchersPerMonth??2} voucher ongkir tiap bulan. Setiap voucher memotong ${proPlan?.shippingVoucherSharePercent??50}% ongkir, maksimal IDR ${(proPlan?.shippingVoucherCap??5000).toLocaleString('id-ID')}, untuk pesanan kartu minimal IDR ${(proPlan?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL).toLocaleString('id-ID')}.`)}</p>
      <div className="market-membership-quick-actions">
        {!isPro&&!confirmingPro&&<><strong className="market-membership-quick-price">{proPrice}<small> / {proPlan?.durationDays??30} {t('days','hari')}</small></strong>{proIntroTerms&&<small className="market-membership-intro-note">{proIntroTerms}</small>}<button type="button" className="button primary" onClick={()=>setConfirmingPro(true)}><Crown size={16}/>{t('Get Market Pro','Dapatkan Market Pro')}<ArrowRight size={15}/></button></>}
        {!isPro&&confirmingPro&&<div className="market-pro-purchase-confirm" role="group" aria-label={t('Confirm Market Pro checkout','Konfirmasi checkout Market Pro')}><p>{t(`Start Market Pro for ${proPrice} / ${proPlan?.durationDays??30} days?`,`Mulai Market Pro seharga ${proPrice} untuk ${proPlan?.durationDays??30} hari?`)}</p>{proIntroTerms&&<small className="market-membership-intro-note">{proIntroTerms}</small>}<MarketPaymentMethodPicker locale={locale} options={proPaymentOptions} amount={proPlan?.amount??0} selectedMethod={proPayment.method} selectedChannel={proPayment.channel} onChange={(method,channel)=>setProPayment({method,channel})}/>{proPaymentFee>0&&<p className="pro-dialog-payment-total">{t('Estimated total','Perkiraan total')}: <strong>{new Intl.NumberFormat(locale==='ID'?'id-ID':'en-US',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format((proPlan?.amount??0)+proPaymentFee)}</strong></p>}<div><button type="button" className="market-quick-secondary" onClick={()=>setConfirmingPro(false)}>{t('Back','Kembali')}</button><button type="button" className="button primary" onClick={()=>void beginProCheckout()} disabled={proSubmitting}>{proSubmitting?t('Opening checkout…','Membuka checkout…'):t('Continue to payment','Lanjut ke pembayaran')}</button></div></div>}
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
