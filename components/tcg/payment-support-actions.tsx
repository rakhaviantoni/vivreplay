'use client';

export function PaymentSupportActions({locale,orderId,paymentName}:{locale:'EN'|'ID';orderId:string;paymentName?:string|null}){
  const id=locale==='ID';
  const method=paymentName?.trim()|| (id?'pembayaran':'payment');
  const subject=encodeURIComponent(id?`Bantuan pembayaran ${orderId}`:`Payment help for order ${orderId}`);
  const message=id
    ?`Halo VivrePlay, petunjuk ${method} untuk pesanan ${orderId} tidak muncul. Mohon bantu periksa sebelum saya membayar.`
    :`Hi VivrePlay, the ${method} instructions for order ${orderId} are missing. Please check them before I pay.`;
  return <div className="payment-support-actions">
    <p>{id?`Petunjuk ${method} tidak tersedia. Tunggu konfirmasi sebelum membayar.`:`The ${method} instructions aren’t available. Please wait for confirmation before paying.`}</p>
    <div>
      <a href={`mailto:support@vivreplay.com?subject=${subject}&body=${encodeURIComponent(message)}`}>{id?'Email dukungan':'Email support'}</a>
      <a href={`https://wa.me/6287892660993?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">WhatsApp</a>
    </div>
  </div>;
}
