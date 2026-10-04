import Link from 'next/link';

export type LegalSection={title:string;body:React.ReactNode};

export function LegalDocument({id,title,description,lead,sections,updated}:{id:boolean;title:string;description:string;lead:string;sections:LegalSection[];updated:string}){
  return <main className="legal-page page">
    <header className="legal-hero"><p>VivrePlay · {id?'Informasi hukum':'Legal'}</p><h1>{title}</h1><span>{description}</span></header>
    <article className="legal-content"><p className="legal-lead">{lead}</p><p className="legal-updated">{id?'Terakhir diperbarui':'Last updated'} · {updated}</p>
      {sections.map(section=><section key={section.title}><h2>{section.title}</h2><div className="legal-section-copy">{section.body}</div></section>)}
      <p className="legal-contact">{id?'Pertanyaan? Hubungi':'Questions? Contact'} <a href="mailto:support@vivreplay.com">support@vivreplay.com</a>.</p>
      <nav className="legal-related" aria-label={id?'Dokumen terkait':'Related documents'}>
        <Link href={id?'/id/legal/terms':'/legal/terms'}>{id?'Syarat & Ketentuan':'Terms'}</Link>
        <Link href={id?'/id/legal/refund':'/legal/refund'}>{id?'Kebijakan Pengembalian Dana':'Refund Policy'}</Link>
        <Link href={id?'/id/faq':'/faq'}>FAQ</Link>
        <Link href={id?'/id/legal/privacy':'/legal/privacy'}>{id?'Privasi':'Privacy'}</Link>
      </nav>
      <p className="legal-return"><Link href={id?'/id':'/'}>{id?'Kembali ke VivrePlay':'Return to VivrePlay'}</Link></p>
    </article>
  </main>;
}
