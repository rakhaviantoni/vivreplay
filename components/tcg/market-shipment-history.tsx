import LocalizedAnchor from '@/components/ui/localized-link';
import {useEffect,useRef,useState,type ReactNode} from 'react';

type Scan={status?:string;note?:string;updated_at?:string};
type Props={status?:string;history?:Scan[];language:'EN'|'ID';timezone:string;headingAction?:ReactNode;role?:'buyer'|'seller';orderId?:string};

const labels:Record<string,[string,string]>={manual_shipped:['Seller shipped the parcel','Paket dikirim oleh penjual'],confirmed:['Shipment confirmed','Pengiriman dikonfirmasi'],allocated:['Courier assigned','Kurir ditugaskan'],picking_up:['Courier heading to seller','Kurir menuju penjual'],picked:['Parcel collected','Paket dijemput'],in_transit:['In transit','Dalam perjalanan'],dropping_off:['Out for delivery','Sedang diantar'],delivered:['Delivered','Pesanan diterima'],on_hold:['Shipment on hold','Pengiriman tertahan'],rejected:['Delivery declined','Pengiriman ditolak penerima'],cancelled:['Shipment cancelled','Pengiriman dibatalkan'],return_in_transit:['Returning to seller','Sedang dikembalikan ke penjual'],returned:['Returned to seller','Paket diterima kembali oleh penjual'],disposed:['Parcel disposed by courier','Paket dimusnahkan kurir'],lost:['Parcel reported lost','Paket dilaporkan hilang'],damaged:['Parcel reported damaged','Paket dilaporkan rusak'],courier_not_found:['Courier unavailable','Kurir tidak tersedia']};
const normalized=(value:string)=>value.replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase().replace(/\s+/g,'_');
const statusCode=(value:string)=>{const code=normalized(value);if(code.includes('return')&&code!=='returned')return 'return_in_transit';if(code.includes('destroy')||code.includes('dispos'))return 'disposed';if(code.includes('lost'))return 'lost';if(code.includes('damage'))return 'damaged';if(code.includes('reject'))return 'rejected';if(code.includes('courier')&&code.includes('allocat'))return 'allocated';if(code.includes('courier')&&code.includes('pick'))return 'picking_up';if(code==='picked_up'||code==='pickedup')return 'picked';if(code==='complete'||code==='completed')return 'delivered';return code};
const localizedNote=(note:string,status:string,id:boolean)=>{
  if(!id)return note;
  const text=note.trim().toLowerCase();
  if(/courier order is confirmed/.test(text)){const pickup=note.match(/pickup\s*(?:number|no\.?|#)\s*[:#-]?\s*([\w-]+)/i)?.[1];return pickup?`Pengiriman dikonfirmasi. Nomor penjemputan: ${pickup}`:'Pengiriman dikonfirmasi dan menunggu penjemputan kurir.'}
  if(text.includes('order has been delivered'))return 'Paket telah tiba di alamat tujuan.';
  if(text.includes('courier is dropping off'))return 'Kurir sedang mengantar paket ke alamat tujuan.';
  if(text.includes('on hold'))return 'Pengiriman tertahan sementara karena kendala.';
  if(text.includes('on the way to destination'))return 'Paket sedang dalam perjalanan ke alamat tujuan.';
  if(text.includes('has been picked by courier'))return 'Paket sudah dijemput kurir.';
  if(text.includes('on the way to pick up'))return 'Kurir sedang menuju lokasi penjual.';
  if(text.includes('allocated')&&text.includes('pick up'))return 'Kurir telah ditugaskan untuk menjemput paket.';
  if(text.includes('destroy')||text.includes('dispos'))return 'Paket dimusnahkan oleh kurir.';
  if(text.includes('lost'))return 'Kurir melaporkan paket hilang.';
  if(text.includes('damaged'))return 'Kurir melaporkan paket rusak.';
  if(text.includes('reject'))return 'Penerima menolak paket.';
  return note;
};

export function MarketShipmentHistory({status,history,language,timezone,headingAction,role,orderId}:Props){
  const indonesian=language==='ID';
  const scans=[...(history??[])].sort((a,b)=>Date.parse(b.updated_at??'')-Date.parse(a.updated_at??''));
  const signature=scans.map(scan=>`${scan.updated_at??''}:${statusCode(scan.status??'')}:${scan.note??''}`).join('|');
  const previous=useRef<string|null>(null);
  const [newestSignature,setNewestSignature]=useState('');
  useEffect(()=>{if(previous.current!==null&&previous.current!==signature)setNewestSignature(signature);previous.current=signature},[signature]);
  useEffect(()=>{if(!newestSignature)return;const timer=window.setTimeout(()=>setNewestSignature(''),1800);return()=>window.clearTimeout(timer)},[newestSignature]);
  const label=(value:string)=>labels[statusCode(value)]?.[indonesian?1:0]??value.replace(/[_-]+/g,' ').replace(/\b\w/g,char=>char.toUpperCase());
  const date=(value:string)=>{const parsed=new Date(value);return Number.isNaN(parsed.getTime())?value:new Intl.DateTimeFormat(indonesian?'id-ID':'en-ID',{dateStyle:'medium',timeStyle:'short',timeZone:timezone}).format(parsed)};
  const currentStatus=statusCode(status??'');
  const returnInProgress=currentStatus==='return_in_transit';
  const returned=currentStatus==='returned';
  const seriousIssue=['disposed','lost','damaged','rejected','cancelled'].includes(currentStatus);
  const issueText=returnInProgress?(role==='seller'?(indonesian?'Paket sedang dikembalikan kepada Anda. Hubungi pembeli sebelum mengatur pengiriman berikutnya.':'The parcel is being returned to you. Contact the buyer before arranging another delivery.'):(indonesian?'Paket sedang dikembalikan kepada penjual. Hubungi penjual untuk menentukan langkah berikutnya.':'The parcel is being returned to the seller. Contact them to agree on the next step.')):returned?(role==='seller'?(indonesian?'Paket sudah kembali kepada Anda. Hubungi pembeli untuk menentukan langkah berikutnya.':'The parcel has returned to you. Contact the buyer to agree on the next step.'):(indonesian?'Paket sudah dikembalikan kepada penjual. Hubungi penjual untuk menentukan langkah berikutnya.':'The parcel has been returned to the seller. Contact the seller to agree on the next step.')):seriousIssue?(indonesian?'Kurir melaporkan masalah pada pengiriman ini. Hubungi dukungan VivrePlay dan sertakan nomor pesanan.':'The courier reported a problem with this delivery. Contact VivrePlay support and include your order number.'):'';
  const supportHref=`mailto:support@vivreplay.com?subject=${encodeURIComponent(`${indonesian?'Masalah pengiriman':'Delivery issue'}${orderId?` VPM-${orderId.slice(0,8).toUpperCase()}`:''}`)}`;
  if(!status&&!scans.length&&!headingAction)return null;
  return <section className="market-shipment-history" aria-label={indonesian?'Riwayat pengiriman':'Shipment history'}>
    <h4 className="market-shipping-section-title">{indonesian?'Riwayat pengiriman':'Shipment history'}{headingAction}</h4>
    {scans.length?<ol>{scans.map((scan,index)=>{const key=`${scan.updated_at??'scan'}:${normalized(scan.status??'')}:${scan.note??''}`;const note=scan.note?localizedNote(scan.note,scan.status??status??'',indonesian):'';return <li key={key} className={newestSignature===signature&&index===0?'is-new-update':undefined}><strong>{label(scan.status??status??'')}</strong>{note&&<span>{note}</span>}{scan.updated_at&&<time dateTime={scan.updated_at}>{date(scan.updated_at)}</time>}</li>})}</ol>:<p>{status?label(status):(indonesian?'Pembaruan kurir akan muncul di sini.':'Courier updates will appear here.')}</p>}
    {issueText&&<aside className="market-shipment-issue" role="status"><p>{issueText}</p>{seriousIssue&&<LocalizedAnchor href={supportHref}>{indonesian?'Hubungi dukungan':'Contact support'}</LocalizedAnchor>}</aside>}
  </section>;
}
