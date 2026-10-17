import type {Metadata} from 'next';
import {isIndonesianRequest} from '@/lib/locale';

export async function generateMetadata():Promise<Metadata>{
  const id=await isIndonesianRequest();
  const title=id?'Kontak VivrePlay':'Contact VivrePlay';
  const description=id?'Hubungi tim VivrePlay melalui email atau WhatsApp.':'Contact the VivrePlay team by email or WhatsApp.';
  return {
    title,
    description,
    alternates:{canonical:id?'/id/contact':'/contact',languages:{'en-US':'/contact','id-ID':'/id/contact'}},
    openGraph:{type:'website',title:`${title} | VivrePlay`,description,url:id?'/id/contact':'/contact'},
    twitter:{card:'summary_large_image',title:`${title} | VivrePlay`,description},
  };
}

export default async function ContactPage(){
  const id=await isIndonesianRequest();
  return <main className="legal-page contact-page">
    <header className="legal-hero">
      <p>{id?'BANTUAN VIVREPLAY':'VIVREPLAY SUPPORT'}</p>
      <h1>{id?'Kontak':'Contact'}</h1>
      <span>{id?'Hubungi kami untuk pertanyaan tentang akun, kartu, pembayaran, atau pesanan Market.':'Contact us about your account, cards, payments, or a Market order.'}</span>
    </header>
    <div className="legal-content contact-content">
      <p className="legal-lead">{id?'Untuk bantuan pesanan, sertakan nomor pesanan agar kami dapat memeriksanya.':'For order help, include your order number so we can look into it.'}</p>
      <section>
        <h2>{id?'Email':'Email'}</h2>
        <p><a href="mailto:support@vivreplay.com">support@vivreplay.com</a></p>
      </section>
      <section>
        <h2>{id?'WhatsApp':'WhatsApp'}</h2>
        <p><a href="https://wa.me/6287892660993">+62 878-9266-0993</a></p>
      </section>
      <section>
        <h2>{id?'Alamat usaha':'Business address'}</h2>
        <p>{id?'VivrePlay beroperasi secara online dan tidak menerima kunjungan langsung. Kami belum mencantumkan alamat usaha pada halaman ini.':'VivrePlay operates online and does not receive walk-in visits. A business address is not listed on this page.'}</p>
      </section>
      <section>
        <h2>{id?'Waktu layanan':'Service hours'}</h2>
        <p>{id?'Dukungan ditangani secara online. Waktu balasan dapat berbeda menurut jumlah permintaan.':'Support is handled online. Reply times may vary with request volume.'}</p>
      </section>
    </div>
  </main>;
}
