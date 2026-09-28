import {notFound} from 'next/navigation';
import {privateMetadata} from '@/lib/site-metadata';
export const metadata=privateMetadata('Player profile','Player profiles are available by direct link only.');
import {db} from '@/lib/server/store';
import {ShareButton} from '@/components/tcg/share';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{username:string}>}){const {username}=await params;const p=await db().prepare('SELECT display_name,username,region,created_at FROM profiles WHERE username=?').bind(username).first<{display_name:string;username:string;region:string;created_at:string}>();if(!p)notFound();return <main className="page"><div className="page-heading"><div><p className="eyebrow">PLAYER IDENTITY</p><h1>{p.display_name}</h1><p>@{p.username} · {p.region} · Joined {p.created_at.slice(0,10)}</p></div><ShareButton title={p.display_name} path={`/players/${username}`}/></div><div className="empty-state"><h2>Every adventure starts somewhere.</h2><p>This player has not published collection highlights. Private collection details and values are never shown here.</p></div></main>}
