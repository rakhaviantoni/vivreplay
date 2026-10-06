'use client';
import {useEffect,useState} from 'react';
import {BellIcon as Bell, BellSlashIcon as BellSlash, XIcon as Close} from '@phosphor-icons/react';
import {toast} from 'sonner';

function decodeKey(value:string){const normalized=value.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(normalized+'='.repeat((4-normalized.length%4)%4));return Uint8Array.from(raw,char=>char.charCodeAt(0));}
async function subscribeToPush(){
  const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Allow notifications in your browser to continue.');
  const config=await fetch('/api/notifications/push',{cache:'no-store'}).then(async response=>{const payload=await response.json() as {error?:string;publicKey:string|null;enabled:boolean};if(!response.ok)throw new Error(payload.error||'Push notifications are unavailable.');return payload;});
  if(!config.enabled||!config.publicKey)throw new Error('Push notifications are not configured yet.');
  const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;
  const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(config.publicKey) as BufferSource});
  const response=await fetch('/api/notifications/push',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(subscription.toJSON())});
  if(!response.ok){const payload=await response.json().catch(()=>({})) as {error?:string};throw new Error(payload.error||'Could not enable notifications.');}
}
export function PushNotificationSettings({language}:{language:'EN'|'ID'}){
  const supported=typeof window!=='undefined'&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;const [enabled,setEnabled]=useState(false);const [subscribed,setSubscribed]=useState(false);const [busy,setBusy]=useState(false);
  const text=(en:string,id:string)=>language==='ID'?id:en;
  useEffect(()=>{
    if(!supported)return;
    let active=true;
    fetch('/api/notifications/push',{cache:'no-store'}).then(response=>response.ok?response.json() as Promise<{enabled?:boolean}>:null).then(async result=>{if(!active)return;setEnabled(Boolean(result?.enabled));const registration=await navigator.serviceWorker.getRegistration('/');const subscription=await registration?.pushManager.getSubscription();if(active)setSubscribed(Boolean(subscription));}).catch(()=>{});
    return()=>{active=false;};
  },[supported]);
  const toggle=async()=>{
    if(!supported||busy)return;setBusy(true);
    try{
      if(subscribed){
        const registration=await navigator.serviceWorker.getRegistration('/');const subscription=await registration?.pushManager.getSubscription();
        if(subscription){await fetch('/api/notifications/push',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})});await subscription.unsubscribe();}
        setSubscribed(false);toast.success(text('Push notifications turned off.','Notifikasi push dimatikan.'));return;
      }
      await subscribeToPush();
      setEnabled(true);setSubscribed(true);toast.success(text('Push notifications are on.','Notifikasi push aktif.'));
    }catch(error){toast.error(error instanceof Error?error.message:text('Could not update notifications.','Notifikasi tidak dapat diperbarui.'));}
    finally{setBusy(false);}
  };
  if(!supported||!enabled)return null;
  return <section className="profile-push-settings"><div><span className="profile-push-icon">{subscribed?<Bell size={18}/>:<BellSlash size={18}/>}</span><div><h2>{text('Market notifications','Notifikasi Market')}</h2><p>{text('Get alerts for offers, messages, and shared card photos.','Terima pemberitahuan penawaran, pesan, dan foto kartu.')}</p></div></div><button type="button" className="button secondary" disabled={busy} onClick={toggle}>{busy?text('Saving…','Menyimpan…'):subscribed?text('Turn off','Matikan'):text('Enable','Aktifkan')}</button></section>;
}

export function PushNotificationPrompt({language,message}:{language:'EN'|'ID';message?:'offer'|'activity'|'order'|'wishlist'}){
  const [visible,setVisible]=useState(false);const [busy,setBusy]=useState(false);
  const text=(en:string,id:string)=>language==='ID'?id:en;
  useEffect(()=>{
    if(localStorage.getItem('vivreplay-push-prompt-dismissed')==='1'||typeof Notification==='undefined'||!('serviceWorker'in navigator)||!('PushManager'in window))return;
    let active=true;
    fetch('/api/notifications/push',{cache:'no-store'}).then(async response=>response.ok?await response.json() as {enabled?:boolean}:null).then(async result=>{
      if(!active||!result?.enabled||Notification.permission==='denied')return;
      const registration=await navigator.serviceWorker.getRegistration('/');const subscription=await registration?.pushManager.getSubscription();
      if(active&&!subscription)setVisible(true);
    }).catch(()=>{});
    return()=>{active=false;};
  },[]);
  const copy=message==='wishlist'?text('Get wishlist and saved-listing alerts on this device.','Terima notifikasi daftar keinginan dan listing tersimpan di perangkat ini.'):
    message==='offer'?text('Get an alert when this offer gets a reply.','Terima notifikasi saat penawaran ini dibalas.'):
    message==='order'?text('Get Market order and payment updates on this device.','Terima pembaruan pesanan dan pembayaran Market di perangkat ini.'):
    text('Get alerts for new offers and replies.','Terima notifikasi penawaran dan balasan baru.');
  if(!visible)return null;
  return <aside className="market-push-prompt"><Bell size={17}/><span>{copy}</span><button type="button" className="market-push-enable" disabled={busy} onClick={async()=>{setBusy(true);try{await subscribeToPush();setVisible(false);toast.success(text('Push notifications are on.','Notifikasi push aktif.'));}catch(error){toast.error(error instanceof Error?error.message:text('Could not enable notifications.','Notifikasi tidak dapat diaktifkan.'));}finally{setBusy(false)}}}>{busy?text('Enabling…','Mengaktifkan…'):text('Enable','Aktifkan')}</button><button type="button" className="market-push-dismiss" aria-label={text('Dismiss notification prompt','Tutup pemberitahuan')} onClick={()=>{localStorage.setItem('vivreplay-push-prompt-dismissed','1');setVisible(false)}}><Close size={15}/></button></aside>;
}
