'use client';

import React from 'react';
import { StarIcon as Star } from '@phosphor-icons/react';
import { CardArt } from '../card-art';
import { printings } from '@/packages/card-data/catalog';
import { formatCompactMoney } from '@/packages/domain';
import type { EnrichedCollectionItem } from '../types';

interface GridViewProps {
  items: EnrichedCollectionItem[];
  hideValues: boolean;
  onSelectItem: (item: EnrichedCollectionItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
}

export function GridView({
  items,
  hideValues,
  onSelectItem,
  onToggleFavorite,
}: GridViewProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '20px 15px',
      padding: '10px 0'
    }}>
      {items.map(item => {
        const printing = printings.find(p => p.id === item.printingId);
        const lang = printing?.language || 'EN';
        const isGraded = item.type === 'GRADED';

        return (
          <div
            key={item.id}
            className="vault-slot"
            onClick={() => onSelectItem(item)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') onSelectItem(item); }}
          >
            <div className="vault-slot-card-stage">
              <CardArt card={item.card} />

              <div className="vault-slot-badges-top">
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span className="vault-badge-qty">
                    {isGraded ? 'SLAB' : `x${item.quantity}`}
                  </span>
                  <span className="vault-badge-lang">{lang}</span>
                </div>

                <button
                  type="button"
                  className={`vault-favorite-btn ${item.isFavorite ? 'is-favorite' : ''}`}
                  onClick={e => onToggleFavorite(item.id, e)}
                  aria-label={item.isFavorite ? 'Remove from showcase' : 'Add to showcase'}
                >
                  <Star size={13} weight={item.isFavorite ? 'fill' : 'regular'} />
                </button>
              </div>

              <div className="vault-slot-badge-bottom">
                {isGraded ? (
                  <span className="vault-grade-pill">
                    <b>{item.provider || 'PSA'}</b> {item.grade || '10'}
                  </span>
                ) : (
                  <span className="vault-raw-pill">
                    {item.condition || 'NM'}
                  </span>
                )}
              </div>
            </div>

            <div className="vault-slot-info">
              <h4 className="vault-slot-name">{item.card.name}</h4>
              <div className="vault-slot-meta-row">
                <span>{item.card.code} · {printing?.variant || 'Standard'}</span>
                {!hideValues && (
                  <span className="vault-slot-value">
                    {formatCompactMoney(item.estimatedValue, 'IDR')}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
