import Link from 'next/link';
export default function NotFound(){return <main className="page"><div className="empty-state"><h1>Not available</h1><p>This item may be private, removed, or the link may be incorrect.</p><Link href="/cards" className="button">Back to cards</Link></div></main>}
