'use client';

import { useMemo, useState } from 'react';
import Link from '@/components/ui/localized-link';
import { CardsIcon as Cards } from '@phosphor-icons/react';
import { formatMoney } from '@/packages/domain';
import type { Card } from '@/packages/card-data/catalog';
import { CardArt } from '@/components/tcg/card-art';

export type PlayerListingCategory = 'one-piece' | 'pokemon' | 'general';

export type PlayerListingViewItem = {
  id: string;
  href: string;
  title: string;
  amount: number;
  currency: string;
  condition: string;
  city: string;
  type: string;
  category: PlayerListingCategory;
  categoryLabel: string;
  photoUrl?: string | null;
  card?: Card;
};

export function PlayerListingsGrid({
  items,
}: {
  items: PlayerListingViewItem[];
}) {
  const [activeCategory, setActiveCategory] = useState<'all' | PlayerListingCategory>('all');

  const counts = useMemo(() => {
    const c = { 'one-piece': 0, pokemon: 0, general: 0 };
    for (const item of items) c[item.category]++;
    return c;
  }, [items]);

  const presentCategories = (['one-piece', 'pokemon', 'general'] as const).filter(
    (cat) => counts[cat] > 0
  );
  const showFilterTabs = presentCategories.length > 1;

  const visible = useMemo(
    () => (activeCategory === 'all' ? items : items.filter((item) => item.category === activeCategory)),
    [activeCategory, items]
  );

  const labelFor = (cat: PlayerListingCategory) =>
    cat === 'one-piece' ? 'One Piece' : cat === 'pokemon' ? 'Pokémon' : 'Other Items';

  return (
    <>
      {showFilterTabs && (
        <div className="player-listing-filters" role="tablist" aria-label="Filter listings by category">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'all'}
            className={activeCategory === 'all' ? 'is-active' : ''}
            onClick={() => setActiveCategory('all')}
          >
            All ({items.length})
          </button>
          {presentCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat}
              className={activeCategory === cat ? 'is-active' : ''}
              onClick={() => setActiveCategory(cat)}
            >
              {labelFor(cat)} ({counts[cat]})
            </button>
          ))}
        </div>
      )}

      <div className="player-listings-grid">
        {visible.map((item) => (
          <article key={item.id} className="player-listing-card">
            <Link href={item.href} className="player-listing-card-art">
              {item.photoUrl ? (
                <div className="player-listing-photo-frame">
                  <img src={item.photoUrl} alt={item.title} loading="lazy" />
                </div>
              ) : item.card ? (
                <CardArt card={item.card} />
              ) : (
                <div className="player-listing-art-placeholder">
                  <Cards size={32} />
                </div>
              )}
            </Link>
            <div className="player-listing-card-copy">
              <strong>{item.title}</strong>
              <small>
                {[item.categoryLabel, item.condition, item.city].filter(Boolean).join(' · ')}
              </small>
              <p>
                <span className={item.type === 'WTB' ? 'is-wtb' : 'is-wts'}>
                  {item.type === 'WTB' ? 'WTB' : 'WTS'}
                </span>
                <b>{formatMoney(item.amount, item.currency)}</b>
              </p>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
