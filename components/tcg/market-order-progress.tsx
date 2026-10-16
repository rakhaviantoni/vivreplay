import {CheckIcon as Check,CreditCard,Flag,Package,Truck} from '@phosphor-icons/react';

type Props={status:string;role:'buyer'|'seller';language:'EN'|'ID';deliveredAt?:string|null;trackingStatus?:string|null};

export function MarketOrderProgress({status,role,language,deliveredAt,trackingStatus}:Props){
  if(['CANCELLED','EXPIRED','REFUNDED','PAYMENT_REVIEW','FAILED'].includes(status))return null;
  const id=language==='ID';
  const carrierDelivered=Boolean(deliveredAt)||/^(delivered|complete|completed)$/i.test(trackingStatus??'');
  const current=status==='PENDING_PAYMENT'?0:['PAID','PROCESSING'].includes(status)?1:status==='SHIPPED'?carrierDelivered?3:2:['RECEIVED','COMPLETED','FULFILLED'].includes(status)?4:0;
  const labels=id?(role==='buyer'?['Pembayaran','Penjual menyiapkan','Dalam perjalanan','Diterima','Selesai']:['Pembeli membayar','Siapkan pesanan','Dalam perjalanan','Diterima','Selesai']):(role==='buyer'?['Payment','Seller prepares','In transit','Delivered','Complete']:['Buyer pays','Prepare order','In transit','Delivered','Complete']);
  const icons=[CreditCard,Package,Truck,Check,Flag];
  return <ol className="market-order-progress" aria-label={id?'Progres pesanan':'Order progress'}>
    {labels.map((label,index)=><li key={label} className={index<current?'is-complete':index===current?'is-current':'is-upcoming'} aria-current={index===current?'step':undefined}>
      <span className="market-order-progress-marker" aria-hidden="true">{index<current?<Check className="market-order-progress-icon" size={13} weight="bold"/>:(()=>{const Icon=icons[index];return <Icon className="market-order-progress-icon" size={13} weight="regular"/>})()}</span>
      <span className="market-order-progress-label">{label}</span>
    </li>)}
  </ol>;
}
