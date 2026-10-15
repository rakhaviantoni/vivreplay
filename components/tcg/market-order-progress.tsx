import {CheckIcon as Check,CreditCard,Flag,Package,Truck} from '@phosphor-icons/react';

type Props={status:string;role:'buyer'|'seller';language:'EN'|'ID'};

export function MarketOrderProgress({status,role,language}:Props){
  if(['CANCELLED','EXPIRED','REFUNDED','PAYMENT_REVIEW','FAILED'].includes(status))return null;
  const id=language==='ID';
  const current=status==='PENDING_PAYMENT'?0:['PAID','PROCESSING'].includes(status)?1:status==='SHIPPED'?2:['RECEIVED','COMPLETED','FULFILLED'].includes(status)?3:0;
  const labels=id?(role==='buyer'?['Pembayaran','Penjual kirim','Dalam perjalanan','Selesai']:['Pembeli bayar','Siapkan pesanan','Dalam perjalanan','Terkirim']):(role==='buyer'?['Payment','Seller ships','In transit','Complete']:['Buyer pays','Prepare order','In transit','Delivered']);
  const icons=[CreditCard,Package,Truck,Flag];
  return <ol className="market-order-progress" aria-label={id?'Progres pesanan':'Order progress'}>
    {labels.map((label,index)=><li key={label} className={index<current?'is-complete':index===current?'is-current':'is-upcoming'} aria-current={index===current?'step':undefined}>
      <span className="market-order-progress-marker" aria-hidden="true">{index<current?<Check className="market-order-progress-icon" size={13} weight="bold"/>:(()=>{const Icon=icons[index];return <Icon className="market-order-progress-icon" size={13} weight="regular"/>})()}</span>
      <span className="market-order-progress-label">{label}</span>
    </li>)}
  </ol>;
}
