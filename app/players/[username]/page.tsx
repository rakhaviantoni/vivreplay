import Link from 'next/link';
import {notFound} from 'next/navigation';
import {
  GlobeIcon as Globe,
  ShieldCheckIcon as ShieldCheck,
  CalendarBlankIcon as Calendar,
  StorefrontIcon as Store,
  StackIcon as Layers3,
  ArrowSquareOutIcon as ArrowSquareOut,
  CardsIcon as Cards,
} from '@phosphor-icons/react/dist/ssr';
import {privateMetadata} from '@/lib/site-metadata';
import {db} from '@/lib/server/store';
import {ShareButton} from '@/components/tcg/share';
import {formatMoney} from '@/packages/domain';
import {cardFor} from '@/packages/card-data/catalog';
import {CardArt} from '@/components/tcg/card-art';

export const metadata = privateMetadata('Player profile', 'Player profiles are available by direct link only.');
export const dynamic = 'force-dynamic';

const REGION_NAMES: Record<string, string> = {
  ID: 'Indonesia',
  JP: 'Japan',
  US: 'United States',
  SG: 'Singapore',
  MY: 'Malaysia',
  PH: 'Philippines',
  TH: 'Thailand',
  GB: 'United Kingdom',
  AU: 'Australia',
  CA: 'Canada',
  DE: 'Germany',
  FR: 'France',
};

export default async function Page({params}: {params: Promise<{username: string}>}) {
  const {username} = await params;
  const p = await db().prepare(
    'SELECT id, display_name, username, region, created_at FROM profiles WHERE username=?'
  ).bind(username).first<{
    id: string;
    display_name: string;
    username: string;
    region: string;
    created_at: string;
  }>();

  if (!p) notFound();

  const [listingsRes, decksRes] = await Promise.all([
    db().prepare(`
      SELECT id, printing_id AS printingId, title, amount, currency, quantity, condition, type, city, created_at AS createdAt, expires_at AS expiresAt
      FROM listings
      WHERE seller_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC
      LIMIT 12
    `).bind(p.id).all<{
      id: string;
      printingId: string;
      title: string;
      amount: number;
      currency: string;
      quantity: number;
      condition: string;
      type: string;
      city: string;
      createdAt: string;
      expiresAt?: string;
    }>(),
    db().prepare(`
      SELECT d.id, d.name, d.created_at AS createdAt, v.leader_id AS leaderId
      FROM decks d
      JOIN deck_versions v ON v.deck_id=d.id
      WHERE d.owner_id=? AND d.visibility='public' AND d.deleted_at IS NULL
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT 6
    `).bind(p.id).all<{
      id: string;
      name: string;
      createdAt: string;
      leaderId: string;
    }>(),
  ]);

  const listings = listingsRes.results || [];
  const decks = decksRes.results || [];

  const initial = (p.display_name || p.username || 'P').charAt(0).toUpperCase();
  const regionLabel = REGION_NAMES[p.region] || p.region;
  const joinedDate = p.created_at
    ? new Date(p.created_at).toLocaleDateString('en-US', {month: 'short', year: 'numeric'})
    : 'Recently';

  return (
    <main className="page player-profile-page">
      {/* Shared Global Intro Banner */}
      <section className="library-intro player-intro">
        <div className="library-intro-copy">
          <p className="kicker">COLLECTOR PROFILE</p>
          <h1>{p.display_name}</h1>
          <p className="player-intro-meta">
            @{p.username} · {regionLabel} · Member since {joinedDate}
          </p>
        </div>
        <div className="library-intro-actions">
          <ShareButton
            title={`${p.display_name} (@${p.username}) · Vivreplay`}
            path={`/players/${username}`}
          />
        </div>
      </section>

      <div className="player-layout">
        {/* Left Sidebar: Collector Identity Card */}
        <section className="profile-card player-card">
          <div className="profile-emblem">
            <span>{initial}</span>
          </div>
          <h2>{p.display_name}</h2>
          <p className="profile-handle">@{p.username}</p>
          <span className="badge">COLLECTOR</span>

          <div className="profile-facts">
            <span><Globe size={15}/>{regionLabel} ({p.region})</span>
            <span><Calendar size={15}/>Member since {joinedDate}</span>
            <span><ShieldCheck size={15}/>Collection private by default</span>
          </div>

          <div className="profile-card-actions">
            <Link className="button secondary profile-market-link-btn" href="/market">
              <Store size={16}/>
              Browse Market
            </Link>
          </div>
        </section>

        {/* Right Area: Active Listings & Public Decks or Clean Empty State */}
        <div className="player-content">
          {listings.length > 0 && (
            <section className="player-section">
              <div className="player-section-head">
                <div>
                  <h2>Active Market Listings ({listings.length})</h2>
                  <p>Cards currently listed on Market by {p.display_name}.</p>
                </div>
                <Link href="/market" className="player-section-link">
                  Browse Market <ArrowSquareOut size={14}/>
                </Link>
              </div>
              <div className="player-listings-grid">
                {listings.map(item => {
                  const card = cardFor(item.printingId);
                  return (
                    <article key={item.id} className="player-listing-card">
                      <Link href={`/market/${item.id}`} className="player-listing-card-art">
                        {card ? <CardArt card={card}/> : <div className="player-listing-art-placeholder"><Cards size={32}/></div>}
                      </Link>
                      <div className="player-listing-card-copy">
                        <strong>{item.title}</strong>
                        <small>{item.condition}{item.city ? ` · ${item.city}` : ''}</small>
                        <p>
                          <span className={item.type === 'WTB' ? 'is-wtb' : 'is-wts'}>{item.type === 'WTB' ? 'WTB' : 'WTS'}</span>
                          <b>{formatMoney(item.amount, item.currency)}</b>
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {decks.length > 0 && (
            <section className="player-section">
              <div className="player-section-head">
                <div>
                  <h2>Public Decks ({decks.length})</h2>
                  <p>Deck builds shared publicly by {p.display_name}.</p>
                </div>
              </div>
              <div className="player-decks-grid">
                {decks.map(d => {
                  const leader = d.leaderId ? cardFor(d.leaderId) : null;
                  return (
                    <Link key={d.id} href={`/decks/${d.id}`} className="player-deck-card">
                      <div className="player-deck-art">
                        {leader ? <CardArt card={leader}/> : <Layers3 size={24}/>}
                      </div>
                      <div className="player-deck-info">
                        <h3>{d.name}</h3>
                        <p>{leader ? `${leader.name} · Leader` : 'Custom Deck'}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {listings.length === 0 && decks.length === 0 && (
            <div className="player-empty-showcase">
              <ShieldCheck size={36} />
              <h3>No public listings or decks</h3>
              <p>
                This collector hasn’t published any listings on Market or shared public decks yet. Personal collection items, acquisition values, and private lists are kept strictly confidential.
              </p>
              <Link href="/market" className="button secondary">
                <Store size={15}/>
                Explore Market
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
