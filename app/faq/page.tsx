import type {Metadata} from 'next';
import {LegalDocument,LegalSection} from '@/components/tcg/legal-document';
import {isIndonesianRequest} from '@/lib/locale';

export async function generateMetadata():Promise<Metadata>{const id=await isIndonesianRequest();const title=id?'Tanya Jawab':'Frequently Asked Questions';const description=id?'Jawaban tentang akun VivrePlay, katalog kartu, Market, pembayaran, dan Market Pro.':'Answers about VivrePlay accounts, card tools, Market orders, payment, and Market Pro.';return {title,description,alternates:{canonical:id?'/id/faq':'/faq',languages:{'en-US':'/faq','id-ID':'/id/faq'}},openGraph:{type:'article',title,description,url:id?'/id/faq':'/faq'}}}

export default async function FaqPage(){
  const id=await isIndonesianRequest();
  const questions=id?[
    ['Apakah VivrePlay resmi berafiliasi dengan Bandai?','Tidak. VivrePlay adalah proyek komunitas independen dan tidak berafiliasi dengan atau didukung oleh Bandai.'],
    ['Apakah saya perlu akun untuk menggunakan VivrePlay?','Anda dapat menjelajahi katalog dan fitur publik tanpa akun. Akun diperlukan untuk menyimpan data secara online, mengelola koleksi, menerbitkan listing, dan melakukan checkout.'],
    ['Bagaimana cara kerja pembelian di Market?','Jika checkout tersedia, pilih kartu dan jumlah, pilih layanan pengiriman, lalu bayar melalui halaman pembayaran aman iPaymu. Pesanan diproses setelah pembayaran dikonfirmasi. Beberapa listing dapat mengharuskan pembeli mengatur transaksi langsung dengan penjual.'],
    ['Apakah harga sudah termasuk ongkir?','Tidak selalu. Untuk checkout Market, ongkir dihitung berdasarkan alamat dan layanan pengiriman yang dipilih, lalu ditampilkan sebelum pembayaran.'],
    ['Kapan pesanan masuk ke koleksi saya?','Setelah penjual mengirim kartu dan Anda mengonfirmasi bahwa pesanan telah diterima, kartu pesanan ditambahkan ke koleksi akun Anda. Jangan konfirmasi sebelum barang tiba.'],
    ['Bagaimana jika pesanan bermasalah atau perlu pengembalian dana?','Hubungi penjual untuk masalah barang dan email support@vivreplay.com dengan nomor pesanan serta bukti pembayaran. Lihat Kebijakan Pengembalian Dana untuk proses dan informasi yang perlu disiapkan.'],
    ['Apa itu Market Pro?','Market Pro adalah paket berbayar untuk fitur penjual Market, seperti batas dan durasi listing yang ditampilkan pada halaman paket. Paket tidak mengubah fitur katalog atau permainan. Periode dan harga final ditampilkan sebelum pembayaran.'],
    ['Apakah Market Pro diperpanjang otomatis?','Tidak, kecuali checkout secara jelas menyebutkan perpanjangan otomatis. Status dan tanggal berakhir paket dapat diperiksa pada profil akun.'],
    ['Bagaimana cara melaporkan kartu atau gambar yang hilang?','Gunakan tautan Masukan & laporan pada footer atau halaman kartu untuk mengirim laporan. Sertakan kode kartu, bahasa, set, dan printing yang perlu diperbaiki.'],
  ]:[
    ['Is VivrePlay affiliated with Bandai?','No. VivrePlay is an independent community project and is not affiliated with or endorsed by Bandai.'],
    ['Do I need an account to use VivrePlay?','You can browse the catalog and public features without an account. An account is required to sync saved data, manage your Vault, publish a listing, and check out.'],
    ['How does buying on Market work?','When checkout is available, choose cards and quantities, select a delivery service, then pay through iPaymu’s secure payment page. The order proceeds after payment is confirmed. Some listings may require buyers to arrange a direct transaction with the seller.'],
    ['Is shipping included in the price?','Not always. For Market checkout, shipping is calculated from your delivery address and selected courier service, then shown before payment.'],
    ['When will my order appear in my Vault?','After the seller ships the cards and you confirm delivery, the purchased cards are added to your account Vault. Do not confirm receipt before the package arrives.'],
    ['What if there is an order problem or I need a refund?','Contact the seller about item issues and email support@vivreplay.com with your order number and payment evidence. See the Refund Policy for the process and information to include.'],
    ['What is Market Pro?','Market Pro is a paid plan for Market seller features, such as the listing limits and duration shown on the plan page. It does not change catalog or gameplay features. The period and final price are shown before payment.'],
    ['Does Market Pro renew automatically?','No, unless checkout clearly states that automatic renewal applies. You can check your plan status and expiry date in your account profile.'],
    ['How do I report a missing card or image?','Use Feedback & reports in the footer or on a card page. Include the card code, language, set, and printing that needs attention.'],
  ];
  const sections:LegalSection[]=questions.map(([question,answer])=>({title:question,body:<p>{answer}</p>}));
  const structuredData={'@context':'https://schema.org','@type':'FAQPage','mainEntity':questions.map(([question,answer])=>({'@type':'Question',name:question,acceptedAnswer:{'@type':'Answer',text:answer}}))};
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData)}}/><LegalDocument id={id} title={id?'Tanya Jawab (FAQ)':'FAQ'} description={id?'Jawaban untuk pertanyaan umum tentang VivrePlay dan Market.':'Answers to common questions about VivrePlay and Market.'} lead={id?'Temukan jawaban seputar akun, koleksi, pembayaran, dan pesanan.':'Find answers about accounts, collections, payments, and orders.'} sections={sections} updated="2 October 2026"/></>;
}
