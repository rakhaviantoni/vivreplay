import {db} from '@/lib/server/store';
import {DEFAULT_EMAIL_FROM,DEFAULT_SUPPORT_EMAIL,getAppUrl,type RenderedEmail} from '@/lib/auth-email';
import {env} from 'cloudflare:workers';
import type {MarketEmailEvent} from '@/lib/market/email-template-types';

type Event=MarketEmailEvent;
export type NotificationDetails={participant?:string;amount?:number;currency?:string;itemCount?:number;message?:string;photoCount?:number;orderCode?:string};

const copy:Record<Event,{en:{subject:string;line:string;cta:string};id:{subject:string;line:string;cta:string}}>= {
  'new-offer':{en:{subject:'You received a Market offer · VivrePlay',line:'A collector sent an offer on your listing.',cta:'Review offer'},id:{subject:'Ada penawaran Market baru · VivrePlay',line:'Ada penawaran baru untuk kartu Anda.',cta:'Lihat penawaran'}},
  counteroffer:{en:{subject:'You received a counteroffer · VivrePlay',line:'A new price was proposed in your Market conversation.',cta:'Review conversation'},id:{subject:'Anda menerima penawaran balik · VivrePlay',line:'Ada harga baru yang diajukan dalam percakapan Market Anda.',cta:'Lihat percakapan'}},
  accepted:{en:{subject:'Your offer was accepted · VivrePlay',line:'The seller accepted your offer. Review the agreed cards and continue to checkout.',cta:'Continue to checkout'},id:{subject:'Penawaran Anda diterima · VivrePlay',line:'Penjual menerima penawaran Anda. Periksa kartu yang disepakati dan lanjutkan ke checkout.',cta:'Lanjut ke checkout'}},
  declined:{en:{subject:'Your offer was declined · VivrePlay',line:'The other collector declined your offer. Open the conversation to review the listing and offer history.',cta:'View conversation'},id:{subject:'Penawaran Anda ditolak · VivrePlay',line:'Kolektor lain menolak penawaran Anda. Buka percakapan untuk melihat listing dan riwayat penawaran.',cta:'Lihat percakapan'}},
  message:{en:{subject:'New Market conversation message · VivrePlay',line:'A collector sent you a message about this listing.',cta:'Open conversation'},id:{subject:'Pesan baru di percakapan Market · VivrePlay',line:'Kolektor mengirim pesan tentang listing ini.',cta:'Buka percakapan'}},
  'photo-request':{en:{subject:'Card photos requested · VivrePlay',line:'The buyer asked to see photos of the cards in this listing.',cta:'Open conversation'},id:{subject:'Foto kartu diminta · VivrePlay',line:'Pembeli meminta foto kartu untuk listing ini.',cta:'Buka percakapan'}},
  'photo-shared':{en:{subject:'Card photos are ready · VivrePlay',line:'The seller shared card photos for this listing.',cta:'View photos'},id:{subject:'Foto kartu tersedia · VivrePlay',line:'Penjual mengirim foto kartu untuk listing ini.',cta:'Lihat foto'}},
  'order-paid':{en:{subject:'Market payment confirmed · VivrePlay',line:'Your payment went through. Track the shipment and confirm delivery from your Market orders.',cta:'View order'},id:{subject:'Pembayaran Market berhasil · VivrePlay',line:'Pembayaran Anda berhasil. Pantau pengiriman dan konfirmasi penerimaan melalui pesanan Market.',cta:'Lihat pesanan'}},
  'order-seller-paid':{en:{subject:'Market order paid · VivrePlay',line:'The buyer paid for this order. Review the cards and shipping details, then arrange delivery.',cta:'View order'},id:{subject:'Pesanan Market telah dibayar · VivrePlay',line:'Pembeli sudah membayar pesanan ini. Periksa kartu dan alamat pengiriman, lalu siapkan pengiriman.',cta:'Lihat pesanan'}},
  'order-received':{en:{subject:'Market delivery confirmed · VivrePlay',line:'The buyer confirmed delivery. The sold cards are now recorded in their Vault.',cta:'View orders'},id:{subject:'Pengiriman Market diterima · VivrePlay',line:'Pembeli mengonfirmasi penerimaan. Kartu yang terjual kini tercatat di Vault mereka.',cta:'Lihat pesanan'}},
};

function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]??char))}

function formatAmount(amount:number,currency:string,locale:string){try{return new Intl.NumberFormat(locale==='id'?'id-ID':'en-US',{style:'currency',currency:currency.toUpperCase(),maximumFractionDigits:currency.toUpperCase()==='JPY'?0:2}).format(amount)}catch{return `${currency.toUpperCase()} ${amount.toLocaleString()}`}}
function eventDetail(event:Event,details:NotificationDetails|undefined,id:boolean,locale:string){
  if(event.startsWith('order-')&&details?.orderCode){const parts=[id?`Pesanan #${details.orderCode}`:`Order #${details.orderCode}`];if(details.amount!==undefined&&details.currency)parts.push(formatAmount(details.amount,details.currency,locale));if(details.itemCount)parts.push(id?`${details.itemCount} kartu`:`${details.itemCount} card${details.itemCount===1?'':'s'}`);if(details.participant){const role=event==='order-paid'?(id?'Penjual':'Seller'):(id?'Pembeli':'Buyer');parts.push(`${role}: ${details.participant}`)}return parts.join(' · ')}
  if(event==='message'&&details?.message)return details.message;
  if(event==='photo-shared'&&details?.photoCount)return id?`Foto untuk ${details.itemCount??1} kartu`:`Photos for ${details.itemCount??1} card${details.itemCount===1?'':'s'}`;
  return undefined;
}

function personalizedCopy(event:Event,details:NotificationDetails|undefined,title:string,id:boolean,locale:string){
  const base=copy[event][id?'id':'en'];
  const name=details?.participant;
  const amount=details?.amount!==undefined&&details.currency?formatAmount(details.amount,details.currency,locale):undefined;
  const count=details?.itemCount;
  const cards=count?(id?`${count} kartu`:`${count} card${count===1?'':'s'}`):undefined;
  let subject=base.subject;
  let line=base.line;
  switch(event){
    case 'new-offer':
      subject=id?`Penawaran ${title}${amount?` · ${amount}`:''} · VivrePlay`:`Offer for ${title}${amount?` · ${amount}`:''} · VivrePlay`;
      line=id?`${name||'Kolektor'} menawarkan${amount?` ${amount}`:''}${cards?` untuk ${cards}`:''} pada listing ${title}.`:`${name||'A collector'} offered${amount?` ${amount}`:''}${cards?` for ${cards}`:''} on your ${title} listing.`;
      break;
    case 'counteroffer':
      subject=id?`Penawaran balik · ${title}${amount?` · ${amount}`:''} · VivrePlay`:`Counteroffer · ${title}${amount?` · ${amount}`:''} · VivrePlay`;
      line=id?`${name||'Kolektor'} mengajukan harga baru${amount?` sebesar ${amount}`:''}${cards?` untuk ${cards}`:''} pada ${title}.`:`${name||'A collector'} proposed${amount?` ${amount}`:''}${cards?` for ${cards}`:''} in the ${title} conversation.`;
      break;
    case 'accepted':
      subject=id?`Penawaran diterima · ${title}${amount?` · ${amount}`:''} · VivrePlay`:`Offer accepted · ${title}${amount?` · ${amount}`:''} · VivrePlay`;
      line=id?`${name||'Penjual'} menerima penawaran Anda${amount?` sebesar ${amount}`:''}${cards?` untuk ${cards}`:''} pada ${title}.`:`${name||'The seller'} accepted your${amount?` ${amount}`:''}${cards?` offer for ${cards}`:''} on ${title}.`;
      break;
    case 'declined':
      subject=id?`Pembaruan penawaran · ${title} · VivrePlay`:`Offer update · ${title} · VivrePlay`;
      line=id?`${name||'Kolektor'} menolak penawaran Anda${amount?` sebesar ${amount}`:''}${cards?` untuk ${cards}`:''} pada ${title}. Buka percakapan untuk melihat riwayat.`:`${name||'The other collector'} declined your${amount?` ${amount}`:''}${cards?` offer for ${cards}`:''} on ${title}. Open the conversation to review the offer history.`;
      break;
    case 'message':
      subject=id?`Pesan dari ${name||'kolektor'} · ${title} · VivrePlay`:`Message from ${name||'a collector'} · ${title} · VivrePlay`;
      line=id?`${name||'Kolektor'} mengirim pesan baru tentang listing ${title}.`:`${name||'A collector'} sent a new message about your ${title} listing.`;
      break;
    case 'photo-request':
      subject=id?`Permintaan foto · ${title} · VivrePlay`:`Photo request · ${title} · VivrePlay`;
      line=id?`${name||'Pembeli'} meminta foto${cards?` ${cards} yang ada`:''} pada listing ${title}.`:`${name||'The buyer'} requested photos${cards?` of the ${cards}`:''} in your ${title} listing.`;
      break;
    case 'photo-shared':
      subject=id?`${details?.photoCount??'Foto'} foto dibagikan · ${title} · VivrePlay`:`${details?.photoCount??'New'} card photo${details?.photoCount===1?'':'s'} · ${title} · VivrePlay`;
      line=id?`${name||'Penjual'} membagikan ${details?.photoCount??'beberapa'} foto untuk listing ${title}.`:`${name||'The seller'} shared ${details?.photoCount??'new'} card photos for your ${title} listing.`;
      break;
    case 'order-paid':
      subject=id?`Pembayaran berhasil · ${details?.orderCode?`#${details.orderCode}`:title} · VivrePlay`:`Payment confirmed · ${details?.orderCode?`#${details.orderCode}`:title} · VivrePlay`;
      line=id?`Pembayaran${amount?` ${amount}`:''} untuk ${cards?`${cards} pada ${title}`:title} berhasil. Pantau pengiriman dan konfirmasi penerimaan di Market.`:`Your${amount?` ${amount} payment`:''} for ${cards?`${cards} from ${title}`:title} is confirmed. Track shipping and confirm delivery in Market.`;
      break;
    case 'order-seller-paid':
      subject=id?`Pesanan dibayar · ${details?.orderCode?`#${details.orderCode}`:title} · VivrePlay`:`Order paid · ${details?.orderCode?`#${details.orderCode}`:title} · VivrePlay`;
      line=id?`${name||'Pembeli'} membayar${amount?` ${amount}`:''} untuk ${cards?`${cards} pada ${title}`:title}. Periksa rincian dan siapkan pengiriman.`:`${name||'The buyer'} paid${amount?` ${amount}`:''} for ${cards?`${cards} in ${title}`:title}. Review the order and arrange shipping.`;
      break;
    case 'order-received':
      subject=id?`Pesanan diterima · ${details?.orderCode?`#${details.orderCode}`:title} · VivrePlay`:`Order received · ${details?.orderCode?`#${details.orderCode}`:title} · VivrePlay`;
      line=id?`${name||'Pembeli'} mengonfirmasi ${cards?`penerimaan ${cards} dari ${title}`:`penerimaan pesanan ${title}`}. Kartu kini tercatat di Vault mereka.`:`${name||'The buyer'} confirmed delivery${cards?` of ${cards}`:''} from ${title}. The cards are now recorded in their Vault.`;
      break;
  }
  return{...base,subject:subject.slice(0,150),line};
}

export function renderMarketEmail(event:Event,listingTitle='Edward.Newgate (001)',threadId='sample-market-thread',locale='en',recipient='navigator@example.com',theme?:'light'|'dark',details?:NotificationDetails):RenderedEmail{
  const id=locale.toLowerCase().startsWith('id');const message=personalizedCopy(event,details,listingTitle,id,locale);
  const base=getAppUrl().replace(/\/$/,'');const isOrder=event.startsWith('order-');
  const url=`${base}/market?activity=${isOrder?'orders':'offers'}${isOrder?'':`&conversation=${encodeURIComponent(threadId)}`}`;
  const title=escapeHtml(listingTitle);const safeUrl=escapeHtml(url);const safeRecipient=escapeHtml(recipient);
  const footer=id?'Pembaruan ini terkait aktivitas akun Market VivrePlay Anda.':'This update is about activity on your VivrePlay Market account.';
  const detail=eventDetail(event,details,id,locale);
  const safeDetail=detail?escapeHtml(detail):'';
  const preheader=detail?`${message.line} ${detail}`:message.line;
  const html=`<!doctype html><html lang="${id?'id':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${escapeHtml(message.subject)}</title><style>:root{color-scheme:light dark;supported-color-schemes:light dark}${theme==='dark'?'.email-bg{background:#10171d!important;color:#e8e7e1!important}.email-card{background:#182129!important;border-color:#303b43!important;color:#e8e7e1!important}.email-muted{color:#a0aaa9!important}.email-link{color:#e6bd70!important}.email-button{background:#d69b36!important;color:#171b1e!important}':theme==='light'?'': '@media(prefers-color-scheme:dark){.email-bg{background:#10171d!important;color:#e8e7e1!important}.email-card{background:#182129!important;border-color:#303b43!important;color:#e8e7e1!important}.email-muted{color:#a0aaa9!important}.email-link{color:#e6bd70!important}.email-button{background:#d69b36!important;color:#171b1e!important}}'}</style></head><body class="email-bg" style="margin:0;padding:24px;background:#f4ecdc;color:#28251f;font:16px/1.5 Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${escapeHtml(preheader.slice(0,180))}</div><main class="email-card" style="max-width:560px;margin:auto;padding:28px;background:#fffaf0;border:1px solid #dfd1b8;border-radius:8px"><p style="margin:0 0 22px;color:#855514;font-size:12px;font-weight:bold;letter-spacing:.08em">VIVREPLAY MARKET</p><p>${escapeHtml(message.line)}</p><p style="font-weight:700">${title}</p>${safeDetail?`<p class="email-detail" style="margin:0 0 20px;padding:12px 14px;border:1px solid #dfd1b8;border-radius:6px;background:#f8f1e5;font-size:14px;font-weight:700">${safeDetail}</p>`:''}<p><a class="email-button" style="display:inline-block;padding:12px 18px;background:#b77a19;color:#fffaf0;text-decoration:none;border-radius:6px" href="${safeUrl}">${escapeHtml(message.cta)}</a></p><p class="email-muted" style="margin:24px 0 0;color:#716a5e;font-size:12px">${footer}</p><p class="email-muted" style="margin:8px 0 0;color:#716a5e;font-size:11px">${id?'Dikirim ke':'Sent to'} ${safeRecipient} · <a class="email-link" href="mailto:${DEFAULT_SUPPORT_EMAIL}" style="color:#855514">${DEFAULT_SUPPORT_EMAIL}</a></p></main></body></html>`;
  const text=`${message.line}\n\n${listingTitle}${detail?`\n${detail}`:''}\n${message.cta}: ${url}\n\n${footer}\n${id?'Dikirim ke':'Sent to'} ${recipient}\n${DEFAULT_SUPPORT_EMAIL}`;
  return{subject:message.subject,html,text,from:DEFAULT_EMAIL_FROM,replyTo:`VivrePlay Support <${DEFAULT_SUPPORT_EMAIL}>`};
}

async function sendRenderedMarketEmail(to:string,event:Event,listingTitle:string,threadId:string,locale:string,theme?:'light'|'dark',details?:NotificationDetails){
  const apiKey=process.env.RESEND_API_KEY;if(!apiKey)throw new Error('Email delivery is not configured. RESEND_API_KEY is missing.');
  const rendered=renderMarketEmail(event,listingTitle,threadId,locale,to,theme,details);
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:rendered.from,to:[to],reply_to:rendered.replyTo,subject:rendered.subject,text:rendered.text,html:rendered.html,tags:[{name:'category',value:`market-${event}`}]})});
  if(!response.ok)throw new Error(`Email delivery failed (${response.status}).`);
  return response.json().catch(()=>({}));
}

export async function sendMarketTestEmail(to:string,event:Event,name='Navigator',locale='en',theme?:'light'|'dark'){
  return sendRenderedMarketEmail(to,event,name||'Edward.Newgate (001)','sample-market-thread',locale,theme,sampleNotificationDetails(event,locale));
}

export function sampleNotificationDetails(event:Event,locale='en'):NotificationDetails{
  const id=locale.toLowerCase().startsWith('id');
  if(event.startsWith('order-'))return{orderCode:'VP-24A91F',amount:285000,currency:'IDR',itemCount:2,participant:id?'Raka':'Raka Viantoni'};
  if(event==='new-offer'||event==='counteroffer'||event==='accepted'||event==='declined')return{participant:id?'Dimas':'Dimas Pratama',amount:250000,currency:'IDR',itemCount:2};
  if(event==='message')return{participant:id?'Dimas':'Dimas Pratama',message:id?'Bisa kirim foto bagian belakang kartunya?':'Could you send a photo of the back of the card?'};
  if(event==='photo-request')return{participant:id?'Dimas':'Dimas Pratama'};
  if(event==='photo-shared')return{participant:id?'Dimas':'Dimas Pratama',photoCount:3,itemCount:2};
  return{};
}

function itemCount(value:string|null|undefined){
  try{const items=JSON.parse(value||'[]') as Array<{quantity?:number}>;return items.reduce((sum,item)=>sum+(Number.isFinite(item.quantity)?Number(item.quantity):0),0)}catch{return undefined}
}

async function notificationDetails(event:Event,reference:string):Promise<NotificationDetails|undefined>{
  if(event.startsWith('order-')){
    const row=await db().prepare(`SELECT o.id,o.amount,o.currency,o.items,COALESCE(b.display_name,'Buyer') AS buyer,COALESCE(s.display_name,'Seller') AS seller
      FROM checkout_orders o LEFT JOIN profiles b ON b.id=o.buyer_id LEFT JOIN profiles s ON s.id=o.seller_id WHERE o.id=?`).bind(reference).first<{id:string;amount:number;currency:string;items:string;buyer:string;seller:string}>();
    if(!row)return undefined;
    return{orderCode:row.id.slice(0,8).toUpperCase(),amount:row.amount,currency:row.currency,itemCount:itemCount(row.items),participant:event==='order-paid'?row.seller:row.buyer};
  }
  if(event==='new-offer'||event==='counteroffer'||event==='accepted'||event==='declined'){
    if(event==='accepted'||event==='declined'){
      const kind=event==='accepted'?'OFFER_ACCEPTED':'OFFER_DECLINED';
      const response=await db().prepare(`SELECT o.amount,o.currency,o.items,p.display_name AS participant FROM listing_offer_messages m
        JOIN listing_offers o ON o.id=m.offer_id LEFT JOIN profiles p ON p.id=m.actor_id
        WHERE m.thread_id=? AND m.kind=? ORDER BY m.created_at DESC,m.rowid DESC LIMIT 1`).bind(reference,kind).first<{amount:number;currency:string;items:string;participant:string|null}>();
      if(response)return{amount:response.amount,currency:response.currency,itemCount:itemCount(response.items),participant:response.participant??undefined};
    }
    const row=await db().prepare(`SELECT o.amount,o.currency,o.items,p.display_name AS participant FROM listing_offers o LEFT JOIN profiles p ON p.id=o.actor_id
      WHERE o.id=? OR COALESCE(o.thread_id,o.id)=? ORDER BY o.created_at DESC,o.rowid DESC LIMIT 1`).bind(reference,reference).first<{amount:number;currency:string;items:string;participant:string|null}>();
    if(!row)return undefined;
    return{amount:row.amount,currency:row.currency,itemCount:itemCount(row.items),participant:row.participant??undefined};
  }
  if(event==='message'||event==='photo-request'||event==='photo-shared'){
    const row=await db().prepare(`SELECT m.kind,m.body,p.display_name AS participant,(SELECT COUNT(*) FROM listing_offer_attachments a WHERE a.message_id=m.id) AS photoCount
      FROM listing_offer_messages m LEFT JOIN profiles p ON p.id=m.actor_id WHERE m.thread_id=? ORDER BY m.created_at DESC,m.rowid DESC LIMIT 1`).bind(reference).first<{kind:string;body:string|null;participant:string|null;photoCount:number}>();
    if(!row)return undefined;
    const message=row.body?.trim().replace(/\s+/g,' ').slice(0,220);
    return{participant:row.participant??undefined,message:message||undefined,photoCount:row.photoCount||undefined};
  }
  return undefined;
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
async function deliverPush(profileId:string,event:Event,listingTitle:string,threadId:string,locale:string,details?:NotificationDetails){
    const vapidPublic=env.VAPID_PUBLIC_KEY;const privateJwk=env.VAPID_PRIVATE_JWK;
  if(!vapidPublic||!privateJwk)return;
  try{
    const subscriptions=(await db().prepare('SELECT id,endpoint,p256dh,auth FROM market_push_subscriptions WHERE profile_id=?').bind(profileId).all<{id:string;endpoint:string;p256dh:string;auth:string}>()).results;
    if(!subscriptions.length)return;
    const id=locale?.toLowerCase().startsWith('id')?'id':'en';const message=personalizedCopy(event,details,listingTitle,id==='id',id);
    const isOrder=event.startsWith('order-');
    const extra=eventDetail(event,details,id==='id',id);
    const payload=JSON.stringify({title:message.subject.replace(' · VivrePlay',''),body:[message.line,extra].filter(Boolean).join(' · ').slice(0,240),url:`/market?activity=${isOrder?'orders':'offers'}${isOrder?'':`&conversation=${encodeURIComponent(threadId)}`}`,tag:`market-${event}-${threadId}`});
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
    let details:NotificationDetails|undefined;
    try{details=await notificationDetails(event,threadId)}catch(error){console.error('market_notification_details_failed',error instanceof Error?error.message:'unknown error')}
    await deliverPush(profileId,event,listingTitle,threadId,recipient.locale??'en',details);
    if(recipient.email)await sendRenderedMarketEmail(recipient.email,event,listingTitle,threadId,recipient.locale??'en',undefined,details);
  }catch(error){console.error('market_email_delivery_failed',error instanceof Error?error.message:'unknown error')}
}
