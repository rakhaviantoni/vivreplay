import type {Metadata} from 'next';
import {isIndonesianRequest} from '@/lib/locale';
import {HelpCenter} from '@/components/tcg/help-center';

export async function generateMetadata(): Promise<Metadata> {
  const id = await isIndonesianRequest();
  const title = id ? 'Pusat Bantuan' : 'Help Center';
  const description = id
    ? 'Panduan praktis untuk pesanan Market, kartu, koleksi, akun, dan pembayaran VivrePlay.'
    : 'Practical guides for VivrePlay Market orders, cards, collections, accounts, and payments.';
  return {
    title,
    description,
    alternates: {canonical: id ? '/id/help' : '/help', languages: {'en-US': '/help', 'id-ID': '/id/help'}},
    openGraph: {type: 'website', title: `${title} | VivrePlay`, description, url: id ? '/id/help' : '/help'},
    twitter: {card: 'summary_large_image', title: `${title} | VivrePlay`, description},
  };
}

export default async function HelpPage() {
  const id = await isIndonesianRequest();
  return <HelpCenter locale={id ? 'id' : 'en'}/>;
}
