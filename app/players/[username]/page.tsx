import {withRequestLocale} from '@/lib/with-request-locale';
import Link from '@/components/ui/localized-link';
import {notFound} from 'next/navigation';
import {
  GlobeIcon as Globe,
  ShieldCheckIcon as ShieldCheck,
  CalendarBlankIcon as Calendar,
  StorefrontIcon as Store,
  StackIcon as Layers3,
  ArrowSquareOutIcon as ArrowSquareOut,
  CardsIcon as Cards,
  FacebookLogoIcon as FacebookLogo,
  InstagramLogoIcon as InstagramLogo,
  SealCheckIcon as SealCheck,
  ThreadsLogoIcon as ThreadsLogo,
} from '@phosphor-icons/react/dist/ssr';
import {privateMetadata} from '@/lib/site-metadata';
import {db} from '@/lib/server/store';
import {getPublicSellerSocials} from '@/lib/server/postforme';
import {socialDisplayHandle, socialProfileUrl} from '@/lib/social-links';
import {ShareButton} from '@/components/tcg/share';
import {cardFor,type Card} from '@/packages/card-data/catalog';
import {CardArt} from '@/components/tcg/card-art';
import {marketListingPath} from '@/lib/market/listing-url';
import {MarketReputation} from '@/components/tcg/market-reputation';
import {sealedProductById, sealedDisplayCard} from '@/lib/market/sealed-products';
import {generalMarketCategoryLabel} from '@/lib/market/general-products';
import {PlayerListingsGrid, type PlayerListingCategory, type PlayerListingViewItem} from '@/components/tcg/player-listings-grid';

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

async function Page({params}: {params: Promise<{username: string}>}) {
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

  const [listingsRes, decksRes, listingCount, deckCount, completedTradesCount, sellerSocials] = await Promise.all([
    db().prepare(`
      SELECT
        l.id,
        l.printing_id AS printingId,
        l.sealed_product_id AS sealedProductId,
        l.items,
        l.title,
        l.amount,
        l.currency,
        l.quantity,
        l.condition,
        l.type,
        l.city,
        l.created_at AS createdAt,
        l.expires_at AS expiresAt,
        cp.image_url AS cardImageUrl,
        cp.language AS cardLanguage,
        cp.rarity AS cardRarity,
        cp.set_code AS cardSetCode,
        cp.variant AS cardVariant,
        ci.id AS cardIdentityId,
        ci.code AS cardCode,
        ci.name AS cardName,
        ci.color AS cardColor,
        ci.type AS cardType,
        ci.cost AS cardCost,
        ci.power AS cardPower,
        ci.effect AS cardEffect,
        g.slug AS gameSlug
      FROM listings l
      LEFT JOIN card_printings cp ON cp.id=l.printing_id
      LEFT JOIN card_identities ci ON ci.id=cp.identity_id
      LEFT JOIN games g ON g.id=ci.game_id
      WHERE l.seller_id=? AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at > CURRENT_TIMESTAMP)
      ORDER BY l.created_at DESC
      LIMIT 24
    `).bind(p.id).all<{
      id: string;
      printingId: string;
      sealedProductId?: string | null;
      items?: string | null;
      title: string;
      amount: number;
      currency: string;
      quantity: number;
      condition: string;
      type: string;
      city: string;
      createdAt: string;
      expiresAt?: string;
      cardImageUrl?: string;
      cardLanguage?: string;
      cardRarity?: string;
      cardSetCode?: string;
      cardVariant?: string;
      cardIdentityId?: string;
      cardCode?: string;
      cardName?: string;
      cardColor?: string;
      cardType?: string;
      cardCost?: number;
      cardPower?: number;
      cardEffect?: string;
      gameSlug?: string | null;
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
    db().prepare("SELECT COUNT(*) AS count FROM listings WHERE seller_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)").bind(p.id).first<{count:number}>(),
    db().prepare("SELECT COUNT(*) AS count FROM decks WHERE owner_id=? AND visibility='public' AND deleted_at IS NULL").bind(p.id).first<{count:number}>(),
    db().prepare("SELECT COUNT(*) AS count FROM checkout_orders WHERE (seller_id=? OR buyer_id=?) AND kind='MARKET' AND status IN ('PAID','SHIPPED','RECEIVED','COMPLETED','FULFILLED')").bind(p.id, p.id).first<{count:number}>(),
    getPublicSellerSocials(p.id),
  ]);

  const listings = listingsRes.results || [];
  const decks = decksRes.results || [];

  const listingViewItems: PlayerListingViewItem[] = listings.map((item) => {
    let parsedItems: Array<{
      productType?: string;
      sealedProductId?: string;
      photoIds?: string[];
      generalProduct?: { category?: string };
    }> = [];
    try {
      const parsed = JSON.parse(item.items ?? '[]') as unknown;
      if (Array.isArray(parsed)) parsedItems = parsed;
    } catch {
      // ignore
    }
    const firstEntry = parsedItems[0];
    const sealedId = item.sealedProductId || firstEntry?.sealedProductId || (firstEntry?.productType === 'SEALED' ? item.printingId : undefined);
    const sealedProd = sealedId ? sealedProductById(sealedId) : undefined;
    const isGeneral = firstEntry?.productType === 'GENERAL' || Boolean(firstEntry?.generalProduct);
    const firstPhotoId = firstEntry?.photoIds?.[0];

    const filenameCode = item.cardImageUrl ? item.cardImageUrl.split('?')[0].split('#')[0].split('/').pop()?.replace(/\.[^.]+$/, '') : undefined;
    const printingCode = filenameCode ?? item.cardCode;
    const card: Card | undefined = sealedProd
      ? sealedDisplayCard(sealedProd.id)
      : !isGeneral
      ? ((item.cardCode || item.cardImageUrl) ? {
          id: item.cardIdentityId ?? item.printingId,
          code: item.cardCode ?? '',
          name: item.cardName ?? item.title,
          color: item.cardColor ?? 'Red',
          type: (item.cardType==='Leader'||item.cardType==='Event')?item.cardType as Card['type']:'Character',
          cost: item.cardCost ?? 0,
          power: item.cardPower ?? 0,
          rarity: item.cardRarity ?? '',
          art: 0,
          effect: item.cardEffect ?? '',
          imageUrl: item.cardImageUrl,
          imageSource: 'external' as const,
          gameSlug: item.gameSlug === 'pokemon' || /^PK-/i.test(item.cardCode ?? '') ? 'pokemon' : 'one-piece',
          setCode: item.cardSetCode,
          language: item.cardLanguage,
          printingCode,
          variant: item.cardVariant,
        } : undefined) ?? cardFor(item.printingId)
      : undefined;

    let category: PlayerListingCategory = 'one-piece';
    let categoryLabel = 'One Piece';
    if (isGeneral) {
      category = 'general';
      categoryLabel = firstEntry?.generalProduct?.category
        ? generalMarketCategoryLabel(firstEntry.generalProduct.category, 'EN')
        : 'Hobby & Gear';
    } else if (sealedProd) {
      category = sealedProd.game === 'pokemon' ? 'pokemon' : 'one-piece';
      categoryLabel = sealedProd.game === 'pokemon' ? 'Pokémon Sealed' : 'One Piece Sealed';
    } else if (item.gameSlug === 'pokemon' || /^PK-/i.test(item.cardCode ?? '') || card?.gameSlug === 'pokemon') {
      category = 'pokemon';
      categoryLabel = 'Pokémon';
    }

    const photoUrl = firstPhotoId
      ? `/api/market/product-photos/${firstPhotoId}`
      : sealedProd?.imageUrl ?? null;

    return {
      id: item.id,
      href: marketListingPath(item.title, item.id),
      title: item.title,
      amount: item.amount,
      currency: item.currency,
      condition: item.condition,
      city: item.city,
      type: item.type,
      category,
      categoryLabel,
      photoUrl,
      card,
    };
  });

  const opCount = listingViewItems.filter((i) => i.category === 'one-piece').length;
  const pkCount = listingViewItems.filter((i) => i.category === 'pokemon').length;
  const genCount = listingViewItems.filter((i) => i.category === 'general').length;
  const publicDecksTotal = deckCount?.count ?? 0;

  let dynamicKicker = 'COLLECTOR';
  const hasOp = opCount > 0 || publicDecksTotal > 0;
  const hasPk = pkCount > 0;
  const hasGen = genCount > 0;
  if (hasOp && hasPk && hasGen) dynamicKicker = 'TCG & HOBBY MARKET SELLER';
  else if (hasOp && hasPk) dynamicKicker = 'ONE PIECE & POKÉMON COLLECTOR';
  else if (hasOp && hasGen) dynamicKicker = 'ONE PIECE TCG & HOBBY SELLER';
  else if (hasPk && hasGen) dynamicKicker = 'POKÉMON TCG & HOBBY SELLER';
  else if (hasPk) dynamicKicker = 'POKÉMON TCG COLLECTOR & SELLER';
  else if (hasGen) dynamicKicker = 'HOBBY & GEAR SELLER';
  else if (opCount > 0 && publicDecksTotal > 0) dynamicKicker = 'ONE PIECE TCG PLAYER & SELLER';
  else if (publicDecksTotal > 0) dynamicKicker = 'ONE PIECE TCG DECK BUILDER';
  else if (opCount > 0) dynamicKicker = 'ONE PIECE TCG COLLECTOR & SELLER';

  const activityMix = [
    ...(opCount > 0 ? [{ key: 'one-piece', label: 'One Piece', count: opCount }] : []),
    ...(pkCount > 0 ? [{ key: 'pokemon', label: 'Pokémon', count: pkCount }] : []),
    ...(genCount > 0 ? [{ key: 'general', label: 'Hobby & Gear', count: genCount }] : []),
    ...(publicDecksTotal > 0 ? [{ key: 'decks', label: 'Public Decks', count: publicDecksTotal }] : []),
  ];

  const initial = (p.display_name || p.username || 'P').charAt(0).toUpperCase();
  const regionLabel = REGION_NAMES[p.region] || p.region;
  const joinedDate = p.created_at
    ? new Date(p.created_at).toLocaleDateString('en-US', {month: 'short', year: 'numeric'})
    : 'Recently';

  const activeListingsTotal = listingCount?.count ?? 0;
  const completedTradesTotal = completedTradesCount?.count ?? 0;
  const deckFirst = publicDecksTotal > listings.length;

  const listingsSection = listings.length > 0 ? (
    <section key="listings" className="player-section">
      <div className="player-section-head">
        <div>
          <h2>Active Market Listings ({listings.length})</h2>
          <p>Items currently listed on Market by {p.display_name}.</p>
        </div>
        <Link href="/market" className="player-section-link">
          Browse Market <ArrowSquareOut size={14}/>
        </Link>
      </div>
      <PlayerListingsGrid items={listingViewItems} />
    </section>
  ) : null;

  const decksSection = decks.length > 0 ? (
    <section key="decks" className="player-section">
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
                <p>{leader ? `${leader.name}, Leader` : 'Custom Deck'}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  ) : null;

  return (
    <main className="page player-profile-page">
      {/* Shared Global Intro Banner */}
      <section className="library-intro player-intro">
        <div className="library-intro-copy">
          <p className="kicker">{dynamicKicker}</p>
          <h1>{p.display_name}</h1>
          <p className="player-intro-meta">
            <span className="player-intro-handle">@{p.username}</span>
            <span><Globe size={14}/>{regionLabel}</span>
            <span><Calendar size={14}/>Member since {joinedDate}</span>
          </p>
        </div>
        <div className="player-intro-side">
          <div className="player-kpi-strip" aria-label="Storefront summary">
            <div className="player-kpi-item">
              <b>{activeListingsTotal}</b>
              <span>Active {activeListingsTotal === 1 ? 'listing' : 'listings'}</span>
            </div>
            <div className="player-kpi-item">
              <b>{publicDecksTotal}</b>
              <span>Public {publicDecksTotal === 1 ? 'deck' : 'decks'}</span>
            </div>
            <div className="player-kpi-item">
              <b>{completedTradesTotal}</b>
              <span>Completed {completedTradesTotal === 1 ? 'trade' : 'trades'}</span>
            </div>
          </div>
          <div className="library-intro-actions">
            <ShareButton
              title={`${p.display_name} (@${p.username}) | VivrePlay`}
              path={`/players/${username}`}
            />
          </div>
        </div>
      </section>

      <div className="player-layout">
        {/* Left Sidebar: Collector Identity Card */}
        <aside className="player-card">
          <div className="player-card-head">
            <div className="player-card-avatar" aria-hidden="true">
              <span>{initial}</span>
            </div>
            <div className="player-card-identity">
              <h2>{p.display_name}</h2>
              <p className="player-card-handle">@{p.username}</p>
            </div>
          </div>

          <div className="player-card-rep">
            <MarketReputation username={p.username} language="EN" profile/>
          </div>

          {activityMix.length > 0 && (
            <div className="player-card-block" aria-label="Activity focus">
              <span className="player-card-label">Storefront Focus</span>
              <div className="player-activity-mix">
                {activityMix.map((entry) => (
                  <span key={entry.key} className={`player-activity-pill is-${entry.key}`}>
                    {entry.label} <b>{entry.count}</b>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="player-card-facts">
            <span><Globe size={15}/>{regionLabel} ({p.region})</span>
            <span><Calendar size={15}/>Member since {joinedDate}</span>
            <span><ShieldCheck size={15}/>Only shared decks and active listings appear here</span>
          </div>

          {sellerSocials.length > 0 && (
            <div className="player-social-links" aria-label="Connected social accounts">
              <span className="player-social-heading">Verified Socials</span>
              <div className="player-social-list">
                {sellerSocials.map((conn) => {
                  const url = socialProfileUrl(conn);
                  const label = socialDisplayHandle(conn);
                  const pLower = conn.platform.toLowerCase();
                  const icon =
                    pLower === 'instagram' ? <InstagramLogo size={14} weight="fill" /> :
                    pLower === 'facebook' ? <FacebookLogo size={14} weight="fill" /> :
                    pLower === 'threads' ? <ThreadsLogo size={14} weight="fill" /> :
                    <Globe size={14} />;
                  const inner = (
                    <>
                      <span className={`player-social-icon is-${pLower}`}>{icon}</span>
                      <span className="player-social-handle">{label}</span>
                      <SealCheck size={13} weight="fill" className="player-social-verified" aria-label="Verified connection" />
                    </>
                  );
                  return url ? (
                    <a
                      key={`${conn.platform}:${conn.platformAccountId}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="player-social-chip"
                    >
                      {inner}
                    </a>
                  ) : (
                    <span key={`${conn.platform}:${conn.platformAccountId}`} className="player-social-chip">
                      {inner}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="player-card-actions">
            <Link className="button secondary player-market-link-btn" href="/market">
              <Store size={16}/>
              Browse Market
            </Link>
          </div>
        </aside>

        {/* Right Area: Active Listings & Public Decks or Clean Empty State */}
        <div className="player-content">
          {deckFirst ? [decksSection, listingsSection] : [listingsSection, decksSection]}

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

export default withRequestLocale(Page);
