import Link from 'next/link';

const sections = [
  ['What is stored', 'VivrePlay stores the information needed to provide an account and the features you use, such as account details, saved decks, Vault entries, and listings. Display, language, and cookie choices can also be stored locally in your browser.'],
  ['Deck Coach requests', 'When you use Deck Coach, the request, chosen language, account identifier when available, IP address, user-agent, model, and service result may be recorded for security, reliability, and administration.'],
  ['How information is used', 'Information is used to operate the service, preserve saved work, prevent misuse, and improve reliability. We do not sell personal information.'],
  ['Sharing', 'Information is shared only when needed to run a feature you choose, comply with a legal obligation, or protect the service and its users. A public listing shares only the details shown in that listing.'],
  ['Your choices', 'You can change local cookie preferences from the footer. You can also ask about your account information or request help with it through the available support channel.'],
  ['Updates', 'This notice may change as VivrePlay develops. The current version is always available on this page.'],
];

export default function PrivacyPage() {
  return <main className="legal-page page"><header className="legal-hero"><p>VivrePlay legal</p><h1>Privacy</h1><span>How VivrePlay handles information used to run the service.</span></header><article className="legal-content"><p className="legal-lead">We collect only what is needed to provide the features you use.</p>{sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}<p className="legal-return"><Link href="/">Return to VivrePlay</Link></p></article></main>;
}
