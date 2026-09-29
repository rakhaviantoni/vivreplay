'use client';

import React from 'react';
import { 
  HeartIcon as Heart, 
  StorefrontIcon as Store, 
  PlusIcon as Plus, 
  BellIcon as Bell, 
  TrashIcon as Trash 
} from '@phosphor-icons/react';
import { CardArt } from '../card-art';
import { cards, printings, cardFor } from '@/packages/card-data/catalog';
import { formatCompactMoney } from '@/packages/domain';
import type { WishlistItem } from '@/lib/client';

interface WishlistTabProps {
  wishlist: WishlistItem[];
  onFindListings: (code: string) => void;
  onAddToVault: (printingId: string) => void;
  onRemoveFromWishlist: (printingId: string) => void;
  onAddNewWishlistItem: () => void;
}

export function WishlistTab({
  wishlist,
  onFindListings,
  onAddToVault,
  onRemoveFromWishlist,
  onAddNewWishlistItem,
}: WishlistTabProps) {
  if (wishlist.length === 0) {
    return (
      <div className="vault-empty-state">
        <div className="vault-empty-slot-composition">
          <div className="vault-empty-dummy-slot" style={{ transform: 'rotate(-5deg)' }}>
            <Heart size={26} />
          </div>
          <div className="vault-empty-dummy-slot" style={{ borderStyle: 'solid', borderColor: 'var(--vault-gold)' }}>
            <Heart size={30} weight="fill" color="var(--vault-gold)" />
          </div>
          <div className="vault-empty-dummy-slot" style={{ transform: 'rotate(5deg)' }}>
            <Heart size={26} />
          </div>
        </div>
        <h2>Your Wishlist is Clear</h2>
        <p>
          Tag target cards with desired conditions, grades (like PSA 10), and target budget limits to track market listings.
        </p>
        <button
          type="button"
          className="vault-btn vault-btn-primary"
          onClick={onAddNewWishlistItem}
        >
          <Plus size={16} weight="bold" />
          Add Wanted Card
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '22px', fontWeight: 600, margin: 0 }}>
            Wanted Cards & Target Acquisitions
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--vault-ink-secondary)', margin: '2px 0 0' }}>
            {wishlist.length} cards tracked with price targets and condition preferences.
          </p>
        </div>
        <button
          type="button"
          className="vault-btn vault-btn-secondary"
          onClick={onAddNewWishlistItem}
        >
          <Plus size={15} />
          Add Wanted Card
        </button>
      </div>

      <div className="vault-wishlist-grid">
        {wishlist.map(w => {
          const card = cardFor(w.printingId) || cards[0];
          const printing = printings.find(p => p.id === w.printingId);
          const lang = printing?.language || 'EN';

          const targetGrade = w.targetGrade || 'PSA 10';
          const targetPrice = w.targetPrice || 30_000_000;
          const currentEstimate = 33_000_000; // Benchmark comparison

          return (
            <div key={w.printingId} className="vault-wishlist-card">
              <div className="vault-wishlist-art">
                <CardArt card={card} small />
              </div>

              <div className="vault-wishlist-info">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 title={card.name}>{card.name}</h4>
                  <button
                    type="button"
                    onClick={() => onRemoveFromWishlist(w.printingId)}
                    style={{ background: 'none', border: 'none', color: 'var(--vault-ink-muted)', cursor: 'pointer', padding: '2px' }}
                    title="Remove from wishlist"
                  >
                    <Trash size={14} />
                  </button>
                </div>

                <div style={{ fontSize: '10.5px', color: 'var(--vault-ink-muted)' }}>
                  {card.code} · {lang} · {card.rarity}
                </div>

                <div className="vault-wishlist-target" style={{ marginTop: '6px' }}>
                  <span>Target: <b>{targetGrade} ≤ {formatCompactMoney(targetPrice, 'IDR')}</b></span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                    <span>Est. market: <b>{formatCompactMoney(currentEstimate, 'IDR')}</b></span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--vault-gold)', fontSize: '10px' }}>
                      <Bell size={11} weight="fill" />
                      Alert on
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="vault-btn vault-btn-primary"
                    style={{ flex: 1, height: '32px', fontSize: '11px', justifyContent: 'center' }}
                    onClick={() => onFindListings(card.code)}
                  >
                    <Store size={13} />
                    Find Listings
                  </button>
                  <button
                    type="button"
                    className="vault-btn vault-btn-secondary"
                    style={{ height: '32px', padding: '0 8px', fontSize: '11px' }}
                    onClick={() => onAddToVault(w.printingId)}
                    title="Mark acquired / Add to Vault"
                  >
                    <Plus size={13} />
                    Vault
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
