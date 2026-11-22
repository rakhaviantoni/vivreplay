'use client';

import { useMemo, useState } from 'react';
import Link from '@/components/ui/localized-link';
import {
  CardsIcon as Cards,
  MagnifyingGlassIcon as MagnifyingGlass,
  XIcon as X,
} from '@phosphor-icons/react';
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
  const [tradeType, setTradeType] = useState<'all' | 'WTS' | 'WTB'>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const c = { 'one-piece': 0, pokemon: 0, general: 0, wts: 0, wtb: 0 };
    for (const item of items) {
      c[item.category]++;
      if (item.type === 'WTB') c.wtb++;
      else c.wts++;
    }
    return c;
  }, [items]);

  const presentCategories = (['one-piece', 'pokemon', 'general'] as const).filter(
    (cat) => counts[cat] > 0
  );
  const showFilterTabs = presentCategories.length > 1;
  const showTradeFilter = counts.wts > 0 && counts.wtb > 0;
  const showToolbar = items.length > 3 || showFilterTabs || showTradeFilter;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (tradeType !== 'all') {
        const normalizedType = item.type === 'WTB' ? 'WTB' : 'WTS';
        if (normalizedType !== tradeType) return false;
      }
      if (needle) {
        const haystack = [item.title, item.categoryLabel, item.condition, item.city]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [activeCategory, items, query, tradeType]);

  const hasActiveFilter = activeCategory !== 'all' || tradeType !== 'all' || query.trim().length > 0;

  const labelFor = (cat: PlayerListingCategory) =>
    cat === 'one-piece' ? 'One Piece' : cat === 'pokemon' ? 'Pokémon' : 'Other Items';

  return (
    <>
      {showToolbar && (
        <div className="player-listings-toolbar">
          <div className="player-listings-search">
            <MagnifyingGlass size={15} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search listings, sets, or city..."
              aria-label="Search player listings"
            />
            {query && (
              <button
                type="button"
                className="player-listings-search-clear"
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="player-listings-controls">
            {showTradeFilter && (
              <div className="player-trade-filters" role="group" aria-label="Filter by trade type">
                <button
                  type="button"
                  className={tradeType === 'all' ? 'is-active' : ''}
                  onClick={() => setTradeType('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={tradeType === 'WTS' ? 'is-active' : ''}
                  onClick={() => setTradeType('WTS')}
                >
                  WTS ({counts.wts})
                </button>
                <button
                  type="button"
                  className={tradeType === 'WTB' ? 'is-active' : ''}
                  onClick={() => setTradeType('WTB')}
                >
                  WTB ({counts.wtb})
                </button>
              </div>
            )}

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
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="player-empty-filter">
          <p>No listings match your current filter.</p>
          {hasActiveFilter && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setActiveCategory('all');
                setTradeType('all');
                setQuery('');
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
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
                <Link href={item.href} className="player-listing-card-title">
                  <strong>{item.title}</strong>
                </Link>
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
      )}
    </>
  );
}
