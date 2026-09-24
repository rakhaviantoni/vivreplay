import Link from 'next/link';

const sections = [
  ['Using VivrePlay', 'VivrePlay is a fan-made place to browse cards, build decks, manage a collection, and use the Arena. Use it lawfully and do not interfere with other collectors or the service.'],
  ['Accounts and saved work', 'You are responsible for activity under your account. Decks and collection entries saved only on a device remain on that device until you choose to sign in and sync them.'],
  ['Marketplace', 'Listings are posted by collectors. Check the exact printing, condition, price, and delivery arrangement before you agree to a sale. VivrePlay does not take payment or guarantee a transaction unless a checkout flow says otherwise.'],
  ['Community content', 'Only submit material that you have the right to share. Do not use VivrePlay to impersonate another person, misrepresent a card, or publish unlawful content.'],
  ['Card data and trademarks', 'Card names, images, game terms, and related trademarks belong to their respective owners. They are shown here for informational and community use.'],
  ['Changes and contact', 'The project may change as features develop. For a question about these terms or the service, contact the VivrePlay team through the available support channel.'],
];

export default function TermsPage() {
  return <main className="legal-page page"><header className="legal-hero"><p>VivrePlay legal</p><h1>Terms of use</h1><span>How VivrePlay can be used by the community.</span></header><article className="legal-content"><p className="legal-lead">By using VivrePlay, you agree to these terms.</p>{sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}<p className="legal-return"><Link href="/">Return to VivrePlay</Link></p></article></main>;
}
