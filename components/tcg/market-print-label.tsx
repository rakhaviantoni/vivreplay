import {PrinterIcon as Printer} from '@phosphor-icons/react';

export function MarketPrintLabel({orderId,language}:{orderId:string;language:'EN'|'ID'}){
  const id=language==='ID';
  return <a className="button secondary market-order-print-label" href={`/market/orders/${encodeURIComponent(orderId)}/label?lang=${id?'id':'en'}`} target="_blank" rel="noreferrer"><Printer size={15}/>{id?'Cetak label':'Print label'}</a>;
}
