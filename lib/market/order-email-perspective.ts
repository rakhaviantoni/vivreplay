export type OrderEmailPerspectiveEvent='order-auto-completed'|'order-cancelled'|'order-expired'|'order-dispute-resolved';
export type OrderEmailPerspective={event:OrderEmailPerspectiveEvent;locale:'en'|'id';recipientRole:'buyer'|'seller';actorRole?:'buyer'|'seller';participant?:string;decision?:string;refund?:string;payout?:string};

const decisions:Record<string,{en:string;id:string}>={
  FULL_REFUND:{en:'full refund',id:'refund penuh'},
  PARTIAL_REFUND:{en:'partial refund for affected cards',id:'refund sebagian untuk kartu terdampak'},
  RESHIP:{en:'replacement shipment',id:'pengiriman pengganti'},
  NO_REFUND:{en:'no refund',id:'tanpa refund'},
};

export function orderEmailPerspectiveLine(input:OrderEmailPerspective){
  const {event,locale,recipientRole,actorRole,participant}=input;
  const id=locale==='id';
  if(event==='order-auto-completed')return recipientRole==='seller'
    ?(id?`Masa pemeriksaan 48 jam berakhir tanpa laporan. Penjualan selesai. ${input.payout??'Hasil penjualan'} siap dicairkan.`:`The 48-hour review period ended without a report. Your sale is complete. ${input.payout??'Your proceeds'} ${input.payout?'is':'are'} available to withdraw.`)
    :(id?'Masa pemeriksaan 48 jam berakhir tanpa laporan. Kartu dari pesanan ini sudah ditambahkan ke koleksi Anda.':'The 48-hour review period ended without a report. The cards from this order have been added to your Vault.');
  if(event==='order-cancelled')return actorRole==='seller'
    ?(id?`Penjual${participant?` ${participant}`:''} membatalkan pesanan sebelum pembayaran. Kartu tidak lagi dipesan untuk Anda.`:`The seller${participant?`, ${participant},`:''} cancelled the order before payment. The cards are no longer reserved for you.`)
    :(id?`Pembeli${participant?` ${participant}`:''} membatalkan pesanan sebelum pembayaran. Kartu Anda kembali tersedia.`:`The buyer${participant?`, ${participant},`:''} cancelled the order before payment. Your cards are available again.`);
  if(event==='order-expired')return recipientRole==='seller'
    ?(id?'Pembeli belum membayar sebelum batas waktu. Pesanan ditutup dan kartu Anda kembali tersedia.':'The buyer did not pay before the deadline. The order is closed and your cards are available again.')
    :(id?'Batas pembayaran berakhir tanpa pembayaran. Pesanan ditutup dan kartu tidak lagi dipesan untuk Anda.':'The payment deadline passed without payment. The order is closed and the cards are no longer reserved for you.');
  const decision=input.decision?decisions[input.decision]?.[locale]:undefined;
  if(!decision)return undefined;
  if(recipientRole==='seller')return id
    ?`Pemeriksaan pesanan selesai: ${decision}${input.refund?`. Refund kepada pembeli: ${input.refund}`:''}. Buka pesanan untuk melihat catatan keputusan.`
    :`The order review is complete: ${decision}${input.refund?`. Buyer refund: ${input.refund}`:''}. Open the order to read the decision.`;
  return id
    ?`Pemeriksaan pesanan selesai: ${decision}${input.refund?`. Refund Anda: ${input.refund}`:''}. Buka pesanan untuk melihat catatan keputusan.`
    :`The order review is complete: ${decision}${input.refund?`. Your refund: ${input.refund}`:''}. Open the order to read the decision.`;
}
