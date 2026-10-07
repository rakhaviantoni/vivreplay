import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import Link from 'next/link';
import {isIndonesianRequest} from '@/lib/locale';

type FaqItem={question:string;answer:ReactNode};
type FaqGroup={title:string;items:FaqItem[]};

export async function generateMetadata():Promise<Metadata>{
  const id=await isIndonesianRequest();
  const title=id?'Tanya jawab':'FAQ';
  const description=id?'Jawaban singkat tentang akun, koleksi, dan Market.':'Answers about accounts, your collection, and Market.';
  return {title,description,alternates:{canonical:id?'/id/faq':'/faq',languages:{'en-US':'/faq','id-ID':'/id/faq'}},openGraph:{type:'article',title,description,url:id?'/id/faq':'/faq'}};
}

export default async function FaqPage(){
  const id=await isIndonesianRequest();
  const groups:FaqGroup[]=id?[
    {title:'Akun dan koleksi',items:[
      {question:'Apakah VivrePlay berafiliasi dengan Bandai?',answer:'Tidak. VivrePlay adalah proyek komunitas independen, tidak berafiliasi dengan atau didukung oleh Bandai.'},
      {question:'Fitur apa yang bisa digunakan tanpa akun?',answer:'Katalog dan halaman publik dapat dijelajahi tanpa akun. Masuk untuk menyinkronkan koleksi dan daftar incaran, mengelola listing, atau menggunakan fitur akun lainnya.'},
      {question:'Bagaimana cara melaporkan data kartu yang keliru?',answer:'Gunakan Masukan & laporan di halaman kartu. Sertakan kode kartu, bahasa, set, dan versi cetak agar kami dapat memeriksanya.'},
    ]},
    {title:'Market',items:[
      {question:'Bagaimana cara membeli kartu?',answer:'Buka listing, pilih kartu dan jumlah, lalu ikuti langkah pengiriman dan pembayaran yang tersedia. Pesanan diproses setelah pembayaran dikonfirmasi.'},
      {question:'Apakah harga listing sudah termasuk ongkir?',answer:'Ongkir ditampilkan terpisah. Tarif dihitung dari alamat tujuan dan layanan kurir yang tersedia sebelum pembayaran.'},
      {question:'Kapan kartu masuk ke Koleksi saya?',answer:'Kartu dipindahkan setelah pesanan selesai sesuai alur konfirmasi penerimaan. Periksa rincian pesanan sebelum mengonfirmasi.'},
      {question:'Apa yang harus dilakukan jika pesanan bermasalah?',answer:<>Hubungi penjual melalui percakapan pesanan. Untuk bantuan pembayaran atau pengembalian dana, lihat <Link href="/legal/refund">Kebijakan Pengembalian Dana</Link> dan sertakan nomor pesanan saat menghubungi support@vivreplay.com.</>},
      {question:'Apa itu Market Pro?',answer:'Market Pro adalah satu paket untuk pembeli dan penjual. Manfaatnya mencakup batas dan masa aktif listing yang lebih besar, biaya layanan lebih rendah, serta voucher ongkir bulanan dengan syarat yang ditampilkan di halaman paket.'},
    ]},
  ]:[
    {title:'Account and collection',items:[
      {question:'Is VivrePlay affiliated with Bandai?',answer:'No. VivrePlay is an independent community project and is not affiliated with or endorsed by Bandai.'},
      {question:'What can I use without an account?',answer:'You can browse the card library and public pages without an account. Sign in to sync your collection and wishlist, manage listings, or use other account features.'},
      {question:'How do I report incorrect card data?',answer:'Use Feedback & reports on the card page. Include the card code, language, set, and printing so we can check it.'},
    ]},
    {title:'Market',items:[
      {question:'How do I buy a card?',answer:'Open a listing, choose the cards and quantities, then follow the available delivery and payment steps. The order proceeds after payment is confirmed.'},
      {question:'Does the listing price include shipping?',answer:'Shipping is shown separately. Rates are calculated from the delivery address and available courier services before payment.'},
      {question:'When will the cards move to my Vault?',answer:'Cards are transferred after the order is completed through the delivery confirmation flow. Review the order details before confirming receipt.'},
      {question:'What should I do if there is a problem with an order?',answer:<>Contact the seller in the order conversation. For payment or refund help, see the <Link href="/legal/refund">Refund Policy</Link> and include your order number when contacting support@vivreplay.com.</>},
      {question:'What is Market Pro?',answer:'Market Pro is one plan for both buyers and sellers. It includes higher listing limits, longer listing periods, lower service fees, and monthly delivery vouchers subject to the terms shown on the plan page.'},
    ]},
  ];
  const entities=groups.flatMap(group=>group.items).map(item=>({
    '@type':'Question',name:item.question,
    acceptedAnswer:{'@type':'Answer',text:typeof item.answer==='string'?item.answer:id?'Hubungi penjual melalui percakapan pesanan. Untuk bantuan pembayaran atau pengembalian dana, lihat Kebijakan Pengembalian Dana dan sertakan nomor pesanan saat menghubungi support@vivreplay.com.':'Contact the seller in the order conversation. For payment or refund help, see the Refund Policy and include your order number when contacting support@vivreplay.com.'},
  }));
  const structuredData={'@context':'https://schema.org','@type':'FAQPage',mainEntity:entities};
  return <main className="page faq-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData)}}/>
    <header className="faq-heading"><h1>{id?'Tanya jawab':'FAQ'}</h1><p>{id?'Jawaban tentang akun, koleksi, dan Market.':'Answers about your account, collection, and Market.'}</p></header>
    <nav className="faq-jump-links" aria-label={id?'Topik FAQ':'FAQ topics'}>{groups.map((group,index)=><a key={group.title} href={`#faq-group-${index}`}>{group.title}</a>)}</nav>
    {groups.map((group,index)=><section className="faq-group" id={`faq-group-${index}`} key={group.title} aria-labelledby={`faq-group-heading-${index}`}>
      <h2 id={`faq-group-heading-${index}`}>{group.title}</h2>
      <div className="faq-accordion">{group.items.map(item=><details className="faq-item" key={item.question}>
        <summary>{item.question}<span aria-hidden="true" className="faq-chevron"/>
        </summary><div className="faq-answer"><p>{item.answer}</p></div>
      </details>)}</div>
    </section>)}
  </main>;
}
