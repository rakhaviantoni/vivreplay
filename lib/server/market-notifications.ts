import {db} from '@/lib/server/store';
import {DEFAULT_EMAIL_FROM,DEFAULT_SUPPORT_EMAIL,getAppUrl,type RenderedEmail} from '@/lib/auth-email';
import {env} from 'cloudflare:workers';
import type {MarketEmailEvent} from '@/lib/market/email-template-types';
import {marketCardThumbnails} from '@/lib/server/market-card-thumbnails';

type Event=MarketEmailEvent;
type NotificationItem={name:string;code:string;language:string;variant:string;rarity?:string;condition?:string;quantity:number;unitAmount?:number};
export type NotificationDetails={participant?:string;amount?:number;currency?:string;itemCount?:number;message?:string;photoCount?:number;orderCode?:string;items?:NotificationItem[];subtotal?:number;shippingFee?:number;courier?:string;trackingNumber?:string;trackingStatus?:string;city?:string;postalCode?:string;shippingDeadline?:string};

const copy:Record<Event,{en:{subject:string;line:string;cta:string};id:{subject:string;line:string;cta:string}}>= {
  'wishlist-match':{en:{subject:'A wishlist card is listed',line:'A listing matches your saved printing and preferences',cta:'View listing'},id:{subject:'Kartu yang Anda inginkan tersedia',line:'Ada listing yang cocok dengan cetakan dan preferensi Anda',cta:'Lihat listing'}},
  'price-drop':{en:{subject:'A saved listing costs less',line:'The price dropped on a listing you saved',cta:'View listing'},id:{subject:'Harga listing tersimpan turun',line:'Harga listing yang Anda simpan kini lebih rendah',cta:'Lihat listing'}},
  'new-offer':{en:{subject:'New offer for your listing',line:'A collector made an offer on your listing',cta:'Review offer'},id:{subject:'Penawaran baru untuk listing Anda',line:'Kolektor mengajukan penawaran untuk listing Anda',cta:'Lihat penawaran'}},
  counteroffer:{en:{subject:'A counteroffer is waiting',line:'A new price is waiting in your conversation',cta:'Review conversation'},id:{subject:'Ada penawaran balik',line:'Harga baru menunggu di percakapan Anda',cta:'Lihat percakapan'}},
  accepted:{en:{subject:'Your offer was accepted',line:'The seller accepted your offer',cta:'Open conversation'},id:{subject:'Penawaran Anda diterima',line:'Penjual menerima penawaran Anda',cta:'Buka percakapan'}},
  declined:{en:{subject:'An update on your offer',line:'The other collector declined your offer',cta:'View conversation'},id:{subject:'Pembaruan penawaran Anda',line:'Kolektor tersebut menolak penawaran Anda',cta:'Lihat percakapan'}},
  'offer-unavailable':{en:{subject:'Some cards in your offer have sold',line:'The offer is closed because none of its cards remain available',cta:'View conversation'},id:{subject:'Kartu dalam penawaran sudah terjual',line:'Penawaran ditutup karena kartu yang diminta sudah tidak tersedia',cta:'Lihat percakapan'}},
  message:{en:{subject:'A new message about your listing',line:'You have a new Market message',cta:'Open conversation'},id:{subject:'Pesan baru tentang listing Anda',line:'Ada pesan Market baru untuk Anda',cta:'Buka percakapan'}},
  'photo-request':{en:{subject:'A buyer asked for card photos',line:'A buyer requested photos from your listing',cta:'Open conversation'},id:{subject:'Pembeli meminta foto kartu',line:'Pembeli meminta foto dari listing Anda',cta:'Buka percakapan'}},
  'photo-shared':{en:{subject:'New card photos in your conversation',line:'The seller added card photos to your conversation',cta:'View photos'},id:{subject:'Ada foto kartu baru di percakapan',line:'Penjual menambahkan foto kartu ke percakapan Anda',cta:'Lihat foto'}},
  'order-paid':{en:{subject:'Your Market order is paid',line:'Your payment is confirmed, and the seller will prepare your cards for shipping.',cta:'View order'},id:{subject:'Pesanan Market Anda sudah dibayar',line:'Pembayaran Anda sudah diterima, penjual akan menyiapkan kartu untuk dikirim.',cta:'Lihat pesanan'}},
  'order-seller-paid':{en:{subject:'Order paid, arrange shipping',line:'The buyer paid for your order',cta:'Prepare shipment'},id:{subject:'Pesanan dibayar, atur pengiriman',line:'Pembeli sudah membayar pesanan Anda',cta:'Siapkan pengiriman'}},
  'order-shipped':{en:{subject:'Your Market order is on its way',line:'The seller shipped your order',cta:'Track shipment'},id:{subject:'Pesanan Market Anda sedang dikirim',line:'Penjual telah mengirim pesanan Anda',cta:'Lacak pengiriman'}},
  'order-tracking':{en:{subject:'Shipment update',line:'The carrier updated your shipment',cta:'Track shipment'},id:{subject:'Pembaruan pengiriman',line:'Kurir memperbarui status paket Anda',cta:'Lacak pengiriman'}},
  'order-received':{en:{subject:'The buyer received their order',line:'The buyer confirmed delivery',cta:'View order'},id:{subject:'Pembeli sudah menerima pesanan',line:'Pembeli mengonfirmasi pengiriman',cta:'Lihat pesanan'}},
  'order-cancelled':{en:{subject:'Unpaid order cancelled',line:'The other party cancelled this unpaid order',cta:'View order'},id:{subject:'Pesanan yang belum dibayar dibatalkan',line:'Pihak lain membatalkan pesanan ini sebelum pembayaran',cta:'Lihat pesanan'}},
  'order-expired':{en:{subject:'Payment deadline passed',line:'Payment was not received before the deadline. The order is closed and the cards are available again.',cta:'View order'},id:{subject:'Batas pembayaran berakhir',line:'Pembayaran belum diterima sampai batas waktu. Pesanan ditutup dan kartu kembali tersedia.',cta:'Lihat pesanan'}},
  'order-dispute-opened':{en:{subject:'A buyer reported an order problem',line:'The buyer submitted a report and evidence. The order is on hold while it is reviewed.',cta:'View order'},id:{subject:'Pembeli melaporkan masalah pesanan',line:'Pembeli mengirim laporan dan bukti. Pesanan ditahan selama pemeriksaan.',cta:'Lihat pesanan'}},
  'order-dispute-response':{en:{subject:'The seller responded to your order report',line:'The seller added a response to your report. VivrePlay staff will review both sides.',cta:'View order'},id:{subject:'Penjual menanggapi laporan pesanan',line:'Penjual menambahkan tanggapan. Tim VivrePlay akan memeriksa kedua sisi.',cta:'Lihat pesanan'}},
  'order-dispute-resolved':{en:{subject:'A decision was made on your order report',line:'VivrePlay staff reviewed the report and recorded a decision. Open the order for details.',cta:'View order'},id:{subject:'Keputusan laporan pesanan tersedia',line:'Tim VivrePlay telah meninjau laporan dan mencatat keputusan. Buka pesanan untuk melihat detail.',cta:'Lihat pesanan'}},
};

const trackingStatusCopy:Record<string,{en:string;id:string}>={picking_up:{en:'The courier is on the way to collect your parcel',id:'Kurir sedang menuju lokasi penjual'},picked:{en:'Picked up by the courier',id:'Paket sudah dijemput kurir'},in_transit:{en:'In transit to you',id:'Paket sedang dalam perjalanan'},dropping_off:{en:'Out for delivery',id:'Paket sedang diantar'},delivered:{en:'Delivered',id:'Paket sudah diantar'},on_hold:{en:'Shipment is on hold',id:'Pengiriman tertahan'},rejected:{en:'Shipment was rejected',id:'Pengiriman ditolak'},cancelled:{en:'Shipment was cancelled',id:'Pengiriman dibatalkan'},return_in_transit:{en:'Returning to the seller',id:'Paket sedang dikembalikan ke penjual'},returned:{en:'Returned to the seller',id:'Paket sudah dikembalikan ke penjual'},disposed:{en:'Shipment was disposed of by the courier',id:'Paket dimusnahkan oleh kurir'},courier_not_found:{en:'No courier was assigned',id:'Kurir belum ditemukan'}};

function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]??char))}

function formatAmount(amount:number,currency:string,locale:string){try{return new Intl.NumberFormat(locale==='id'?'id-ID':'en-US',{style:'currency',currency:currency.toUpperCase(),maximumFractionDigits:currency.toUpperCase()==='JPY'?0:2}).format(amount)}catch{return `${currency.toUpperCase()} ${amount.toLocaleString()}`}}
function shippingDeadlineFromPayment(value:string|null|undefined,locale:string){
  const source=value??new Date().toISOString();
  const paidAt=new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(source)?source:`${source.replace(' ','T')}Z`);
  if(Number.isNaN(paidAt.getTime()))return undefined;
  const localParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(paidAt);
  const part=(type:Intl.DateTimeFormatPartTypes)=>localParts.find(item=>item.type===type)?.value;
  const year=Number(part('year'));const month=Number(part('month'));const day=Number(part('day'));
  if(!year||!month||!day)return undefined;
  const deadlineDate=new Date(Date.UTC(year,month-1,day));
  const weekday=deadlineDate.getUTCDay();deadlineDate.setUTCDate(deadlineDate.getUTCDate()+(weekday===5?3:weekday===6?2:1));
  const formatted=new Intl.DateTimeFormat(locale.toLowerCase().startsWith('id')?'id-ID':'en-ID',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(deadlineDate);
  return`${formatted}, ${locale.toLowerCase().startsWith('id')?'pukul':'at'} 21.00 WIB`;
}
function eventDetail(event:Event,details:NotificationDetails|undefined){
  if(event.startsWith('order-'))return undefined;
  if(event==='message'&&details?.message)return details.message;
  return undefined;
}

function personalizedCopy(event:Event,details:NotificationDetails|undefined,title:string,id:boolean,locale:string,surface:'email'|'push'='email'){
  const base=copy[event][id?'id':'en'];
  const name=details?.participant;
  const amount=details?.amount!==undefined&&details.currency?formatAmount(details.amount,details.currency,locale):undefined;
  const count=details?.itemCount;
  const cards=count?(id?`${count} kartu`:`${count} card${count===1?'':'s'}`):undefined;
  let subject=base.subject;
  let line=base.line;
  let cta=base.cta;
  switch(event){
    case 'wishlist-match':
    case 'price-drop':
      subject=id?`${event==='price-drop'?'Harga turun':'Kartu tersedia'}: ${title}${amount?`, ${amount}`:''}`:`${event==='price-drop'?'Price drop':'Wishlist match'}: ${title}${amount?`, ${amount}`:''}`;
      break;
    case 'new-offer':
      subject=id?`Penawaran untuk ${title}${amount?`, ${amount}`:''}`:`Offer for ${title}${amount?`, ${amount}`:''}`;
      line=surface==='push'?(id?`${name||'Kolektor'} menawarkan${amount?` ${amount}`:''}${cards?` untuk ${cards}`:''} pada listing ${title}`:`${name||'A collector'} offered${amount?` ${amount}`:''}${cards?` for ${cards}`:''} on your ${title} listing`):(id?'Ada penawaran baru untuk listing ini.':'A new offer is waiting on this listing.');
      break;
    case 'counteroffer':
      subject=id?`Penawaran balik untuk ${title}${amount?`, ${amount}`:''}`:`Counteroffer for ${title}${amount?`, ${amount}`:''}`;
      line=surface==='push'?(id?`${name||'Kolektor'} mengajukan${amount?` ${amount}`:''}${cards?` untuk ${cards}`:''} pada ${title}`:`${name||'A collector'} countered with${amount?` ${amount}`:''}${cards?` for ${cards}`:''} on ${title}`):(id?'Ada harga baru dalam percakapan listing ini.':'A new price is waiting in this listing conversation.');
      break;
    case 'accepted':
      subject=id?`Penawaran ${title} diterima${amount?`, ${amount}`:''}`:`Offer accepted for ${title}${amount?`, ${amount}`:''}`;
      line=surface==='push'?(id?`${name||'Penjual'} menerima penawaran${amount?` ${amount}`:''}${cards?` untuk ${cards}`:''} pada ${title}`:`${name||'The seller'} accepted your${amount?` ${amount}`:''}${cards?` offer for ${cards}`:''} on ${title}`):(id?'Kesepakatan siap ditinjau di percakapan.':'Review the agreed price and cards in your conversation.');
      break;
    case 'declined':
      subject=id?`Penawaran ${title} ditolak`:`Offer declined for ${title}`;
      line=surface==='push'?(id?`${name||'Kolektor'} menolak penawaran${amount?` ${amount}`:''}${cards?` untuk ${cards}`:''} pada ${title}`:`${name||'The other collector'} declined your${amount?` ${amount}`:''}${cards?` offer for ${cards}`:''} on ${title}`):(id?'Percakapan tetap tersedia jika Anda ingin meninjau penawarannya.':'The conversation is still open if you want to review the offer.');
      break;
    case 'offer-unavailable':
      subject=id?`Penawaran untuk ${title} ditutup`:`Offer closed for ${title}`;
      line=surface==='push'?(id?`Kartu dalam penawaran untuk ${title} sudah terjual.`:`The cards in your offer for ${title} have sold.`):(id?'Tidak ada kartu tersisa dari penawaran ini.':'None of the cards in this offer remain available.');
      break;
    case 'message':
      subject=id?`Pesan dari ${name||'kolektor'} tentang ${title}`:`Message from ${name||'a collector'} about ${title}`;
      line=surface==='push'?(id?`${name||'Kolektor'} mengirim pesan tentang listing ${title}`:`${name||'A collector'} sent a message about your ${title} listing`):(id?'Ada pesan baru di percakapan listing ini.':'There’s a new message in this listing conversation.');
      break;
    case 'photo-request':
      subject=id?`Permintaan foto untuk ${title}`:`Photo request for ${title}`;
      line=surface==='push'?(id?`${name||'Pembeli'} meminta foto${cards?` untuk ${cards}`:''} dari listing ${title}`:`${name||'The buyer'} asked for photos${cards?` of ${cards}`:''} from your ${title} listing`):(id?'Ada permintaan foto kartu di percakapan ini.':'A card photo request is waiting in this conversation.');
      break;
    case 'photo-shared':
      subject=id?`Foto kartu untuk ${title}`:`Card photos for ${title}`;
      line=surface==='push'?(id?`${name||'Penjual'} membagikan ${details?.photoCount??'beberapa'} foto${cards?` untuk ${cards}`:''} dari listing ${title}`:`${name||'The seller'} shared ${details?.photoCount??'new'} photos${cards?` of ${cards}`:''} from your ${title} listing`):(id?'Foto kartu baru tersedia di percakapan ini.':'New card photos are ready in this conversation.');
      break;
    case 'order-paid':
      subject=id?`Pembayaran ${details?.orderCode??title} berhasil`:`Payment received for ${details?.orderCode??title}`;
      if(details?.trackingNumber){
        line=surface==='push'?(id?`Pesanan dikirim${details.courier?` via ${details.courier}`:''}, nomor resi: ${details.trackingNumber}`:`Your order shipped${details.courier?` via ${details.courier}`:''}, tracking number: ${details.trackingNumber}`):(id?'Pesanan Anda sudah dikirim, gunakan nomor resi di bawah untuk melacak paket.':'Your order has shipped, and you can track the parcel using the details below.');
        cta=id?'Lacak pengiriman':'Track shipment';
      }else{
        line=id?'Pembayaran Anda sudah diterima, penjual akan menyiapkan kartu untuk dikirim.':'Your payment is confirmed, and the seller will prepare your cards for shipping.';
        cta=id?'Lihat pesanan':'View order';
      }
      break;
    case 'order-seller-paid':
      subject=id?`Pesanan ${details?.orderCode??title} sudah dibayar`:`Order ${details?.orderCode??title} has been paid`;
      line=surface==='push'?(id?`${name||'Pembeli'} membayar${amount?` ${amount}`:''} untuk ${cards?`${cards} dari ${title}`:title}, kirim paling lambat ${details?.shippingDeadline??shippingDeadlineFromPayment(undefined,locale)}`:`${name||'The buyer'} paid${amount?` ${amount}`:''} for ${cards?`${cards} from ${title}`:title}, please ship by ${details?.shippingDeadline??shippingDeadlineFromPayment(undefined,locale)}`):(id?'Pembayaran pesanan sudah diterima, siapkan paket untuk dikirim paling lambat pada batas waktu di bawah.':'The buyer has paid, so please prepare the parcel and ship by the deadline below.');
      break;
    case 'order-shipped':
      subject=id?`Pesanan ${details?.orderCode??title} sedang dikirim`:`Order ${details?.orderCode??title} is on its way`;
      line=id?`Paket dikirim${details?.courier?` dengan ${details.courier}`:''}${details?.trackingNumber?`, nomor resi ${details.trackingNumber}`:''}.`:`Your parcel was shipped${details?.courier?` with ${details.courier}`:''}${details?.trackingNumber?`, tracking number ${details.trackingNumber}`:''}.`;
      cta=id?'Lacak pengiriman':'Track shipment';break;
    case 'order-tracking':{
      const status=trackingStatusCopy[details?.trackingStatus??''];
      subject=id?`Pembaruan pengiriman ${details?.orderCode??title}`:`Shipment update for ${details?.orderCode??title}`;
      line=id?`${status?.id??'Status paket diperbarui'}${details?.courier?` oleh ${details.courier}`:''}${details?.trackingNumber?`, nomor resi ${details.trackingNumber}`:''}.`:`${status?.en??'Your parcel status changed'}${details?.courier?` with ${details.courier}`:''}${details?.trackingNumber?`, tracking number ${details.trackingNumber}`:''}.`;
      cta=id?'Lacak pengiriman':'Track shipment';break;
    }
    case 'order-received':
      subject=id?`${details?.orderCode??title} sudah diterima`:`${details?.orderCode??title} was delivered`;
      line=surface==='push'?(id?`${name||'Pembeli'} mengonfirmasi ${cards?`penerimaan ${cards} dari ${title}`:`penerimaan pesanan ${title}`}, kartu sudah masuk ke koleksinya`:`${name||'The buyer'} confirmed delivery${cards?` of ${cards}`:''} from ${title}, and the cards are now in their collection`):(id?'Pembeli sudah mengonfirmasi penerimaan pesanan, kartu kini tercatat di koleksinya.':'The buyer confirmed delivery, and the cards are now saved in their collection.');
      break;
    case 'order-cancelled':
      subject=id?`Pesanan ${details?.orderCode??title} dibatalkan`:`Order ${details?.orderCode??title} was cancelled`;
      line=surface==='push'?(id?`${name||'Pihak lain'} membatalkan pesanan ${cards?`${cards} `:''}untuk ${title}${amount?`, senilai ${amount}`:''}`:`${name||'The other party'} cancelled the ${cards?`${cards} `:''}order for ${title}${amount?`, worth ${amount}`:''}`):(id?'Pesanan dibatalkan sebelum pembayaran, jadi kartu kembali tersedia.':'The order was cancelled before payment, so the cards are available again.');
      break;
    case 'order-expired':
      subject=id?`Pesanan ${details?.orderCode??title} berakhir`:`Order ${details?.orderCode??title} expired`;
      line=id?'Batas pembayaran QRIS berakhir tanpa pembayaran, pesanan ditutup dan kartu kembali tersedia.':'The QRIS payment window ended without payment, so the order is closed and the cards are available again.';
      break;
    case 'order-dispute-opened':
      subject=id?`Laporan masalah untuk ${details?.orderCode??title}`:`A problem was reported for ${details?.orderCode??title}`;break;
    case 'order-dispute-response':
      subject=id?`Tanggapan penjual untuk ${details?.orderCode??title}`:`Seller response for ${details?.orderCode??title}`;break;
    case 'order-dispute-resolved':
      subject=id?`Keputusan pesanan ${details?.orderCode??title}`:`Decision for ${details?.orderCode??title}`;break;
  }
  return{...base,subject:subject.slice(0,150),line,cta};
}

export function renderMarketEmail(event:Event,listingTitle='Edward.Newgate (001)',threadId='sample-market-thread',locale='en',recipient='navigator@example.com',theme?:'light'|'dark',details?:NotificationDetails):RenderedEmail{
  const id=locale.toLowerCase().startsWith('id');const message=personalizedCopy(event,details,listingTitle,id,locale);
  const base=getAppUrl().replace(/\/$/,'');const isOrder=event.startsWith('order-');
  const watch=event==='wishlist-match'||event==='price-drop';
  const url=watch?`${base}/market/${encodeURIComponent(threadId)}`:`${base}/market?activity=${isOrder?'orders':'offers'}${isOrder?`&order=${encodeURIComponent(threadId)}`:`&conversation=${encodeURIComponent(threadId)}`}`;
  const title=escapeHtml(listingTitle);const safeUrl=escapeHtml(url);const safeRecipient=escapeHtml(recipient);
  const detail=eventDetail(event,details);
  const safeDetail=detail?escapeHtml(detail):'';
  const eventHeading=watch?(event==='price-drop'?(id?'Harga turun':'Price drop'):(id?'Kartu tersedia':'Wishlist match')):event==='order-dispute-opened'?(id?'Laporan masalah pesanan':'Order problem report'):event==='order-dispute-response'?(id?'Tanggapan penjual':'Seller response'):event==='order-dispute-resolved'?(id?'Keputusan laporan':'Report decision'):event==='offer-unavailable'?(id?'Kartu terjual':'Cards sold'):event==='order-expired'?(id?'Pembayaran berakhir':'Payment expired'):event==='order-cancelled'?(id?'Pesanan dibatalkan':'Order cancelled'):event==='order-seller-paid'?(id?'Pesanan dibayar':'Order paid'):event==='order-shipped'?(id?'Pesanan dikirim':'Order shipped'):event==='order-tracking'?(id?'Status pengiriman':'Shipment status'):event==='order-paid'?(id?'Pembayaran diterima':'Payment received'):event==='order-received'?(id?'Pesanan diterima':'Delivery confirmed'):event==='new-offer'?(id?'Penawaran baru':'New offer'):event==='counteroffer'?(id?'Penawaran balik':'Counteroffer'):event==='accepted'?(id?'Penawaran diterima':'Offer accepted'):event==='declined'?(id?'Penawaran ditolak':'Offer declined'):event==='message'?(id?'Pesan baru':'New message'):event==='photo-request'?(id?'Permintaan foto':'Photo request'):(id?'Foto kartu dibagikan':'Card photos shared');
  const summaryRows:Array<[string,string]>=[];
  if(event.startsWith('order-')&&details?.orderCode){
    summaryRows.push([id?'Pesanan':'Order',details.orderCode]);
    if(details.participant)summaryRows.push([event==='order-paid'?(id?'Penjual':'Seller'):event==='order-cancelled'?(id?'Dibatalkan oleh':'Cancelled by'):(id?'Pembeli':'Buyer'),details.participant]);
    if(details.subtotal!==undefined&&details.currency)summaryRows.push([id?'Subtotal':'Subtotal',formatAmount(details.subtotal,details.currency,locale)]);
    if(details.courier)summaryRows.push([id?'Kurir':'Courier',details.courier]);
    if(event==='order-tracking'&&details.trackingStatus)summaryRows.push([id?'Status':'Status',trackingStatusCopy[details.trackingStatus]?.[id?'id':'en']??details.trackingStatus]);
    if(event==='order-paid'&&details.trackingNumber)summaryRows.push([id?'Nomor resi':'Tracking number',details.trackingNumber]);
    if(details.shippingFee!==undefined&&details.currency)summaryRows.push([id?'Ongkir':'Shipping',formatAmount(details.shippingFee,details.currency,locale)]);
    if(details.amount!==undefined&&details.currency)summaryRows.push([id?'Total dibayar':'Total paid',formatAmount(details.amount,details.currency,locale)]);
    if(details.city)summaryRows.push([id?'Kota tujuan':'Destination',`${details.city}${details.postalCode?` ${details.postalCode}`:''}`]);
    if(event==='order-seller-paid')summaryRows.push([id?'Kirim paling lambat':'Ship by',details.shippingDeadline??shippingDeadlineFromPayment(undefined,locale)??'']);
  }else if(['new-offer','counteroffer','accepted','declined','offer-unavailable'].includes(event)){
    if(details?.participant)summaryRows.push([id?'Dari':'From',details.participant]);
    if(details?.amount!==undefined&&details.currency)summaryRows.push([id?'Total penawaran':'Offer total',formatAmount(details.amount,details.currency,locale)]);
  }else if(event==='message'&&details?.participant)summaryRows.push([id?'Pengirim':'From',details.participant]);
  else if(event==='photo-shared'&&details?.photoCount){summaryRows.push([id?'Dibagikan oleh':'Shared by',details.participant|| (id?'Penjual':'Seller')],[id?'Jumlah foto':'Photos',String(details.photoCount)]);}
  else if(event==='photo-request'&&details?.participant)summaryRows.push([id?'Diminta oleh':'Requested by',details.participant]);
  if(watch&&details?.amount!==undefined&&details.currency)summaryRows.push([id?'Harga listing':'Listing price',formatAmount(details.amount,details.currency,locale)]);
  const summaryHtml=summaryRows.length?`<table role="presentation" class="email-summary" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #dfe3e8;border-radius:8px;background:#f8f9fb;border-collapse:separate;border-spacing:0;overflow:hidden">${summaryRows.map(([label,value])=>`<tr><td style="padding:9px 12px;border-bottom:1px solid #e7e9ed;color:#697386;font-size:13px">${escapeHtml(label)}</td><td style="padding:9px 12px;border-bottom:1px solid #e7e9ed;color:#172033;font-size:13px;font-weight:700;text-align:right">${escapeHtml(value)}</td></tr>`).join('')}</table>`:'';
  const cardCount=details?.items?.reduce((sum,item)=>sum+item.quantity,0)??0;
  const itemsHeading=cardCount===1?(id?'Kartu':'Card'):id?`Kartu (${cardCount})`:`Cards (${cardCount})`;
  const itemRows=(details?.items??[]).map(item=>{const meta=[item.code,item.language,item.variant.replace(/\s*·\s*/g,', '),item.rarity,item.condition].filter(Boolean).join(', ');const lineTotal=item.unitAmount===undefined?undefined:item.unitAmount*item.quantity;return `<tr><td style="padding:11px 12px;border-top:1px solid #e7e9ed;color:#292b27;font-size:13px;font-weight:700">${escapeHtml(`${item.quantity}× ${item.name}`)}<br><span style="color:#6f7169;font-size:11px;font-weight:400">${escapeHtml(meta)}</span></td><td style="padding:11px 12px;border-top:1px solid #e7e9ed;color:#292b27;font-size:13px;text-align:right;white-space:nowrap">${lineTotal!==undefined&&details?.currency?escapeHtml(formatAmount(lineTotal,details.currency,locale)):''}</td></tr>`}).join('');
  const itemHtml=itemRows?`<h2 class="email-items-heading" style="margin:22px 0 8px;color:#272c28;font-size:15px">${escapeHtml(itemsHeading)}</h2><table role="presentation" class="email-items" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border:1px solid #e1dbcf;border-radius:8px;background:#f8f6f0;border-collapse:separate;border-spacing:0;overflow:hidden"><tbody>${itemRows}</tbody></table>`:'';
  const summaryText=summaryRows.map(([label,value])=>`${label}: ${value}`).join('\n');
  const itemsText=(details?.items??[]).map(item=>{const meta=[item.code,item.language,item.variant.replace(/\s*·\s*/g,', '),item.rarity,item.condition].filter(Boolean).join(', ');const price=item.unitAmount!==undefined&&details?.currency?`: ${formatAmount(item.unitAmount*item.quantity,details.currency,locale)}`:'';return`- ${item.quantity}× ${item.name} (${meta})${price}`}).join('\n');
  const preheader=[message.line,...summaryRows.map(([label,value])=>`${label}: ${value}`),...(details?.items??[]).slice(0,3).map(item=>`${item.quantity}× ${item.name}, ${item.code}`),detail].filter(Boolean).join(' | ');
  const footerCopy=id?'Email ini dikirim karena ada aktivitas Market di akun Anda':'You received this email because of activity on your Market account';
  const brandImage=`${base}/brand/vivreplay-compass.png`;
  const lightCss='.email-bg{background:#f1eee6!important;color:#292b27!important}.email-card{background:#fffdf8!important;border-color:#e1dbcf!important;color:#292b27!important}.email-summary,.email-items{background:#f8f6f0!important;border-color:#e1dbcf!important}.email-summary td,.email-items td{background:#f8f6f0!important;color:#292b27!important;border-color:#e7e2d7!important}.email-title,.email-items-heading{color:#272c28!important}.email-lede{color:#625f56!important}.email-listing-title{color:#292b27!important}.email-detail{background:#f7f4ec!important;border-color:#e1dbcf!important;color:#45463f!important}.email-header{background:#f5efe2!important;border-bottom-color:#c99b3c!important}.email-brand-name{color:#272c28!important}.email-brand-divider{color:#8d887e!important}.email-market-name{color:#896318!important}.email-footer{background:#eee9de!important;color:#625f56!important}.email-muted{color:#777267!important}.email-link{color:#815510!important}.email-button{background:#b8791d!important;color:#fffdf7!important}';
  const darkCss='.email-bg{background:#10171d!important;color:#e8e7e1!important}.email-card{background:#182129!important;border-color:#303b43!important;color:#e8e7e1!important}.email-summary,.email-items{background:#182129!important;border-color:#303b43!important}.email-summary td,.email-items td{background:#182129!important;color:#e8e7e1!important;border-color:#303b43!important}.email-title,.email-items-heading{color:#f3f0e8!important}.email-lede{color:#c5c7c2!important}.email-listing-title{color:#e8e7e1!important}.email-detail{background:#202932!important;border-color:#34404a!important;color:#e8e7e1!important}.email-header{background:#182129!important;border-bottom-color:#d8a63b!important}.email-brand-name{color:#f3f0e8!important}.email-brand-divider{color:#9aa5a9!important}.email-market-name{color:#e6bd70!important}.email-footer{background:#141c23!important;color:#bdc4c3!important}.email-muted{color:#a0aaa9!important}.email-link{color:#e6bd70!important}.email-button{background:#d69b36!important;color:#171b1e!important}';
  const emailTheme=theme==='light'||theme==='dark'?theme:'auto';
  const themeCss=emailTheme==='dark'?darkCss:emailTheme==='light'?lightCss:`@media(prefers-color-scheme:dark){${darkCss}}`;
  const colorScheme=emailTheme==='auto'?'light dark':emailTheme;
  const html=`<!doctype html><html lang="${id?'id':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="${colorScheme}"><meta name="supported-color-schemes" content="${colorScheme}"><title>${escapeHtml(message.subject)}</title><style>:root{color-scheme:${colorScheme};supported-color-schemes:${colorScheme}}${themeCss}</style></head><body class="email-bg" style="margin:0;padding:28px 14px;background:#f1eee6;color:#292b27;font:16px/1.5 Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${escapeHtml(preheader.slice(0,180))}</div><main class="email-card" style="max-width:620px;margin:0 auto;background:#fffdf8;border:1px solid #e1dbcf;border-radius:10px;overflow:hidden"><header class="email-header" style="padding:22px 28px;background:#f5efe2;border-bottom:2px solid #c99b3c"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="vertical-align:middle;padding-right:10px"><img src="${escapeHtml(brandImage)}" width="34" height="34" alt="VivrePlay" style="display:block;width:34px;height:34px"></td><td class="email-brand-name" style="vertical-align:middle;color:#272c28;font-size:19px;font-weight:700;letter-spacing:-.03em">VivrePlay</td><td class="email-brand-divider" style="vertical-align:middle;padding:0 10px;color:#8d887e;font-size:20px;font-weight:400">|</td><td class="email-market-name" style="vertical-align:middle;color:#896318;font-size:14px;font-weight:700">Market</td></tr></table></header><section style="padding:28px 30px 30px"><h1 class="email-title" style="margin:0 0 10px;color:#272c28;font-size:25px;line-height:1.25;letter-spacing:-.025em">${escapeHtml(eventHeading)}</h1><p class="email-lede" style="margin:0 0 6px;color:#625f56">${escapeHtml(message.line)}</p><p class="email-listing-title" style="margin:0 0 18px;color:#292b27;font-weight:700">${title}</p>${summaryHtml}${itemHtml}${safeDetail?`<p class="email-detail" style="margin:0 0 20px;padding:12px 14px;border:1px solid #e1dbcf;border-radius:6px;background:#f7f4ec;color:#45463f;font-size:14px;font-weight:600">${safeDetail}</p>`:''}<p style="margin:22px 0 0"><a class="email-button" style="display:inline-block;padding:12px 20px;background:#b8791d;color:#fffdf7;text-decoration:none;border-radius:6px;font-size:15px;font-weight:700" href="${safeUrl}">${escapeHtml(message.cta)}</a></p></section><footer class="email-footer" style="padding:18px 30px;background:#eee9de;color:#625f56;font-size:12px"><p style="margin:0 0 6px">${escapeHtml(footerCopy)}</p><p class="email-muted" style="margin:0;color:#777267">${id?'Dikirim ke':'Sent to'} ${safeRecipient} <span style="padding:0 5px">|</span> <a class="email-link" href="mailto:${DEFAULT_SUPPORT_EMAIL}" style="color:#815510;text-decoration:underline">${DEFAULT_SUPPORT_EMAIL}</a> <span style="padding:0 5px">|</span> <a class="email-link" href="https://wa.me/6287892660993" style="color:#815510;text-decoration:underline">WhatsApp +62 878-9266-0993</a></p></footer></main></body></html>`;
  const text=`${message.subject}\n\n${message.line}\n\n${listingTitle}${summaryText?`\n\n${summaryText}`:''}${itemsText?`\n\n${itemsHeading}\n${itemsText}`:''}${detail?`\n\n${detail}`:''}\n\n${message.cta}: ${url}\n\n${footerCopy}\n${id?'Dikirim ke':'Sent to'} ${recipient}\n${DEFAULT_SUPPORT_EMAIL}\nWhatsApp: +62 878-9266-0993`;
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
  const items:NotificationItem[]=[{name:'Monkey.D.Luffy',code:'OP05-119',language:'JP',variant:'Alt art, p1',rarity:'SEC',condition:'NM',quantity:1,unitAmount:175000},{name:'Monkey.D.Luffy',code:'OP05-119',language:'EN',variant:'Standard',rarity:'SEC',condition:'NM',quantity:1,unitAmount:75000}];
  if(event.startsWith('order-'))return{orderCode:'VPM-KREH2VS2VQ',amount:285000,currency:'IDR',subtotal:250000,shippingFee:35000,courier:'J&T EZ',trackingNumber:event==='order-tracking'?'JP1234567890':undefined,trackingStatus:event==='order-tracking'?'dropping_off':undefined,city:'Jakarta Pusat',postalCode:'10110',shippingDeadline:event==='order-seller-paid'?shippingDeadlineFromPayment(new Date().toISOString(),locale):undefined,itemCount:2,items,participant:id?'Raka':'Raka Viantoni'};
  if(event==='new-offer'||event==='counteroffer'||event==='accepted'||event==='declined'||event==='offer-unavailable')return{participant:id?'Dimas':'Dimas Pratama',amount:250000,currency:'IDR',itemCount:2,items};
  if(event==='message')return{participant:id?'Dimas':'Dimas Pratama',message:id?'Bisa kirim foto bagian belakang kartunya?':'Could you send a photo of the back of the card?',itemCount:2,items};
  if(event==='photo-request')return{participant:id?'Dimas':'Dimas Pratama',itemCount:2,items};
  if(event==='photo-shared')return{participant:id?'Dimas':'Dimas Pratama',photoCount:3,itemCount:2,items};
  return{};
}

function itemCount(value:string|null|undefined){
  try{const items=JSON.parse(value||'[]') as Array<{quantity?:number}>;return items.reduce((sum,item)=>sum+(Number.isFinite(item.quantity)?Number(item.quantity):0),0)}catch{return undefined}
}

async function notificationItems(value:string|null|undefined):Promise<NotificationItem[]>{
  const raw:Array<{printingId:string;quantity:number;unitAmount?:number;condition?:string}>=[];
  try{const parsed=JSON.parse(value||'[]') as unknown;if(!Array.isArray(parsed))return[];for(const value of parsed){if(!value||typeof value!=='object')continue;const item=value as {printingId?:unknown;quantity?:unknown;unitAmount?:unknown;condition?:unknown};if(typeof item.printingId!=='string'||!Number.isInteger(item.quantity)||Number(item.quantity)<1)continue;raw.push({printingId:item.printingId,quantity:Number(item.quantity),unitAmount:Number.isSafeInteger(item.unitAmount)?Number(item.unitAmount):undefined,condition:typeof item.condition==='string'?item.condition:undefined});if(raw.length===12)break}}catch{return[]}
  let cards=new Map<string,{name:string;code:string;language:string;variant:string;rarity:string}>();
  try{cards=await marketCardThumbnails(raw.map(item=>item.printingId)).then(result=>new Map([...result].map(([id,card])=>[id,{name:card.name,code:card.code,language:card.language,variant:card.variant,rarity:card.rarity}])))}catch(error){console.error('market_notification_cards_failed',error instanceof Error?error.message:'unknown error')}
  return raw.map(item=>{const card=cards.get(item.printingId);return{name:card?.name??'Card',code:card?.code??item.printingId,language:card?.language??'',variant:card?.variant??'',rarity:card?.rarity,condition:item.condition,quantity:item.quantity,unitAmount:Number.isSafeInteger(item.unitAmount)&&Number(item.unitAmount)>0?Number(item.unitAmount):undefined}});
}

async function notificationDetails(event:Event,reference:string,locale='en'):Promise<NotificationDetails|undefined>{
  if(event==='wishlist-match'||event==='price-drop'){const row=await db().prepare('SELECT amount,currency,items,printing_id AS printingId,quantity FROM listings WHERE id=?').bind(reference).first<{amount:number;currency:string;items:string|null;printingId:string;quantity:number}>();if(row)return{amount:row.amount,currency:row.currency,items:await notificationItems(row.items||JSON.stringify([{printingId:row.printingId,quantity:row.quantity}]))};return undefined;}
  if(event.startsWith('order-')){
    const row=await db().prepare(`SELECT o.id,o.amount,o.currency,o.items,o.details,o.subtotal,o.shipping_fee AS shippingFee,COALESCE(o.paid_at,o.fulfilled_at) AS paidAt,o.updated_at AS updatedAt,COALESCE(b.display_name,'Buyer') AS buyer,COALESCE(s.display_name,'Seller') AS seller
      FROM checkout_orders o LEFT JOIN profiles b ON b.id=o.buyer_id LEFT JOIN profiles s ON s.id=o.seller_id WHERE o.id=?`).bind(reference).first<{id:string;amount:number;currency:string;items:string;details:string|null;subtotal:number;shippingFee:number;paidAt:string|null;updatedAt:string;buyer:string;seller:string}>();
    if(!row)return undefined;
    let shipping:{courierName?:string;courierServiceName?:string;trackingNumber?:string;tracking_number?:string;waybillId?:string;waybill_id?:string;trackingStatus?:string;city?:string;postalCode?:string;cancelledByRole?:string}|undefined;try{shipping=JSON.parse(row.details||'{}') as typeof shipping}catch{}
    const cancelledBy=shipping?.cancelledByRole==='seller'?'seller':'buyer';
    return{orderCode:`VPM-${row.id.slice(0,8).toUpperCase()}`,amount:row.amount,currency:row.currency,subtotal:row.subtotal,shippingFee:row.shippingFee,itemCount:itemCount(row.items),items:await notificationItems(row.items),participant:event==='order-paid'?row.seller:event==='order-cancelled'?(cancelledBy==='seller'?row.seller:row.buyer):event==='order-dispute-response'?row.seller:row.buyer,courier:[shipping?.courierName,shipping?.courierServiceName].filter(Boolean).join(' '),trackingNumber:shipping?.trackingNumber??shipping?.tracking_number??shipping?.waybillId??shipping?.waybill_id,trackingStatus:shipping?.trackingStatus as string|undefined,city:shipping?.city,postalCode:shipping?.postalCode,shippingDeadline:event==='order-seller-paid'?shippingDeadlineFromPayment(row.paidAt??row.updatedAt,locale):undefined};
  }
  if(event==='new-offer'||event==='counteroffer'||event==='accepted'||event==='declined'||event==='offer-unavailable'){
    if(event==='accepted'||event==='declined'){
      const kind=event==='accepted'?'OFFER_ACCEPTED':'OFFER_DECLINED';
      const response=await db().prepare(`SELECT o.amount,o.currency,o.items,p.display_name AS participant FROM listing_offer_messages m
        JOIN listing_offers o ON o.id=m.offer_id LEFT JOIN profiles p ON p.id=m.actor_id
        WHERE m.thread_id=? AND m.kind=? ORDER BY m.created_at DESC,m.rowid DESC LIMIT 1`).bind(reference,kind).first<{amount:number;currency:string;items:string;participant:string|null}>();
      if(response)return{amount:response.amount,currency:response.currency,itemCount:itemCount(response.items),items:await notificationItems(response.items),participant:response.participant??undefined};
    }
    const row=await db().prepare(`SELECT o.amount,o.currency,o.items,p.display_name AS participant FROM listing_offers o LEFT JOIN profiles p ON p.id=o.actor_id
      WHERE o.id=? OR COALESCE(o.thread_id,o.id)=? ORDER BY o.created_at DESC,o.rowid DESC LIMIT 1`).bind(reference,reference).first<{amount:number;currency:string;items:string;participant:string|null}>();
    if(!row)return undefined;
    return{amount:row.amount,currency:row.currency,itemCount:itemCount(row.items),items:await notificationItems(row.items),participant:row.participant??undefined};
  }
  if(event==='message'||event==='photo-request'||event==='photo-shared'){
    const row=await db().prepare(`SELECT m.kind,m.body,p.display_name AS participant,(SELECT COUNT(*) FROM listing_offer_attachments a WHERE a.message_id=m.id) AS photoCount
      FROM listing_offer_messages m LEFT JOIN profiles p ON p.id=m.actor_id WHERE m.thread_id=? ORDER BY m.created_at DESC,m.rowid DESC LIMIT 1`).bind(reference).first<{kind:string;body:string|null;participant:string|null;photoCount:number}>();
    if(!row)return undefined;
    const message=row.body?.trim().replace(/\s+/g,' ').slice(0,220);
    const offer=await db().prepare(`SELECT o.items,o.amount,o.currency FROM listing_offers o WHERE COALESCE(o.thread_id,o.id)=? ORDER BY o.created_at DESC,o.rowid DESC LIMIT 1`).bind(reference).first<{items:string;amount:number;currency:string}>();
    return{participant:row.participant??undefined,message:message||undefined,photoCount:row.photoCount||undefined,itemCount:offer?itemCount(offer.items):undefined,items:offer?await notificationItems(offer.items):undefined,amount:offer?.amount,currency:offer?.currency};
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
    const id=locale?.toLowerCase().startsWith('id')?'id':'en';const message=personalizedCopy(event,details,listingTitle,id==='id',id,'push');
    const isOrder=event.startsWith('order-');
    const extra=eventDetail(event,details);
    const watch=event==='wishlist-match'||event==='price-drop';
    const payload=JSON.stringify({title:message.subject,body:[message.line,extra].filter(Boolean).join(' - ').slice(0,240),url:watch?`/market/${encodeURIComponent(threadId)}`:`/market?activity=${isOrder?'orders':'offers'}${isOrder?`&order=${encodeURIComponent(threadId)}`:`&conversation=${encodeURIComponent(threadId)}`}`,tag:`market-${event}-${threadId}`});
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
    try{details=await notificationDetails(event,threadId,recipient.locale??'en')}catch(error){console.error('market_notification_details_failed',error instanceof Error?error.message:'unknown error')}
    await deliverPush(profileId,event,listingTitle,threadId,recipient.locale??'en',details);
    if(recipient.email)await sendRenderedMarketEmail(recipient.email,event,listingTitle,threadId,recipient.locale??'en',undefined,details);
  }catch(error){console.error('market_email_delivery_failed',error instanceof Error?error.message:'unknown error')}
}
