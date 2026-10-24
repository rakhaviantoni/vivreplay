import {withRequestLocale} from '@/lib/with-request-locale';
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

async function ContactPage(){
  const id=await isIndonesianRequest();
  return <main className="legal-page contact-page">
    <header className="legal-hero">
      <p>{id?'BANTUAN VIVREPLAY':'VIVREPLAY SUPPORT'}</p>
      <h1>{id?'Kontak':'Contact'}</h1>
      <span>{id?'Hubungi kami tentang akun, kartu, pembayaran, atau pesanan Market.':'Get in touch about an account, card, payment, or Market order.'}</span>
    </header>
    <div className="legal-content contact-content">
      <p className="legal-lead">{id?'Untuk pertanyaan pesanan, sertakan nomor pesanan.':'For an order question, include the order number.'}</p>
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
        <p>WeWork, Sinarmas Land Plaza<br />Jl. Jend. Sudirman Kav. 21, RT 010/RW 001, Karet, Setiabudi<br />Jakarta Selatan 12920, Indonesia</p>
      </section>
    </div>
  </main>;
}

export default withRequestLocale(ContactPage);
