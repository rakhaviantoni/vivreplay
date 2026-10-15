import type {ReactNode} from 'react';

type Scan={status?:string;note?:string;updated_at?:string};
type Props={status?:string;history?:Scan[];language:'EN'|'ID';timezone:string;headingAction?:ReactNode};

const labels:Record<string,[string,string]>={confirmed:['Shipment confirmed','Pengiriman dikonfirmasi'],allocated:['Courier assigned','Kurir ditugaskan'],picking_up:['Courier heading to seller','Kurir menuju penjual'],picked:['Parcel collected','Paket dijemput'],in_transit:['In transit','Dalam perjalanan'],dropping_off:['Out for delivery','Sedang diantar'],delivered:['Delivered','Terkirim'],on_hold:['Shipment on hold','Pengiriman tertahan'],rejected:['Shipment rejected','Pengiriman ditolak'],cancelled:['Shipment cancelled','Pengiriman dibatalkan'],return_in_transit:['Returning to seller','Kembali ke penjual'],returned:['Returned to seller','Dikembalikan ke penjual'],courier_not_found:['Courier unavailable','Kurir tidak tersedia']};
const normalized=(value:string)=>value.replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase().replace(/\s+/g,'_');

export function MarketShipmentHistory({status,history,language,timezone,headingAction}:Props){
  const indonesian=language==='ID';
  const scans=[...(history??[])].sort((a,b)=>Date.parse(b.updated_at??'')-Date.parse(a.updated_at??''));
  const label=(value:string)=>labels[normalized(value)]?.[indonesian?1:0]??value.replaceAll('_',' ');
  const date=(value:string)=>{const parsed=new Date(value);return Number.isNaN(parsed.getTime())?value:new Intl.DateTimeFormat(indonesian?'id-ID':'en-ID',{dateStyle:'medium',timeStyle:'short',timeZone:timezone}).format(parsed)};
  if(!status&&!scans.length)return null;
  return <section className="market-shipment-history" aria-label={indonesian?'Riwayat pengiriman':'Shipment history'}>
    <h4>{indonesian?'Riwayat pengiriman':'Shipment history'}{headingAction}</h4>
    {scans.length?<ol>{scans.map((scan,index)=><li key={`${scan.updated_at??'scan'}-${index}`}><strong>{label(scan.status??status??'')}</strong>{scan.note&&<span>{scan.note}</span>}{scan.updated_at&&<time dateTime={scan.updated_at}>{date(scan.updated_at)}</time>}</li>)}</ol>:<p>{label(status??'')}</p>}
  </section>;
}
