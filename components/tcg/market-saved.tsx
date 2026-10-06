'use client';
import {PushNotificationPrompt} from '@/components/tcg/push-notification-settings';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {BookmarkSimpleIcon as Bookmark,HeartIcon as Heart} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {api,useAccount} from '@/lib/client';
import {formatMoney} from '@/packages/domain';
import type {MarketCardThumbnail} from '@/lib/server/market-card-thumbnails';
type Saved={id:string;title:string;amount:number;currency:string;status:string;expiresAt:string|null;printingId:string;seller:string;alerts:number;card:MarketCardThumbnail|null};
export function SaveListingButton({listingId,language}:{listingId:string;language:'EN'|'ID'}){
 const {data:account,loading}=useAccount();const [saved,setSaved]=useState(false);const [busy,setBusy]=useState(false);const [ready,setReady]=useState(false);const id=language==='ID';
 useEffect(()=>{let active=true;setReady(false);if(!account){setReady(!loading);return}api<{listings:Saved[]}>('/api/market/saved').then(r=>{if(active){setSaved(r.listings.some(l=>l.id===listingId));setReady(true)}}).catch(()=>{if(active)setReady(true)});return()=>{active=false}},[account?.profile.id,loading,listingId]);
 const toggle=async()=>{if(!account){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return}setBusy(true);try{await api('/api/market/saved',{listingId,saved:!saved});setSaved(!saved);window.dispatchEvent(new Event('vivreplay:saved-listings'));toast.success(id?(saved?'Listing dihapus dari simpanan':'Listing disimpan'):(saved?'Listing removed':'Listing saved'))}catch{toast.error(id?'Listing gagal disimpan':'Could not save listing')}finally{setBusy(false)}};
 return <button type="button" className="button secondary" disabled={busy||!ready} aria-pressed={saved} onClick={()=>void toggle()}><Bookmark size={17} weight={saved?'fill':'regular'}/>{id?(saved?'Tersimpan':'Simpan listing'):(saved?'Saved':'Save listing')}</button>;
}
export function WishlistButton({printingId,language}:{printingId:string;language:'EN'|'ID'}){
 const {data,refresh,loading}=useAccount();const [busy,setBusy]=useState(false);const id=language==='ID';const saved=Boolean(data?.wishlist.some(w=>w.printingId===printingId));
 const toggle=async()=>{if(!data){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return}setBusy(true);try{await api('/api/wishlist',{printingId,saved:!saved});await refresh();toast.success(id?(saved?'Dihapus dari daftar keinginan':'Ditambahkan ke daftar keinginan'):(saved?'Removed from wishlist':'Added to wishlist'))}catch(error){toast.error(error instanceof Error?error.message:(id?'Daftar keinginan gagal diperbarui':'Could not update wishlist'))}finally{setBusy(false)}};
 return <button type="button" className="button secondary" disabled={busy||loading||!printingId} aria-pressed={saved} onClick={()=>void toggle()}><Heart size={17} weight={saved?'fill':'regular'}/>{id?(saved?'Di daftar keinginan':'Daftar keinginan'):(saved?'Wishlisted':'Wishlist')}</button>;
}
export function SavedListings({language}:{language:'EN'|'ID'}){
 const id=language==='ID';const [rows,setRows]=useState<Saved[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState(false);const [busy,setBusy]=useState('');const [now,setNow]=useState(0);
 const load=useCallback(async()=>{setLoading(true);setError(false);try{const r=await api<{listings:Saved[]}>('/api/market/saved');setRows(r.listings);setNow(Date.now())}catch{setError(true)}finally{setLoading(false)}},[]);
 useEffect(()=>{void load()},[load]);
 const update=async(row:Saved,remove=false)=>{setBusy(row.id);try{await api('/api/market/saved',{listingId:row.id,...(remove?{saved:false}:{alerts:!row.alerts})});setRows(current=>remove?current.filter(r=>r.id!==row.id):current.map(r=>r.id===row.id?{...r,alerts:r.alerts?0:1}:r))}catch{toast.error(id?'Perubahan gagal disimpan':'Could not save change')}finally{setBusy('')}};
 if(loading)return <p role="status">{id?'Memuat listing tersimpan…':'Loading saved listings…'}</p>;
 if(error)return <div role="alert"><p>{id?'Listing tersimpan gagal dimuat':'Could not load saved listings'}</p><button className="button secondary" onClick={()=>void load()}>{id?'Coba lagi':'Try again'}</button></div>;
 return <section className="market-watch-list"><PushNotificationPrompt language={language} message="wishlist"/><h2>{id?'Listing tersimpan':'Saved listings'}</h2>{!rows.length&&<p>{id?'Simpan listing yang ingin Anda lihat lagi':'Save listings you want to revisit'}</p>}{rows.map(row=>{const expired=row.expiresAt&&Date.parse(row.expiresAt.replace(' ','T')+'Z')<=now;const status=expired&&row.status==='ACTIVE'?'EXPIRED':row.status;const labels:Record<string,string>=id?{ACTIVE:'Aktif',SOLD:'Terjual',PAUSED:'Dijeda',CLOSED:'Ditutup',EXPIRED:'Kedaluwarsa'}:{ACTIVE:'Active',SOLD:'Sold',PAUSED:'Paused',CLOSED:'Closed',EXPIRED:'Expired'};return <article key={row.id}>{row.card?.imageUrl&&<img src={row.card.imageUrl} alt={row.card.name} loading="lazy"/>}<div><Link href={`/market/${row.id}`}><strong>{row.title}</strong></Link><small>{row.seller} - {labels[status]??status}</small><b>{formatMoney(row.amount,row.currency)}</b>{status!=='ACTIVE'&&<Link href={`/market?printing=${row.printingId}`}>{id?'Cari listing lain':'Find other listings'}</Link>}<div className="market-watch-actions"><label><input type="checkbox" role="switch" checked={Boolean(row.alerts)} disabled={busy===row.id} onChange={()=>void update(row)}/>{id?'Notifikasi harga turun':'Price-drop alerts'}</label><button className="button secondary" disabled={busy===row.id} onClick={()=>void update(row,true)}>{id?'Hapus':'Remove'}</button></div></div></article>})}</section>;
}
