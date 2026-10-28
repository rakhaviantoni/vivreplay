'use client';

export function PaymentSupportActions({locale,orderId}:{locale:'EN'|'ID';orderId:string}){
  const id=locale==='ID';
  const subject=encodeURIComponent(id?`Bantuan pembayaran ${orderId}`:`Payment help for order ${orderId}`);
  const message=id
    ?`Halo VivrePlay, saya perlu bantuan untuk pembayaran pesanan ${orderId}. Detail pembayaran saya tidak muncul.`
    :`Hi VivrePlay, I need help with payment for order ${orderId}. My payment details are missing.`;
  return <div className="payment-support-actions">
    <p>{id?'Detail pembayaran tidak tersedia. Jangan bayar lagi dulu.':'Payment details aren’t available. Please don’t pay again yet.'}</p>
    <div>
      <a href={`mailto:support@vivreplay.com?subject=${subject}&body=${encodeURIComponent(message)}`}>{id?'Email dukungan':'Email support'}</a>
      <a href={`https://wa.me/6287892660993?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">WhatsApp</a>
    </div>
  </div>;
}
