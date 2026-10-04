import {db} from '@/lib/server/store';
import {DEFAULT_EMAIL_FROM,DEFAULT_SUPPORT_EMAIL,getAppUrl,type RenderedEmail} from '@/lib/auth-email';
import {env} from 'cloudflare:workers';
import type {MarketEmailEvent} from '@/lib/market/email-template-types';

type Event=MarketEmailEvent;

const copy:Record<Event,{en:{subject:string;line:string;cta:string};id:{subject:string;line:string;cta:string}}>= {
  'new-offer':{en:{subject:'You received a Market offer · VivrePlay',line:'A collector sent an offer on your listing.',cta:'Review offer'},id:{subject:'Ada penawaran Market baru · VivrePlay',line:'Kolektor mengirim penawaran untuk listing Anda.',cta:'Lihat penawaran'}},
  counteroffer:{en:{subject:'You received a counteroffer · VivrePlay',line:'There is a new counteroffer in your Market conversation.',cta:'Review conversation'},id:{subject:'Anda menerima penawaran balik · VivrePlay',line:'Ada penawaran balik baru di percakapan Market Anda.',cta:'Lihat percakapan'}},
  accepted:{en:{subject:'Your offer was accepted · VivrePlay',line:'Your Market offer was accepted. Continue to checkout to secure the cards.',cta:'Continue to checkout'},id:{subject:'Penawaran Anda diterima · VivrePlay',line:'Penawaran Market Anda diterima. Lanjutkan ke checkout untuk mengamankan kartu.',cta:'Lanjut ke checkout'}},
  declined:{en:{subject:'Your offer was declined · VivrePlay',line:'Your Market offer was declined. You can review the conversation for details.',cta:'View conversation'},id:{subject:'Penawaran Anda ditolak · VivrePlay',line:'Penawaran Market Anda ditolak. Buka percakapan untuk melihat detailnya.',cta:'Lihat percakapan'}},
  message:{en:{subject:'New Market conversation message · VivrePlay',line:'You have a new message about a Market listing.',cta:'Open conversation'},id:{subject:'Pesan percakapan Market baru · VivrePlay',line:'Ada pesan baru tentang listing Market.',cta:'Buka percakapan'}},
  'photo-request':{en:{subject:'Card photos requested · VivrePlay',line:'A buyer requested card photos in your Market conversation.',cta:'Open conversation'},id:{subject:'Foto kartu diminta · VivrePlay',line:'Pembeli meminta foto kartu melalui percakapan Market.',cta:'Buka percakapan'}},
  'photo-shared':{en:{subject:'Card photos are ready · VivrePlay',line:'The card supplier shared photos in your Market conversation.',cta:'View photos'},id:{subject:'Foto kartu tersedia · VivrePlay',line:'Penjual membagikan foto kartu di percakapan Market.',cta:'Lihat foto'}},
  'order-paid':{en:{subject:'Market payment confirmed · VivrePlay',line:'Your Market payment was confirmed. You can follow the order in Market.',cta:'View order'},id:{subject:'Pembayaran Market dikonfirmasi · VivrePlay',line:'Pembayaran Market Anda sudah dikonfirmasi. Pantau pesanan di Market.',cta:'Lihat pesanan'}},
  'order-seller-paid':{en:{subject:'Market order paid · VivrePlay',line:'A Market order has been paid. Review the order and arrange delivery.',cta:'View order'},id:{subject:'Pesanan Market dibayar · VivrePlay',line:'Pesanan Market telah dibayar. Periksa pesanan dan siapkan pengiriman.',cta:'Lihat pesanan'}},
  'order-received':{en:{subject:'Market delivery confirmed · VivrePlay',line:'The buyer confirmed delivery. The cards are now in their Vault.',cta:'View orders'},id:{subject:'Pengiriman Market dikonfirmasi · VivrePlay',line:'Pembeli mengonfirmasi penerimaan. Kartu sudah masuk ke Vault mereka.',cta:'Lihat pesanan'}},
};

function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]??char))}

export function renderMarketEmail(event:Event,listingTitle='Edward.Newgate (001)',threadId='sample-market-thread',locale='en',recipient='navigator@example.com',theme?:'light'|'dark'):RenderedEmail{
  const id=locale.toLowerCase().startsWith('id');const message=copy[event][id?'id':'en'];
  const base=getAppUrl().replace(/\/$/,'');const isOrder=event.startsWith('order-');
  const url=`${base}/market?activity=${isOrder?'orders':'offers'}${isOrder?'':`&conversation=${encodeURIComponent(threadId)}`}`;
  const title=escapeHtml(listingTitle);const safeUrl=escapeHtml(url);const safeRecipient=escapeHtml(recipient);
  const footer=id?'Pembaruan ini terkait aktivitas akun Market VivrePlay Anda.':'This update is about activity on your VivrePlay Market account.';
  const html=`<!doctype html><html lang="${id?'id':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${escapeHtml(message.subject)}</title><style>:root{color-scheme:light dark;supported-color-schemes:light dark}${theme==='dark'?'.email-bg{background:#10171d!important;color:#e8e7e1!important}.email-card{background:#182129!important;border-color:#303b43!important;color:#e8e7e1!important}.email-muted{color:#a0aaa9!important}.email-link{color:#e6bd70!important}.email-button{background:#d69b36!important;color:#171b1e!important}':theme==='light'?'': '@media(prefers-color-scheme:dark){.email-bg{background:#10171d!important;color:#e8e7e1!important}.email-card{background:#182129!important;border-color:#303b43!important;color:#e8e7e1!important}.email-muted{color:#a0aaa9!important}.email-link{color:#e6bd70!important}.email-button{background:#d69b36!important;color:#171b1e!important}}'}</style></head><body class="email-bg" style="margin:0;padding:24px;background:#f4ecdc;color:#28251f;font:16px/1.5 Arial,sans-serif"><main class="email-card" style="max-width:560px;margin:auto;padding:28px;background:#fffaf0;border:1px solid #dfd1b8;border-radius:8px"><p style="margin:0 0 22px;color:#855514;font-size:12px;font-weight:bold;letter-spacing:.08em">VIVREPLAY MARKET</p><p>${message.line}</p><p style="font-weight:700">${title}</p><p><a class="email-button" style="display:inline-block;padding:12px 18px;background:#b77a19;color:#fffaf0;text-decoration:none;border-radius:6px" href="${safeUrl}">${message.cta}</a></p><p class="email-muted" style="margin:24px 0 0;color:#716a5e;font-size:12px">${footer}</p><p class="email-muted" style="margin:8px 0 0;color:#716a5e;font-size:11px">${id?'Dikirim ke':'Sent to'} ${safeRecipient} · <a class="email-link" href="mailto:${DEFAULT_SUPPORT_EMAIL}" style="color:#855514">${DEFAULT_SUPPORT_EMAIL}</a></p></main></body></html>`;
  const text=`${message.line}\n\n${listingTitle}\n${message.cta}: ${url}\n\n${footer}\n${id?'Dikirim ke':'Sent to'} ${recipient}\n${DEFAULT_SUPPORT_EMAIL}`;
  return{subject:message.subject,html,text,from:DEFAULT_EMAIL_FROM,replyTo:`VivrePlay Support <${DEFAULT_SUPPORT_EMAIL}>`};
}

async function sendRenderedMarketEmail(to:string,event:Event,listingTitle:string,threadId:string,locale:string,theme?:'light'|'dark'){
  const apiKey=process.env.RESEND_API_KEY;if(!apiKey)throw new Error('Email delivery is not configured. RESEND_API_KEY is missing.');
  const rendered=renderMarketEmail(event,listingTitle,threadId,locale,to,theme);
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:rendered.from,to:[to],reply_to:rendered.replyTo,subject:rendered.subject,text:rendered.text,html:rendered.html,tags:[{name:'category',value:`market-${event}`}]})});
  if(!response.ok)throw new Error(`Email delivery failed (${response.status}).`);
  return response.json().catch(()=>({}));
}

export async function sendMarketTestEmail(to:string,event:Event,name='Navigator',locale='en',theme?:'light'|'dark'){
  return sendRenderedMarketEmail(to,event,name||'Edward.Newgate (001)','sample-market-thread',locale,theme);
}

const encoder=new TextEncoder();
const buffer=(bytes:Uint8Array)=>bytes.slice().buffer as ArrayBuffer;
const b64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function fromB64url(value:string){const normalized=value.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(normalized+'='.repeat((4-normalized.length%4)%4));return Uint8Array.from(raw,char=>char.charCodeAt(0));}
function join(...parts:Uint8Array[]){const output=new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0));let offset=0;for(const part of parts){output.set(part,offset);offset+=part.length;}return output;}
async function hmac(keyBytes:Uint8Array,data:Uint8Array){const key=await crypto.subtle.importKey('raw',buffer(keyBytes),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,buffer(data)));}
async function expand(prk:Uint8Array,info:Uint8Array,length:number){let previous=new Uint8Array();const output=new Uint8Array(length);let offset=0;for(let counter=1;offset<length;counter++){previous=await hmac(prk,join(previous,info,new Uint8Array([counter])));const take=Math.min(previous.length,length-offset);output.set(previous.subarray(0,take),offset);offset+=take;}return output;}
async function encryptedPayload(subscription:{p256dh:string;auth:string},payload:string){
  const uaPublic=fromB64url(subscription.p256dh);const authSecret=fromB64url(subscription.auth);
  const uaKey=await crypto.subtle.importKey('raw',buffer(uaPublic),{name:'ECDH',namedCurve:'P-256'},false,[]);
  const serverPair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const serverPublic=new Uint8Array(await crypto.subtle.exportKey('raw',serverPair.publicKey));
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},serverPair.privateKey,256));
  const prkKey=await hmac(authSecret,shared);
  const keyInfo=join(encoder.encode('WebPush: info\0'),uaPublic,serverPublic);
  const ikm=await expand(prkKey,keyInfo,32);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const prk=await hmac(salt,ikm);
  const cek=await expand(prk,encoder.encode('Content-Encoding: aes128gcm\0'),16);
  const nonce=await expand(prk,encoder.encode('Content-Encoding: nonce\0'),12);
  const plaintext=join(encoder.encode(payload),new Uint8Array([2]));
  const aesKey=await crypto.subtle.importKey('raw',buffer(cek),{name:'AES-GCM'},false,['encrypt']);
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:buffer(nonce),tagLength:128},aesKey,buffer(plaintext)));
  const recordSize=new Uint8Array([0,0,16,0]);
  return join(salt,recordSize,new Uint8Array([serverPublic.length]),serverPublic,ciphertext);
}
async function deliverPush(profileId:string,event:Event,listingTitle:string,threadId:string,locale:string){
    const vapidPublic=env.VAPID_PUBLIC_KEY;const privateJwk=env.VAPID_PRIVATE_JWK;
  if(!vapidPublic||!privateJwk)return;
  try{
    const subscriptions=(await db().prepare('SELECT id,endpoint,p256dh,auth FROM market_push_subscriptions WHERE profile_id=?').bind(profileId).all<{id:string;endpoint:string;p256dh:string;auth:string}>()).results;
    if(!subscriptions.length)return;
    const id=locale?.toLowerCase().startsWith('id')?'id':'en';const message=copy[event][id];
    const isOrder=event.startsWith('order-');
    const payload=JSON.stringify({title:message.subject.replace(' · VivrePlay',''),body:`${message.line} ${listingTitle}`,url:`/market?activity=${isOrder?'orders':'offers'}${isOrder?'':`&conversation=${encodeURIComponent(threadId)}`}`,tag:`market-${event}-${threadId}`});
    const vapid=JSON.parse(privateJwk) as JsonWebKey;const signingKey=await crypto.subtle.importKey('jwk',vapid,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
    const authorization=async(endpoint:string)=>{
      const audience=new URL(endpoint).origin;const header=b64url(encoder.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
      const body=b64url(encoder.encode(JSON.stringify({aud:audience,exp:Math.floor(Date.now()/1000)+12*60*60,sub:'mailto:hello@vivreplay.com'})));
      const unsigned=`${header}.${body}`;const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},signingKey,encoder.encode(unsigned)));
      return `vapid t=${unsigned}.${b64url(signature)}, k=${vapidPublic}`;
    };
    await Promise.all(subscriptions.map(async subscription=>{
      try{
        const body=await encryptedPayload(subscription,payload);
        const response=await fetch(subscription.endpoint,{method:'POST',headers:{Authorization:await authorization(subscription.endpoint),'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream','TTL':'2419200'},body});
        if(response.status===404||response.status===410)await db().prepare('DELETE FROM market_push_subscriptions WHERE id=?').bind(subscription.id).run();
        else if(!response.ok)console.error('market_push_delivery_failed',response.status);
      }catch(error){console.error('market_push_delivery_failed',error instanceof Error?error.message:'unknown error');}
    }));
  }catch(error){console.error('market_push_delivery_failed',error instanceof Error?error.message:'unknown error');}
}

export async function sendMarketEmail(profileId:string,event:Event,listingTitle:string,threadId:string){
  try{
    const recipient=await db().prepare(`SELECT u.email,p.locale FROM profiles p JOIN user u ON u.id=p.auth_subject WHERE p.id=?`).bind(profileId).first<{email:string;locale:string}>();
    if(!recipient)return;
    await deliverPush(profileId,event,listingTitle,threadId,recipient.locale??'en');
    if(recipient.email)await sendRenderedMarketEmail(recipient.email,event,listingTitle,threadId,recipient.locale??'en');
  }catch(error){console.error('market_email_delivery_failed',error instanceof Error?error.message:'unknown error')}
}
