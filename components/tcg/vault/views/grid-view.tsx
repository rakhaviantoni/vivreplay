'use client';

import React from 'react';
import { StarIcon as Star } from '@phosphor-icons/react';
import { printings } from '@/packages/card-data/catalog';
import { formatCompactMoney } from '@/packages/domain';
import type { EnrichedCollectionItem } from '../types';
import { CardStackControls } from './card-stack-controls';
import { VaultStackArt } from './vault-stack-art';
import { groupVaultStacks } from '../vault-utils';

interface GridViewProps {
  items: EnrichedCollectionItem[];
  hideValues: boolean;
  onSelectItem: (item: EnrichedCollectionItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onSaved: () => Promise<void> | void;
  isAnonymous: boolean;
}

export function GridView({
  items,
  hideValues,
  onSelectItem,
  onToggleFavorite,
  onSaved,
  isAnonymous,
}: GridViewProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '20px 15px',
      padding: '10px 0'
    }}>
      {groupVaultStacks(items).map(stack => {
        const item=stack.item;
        const printing = printings.find(p => p.id === item.printingId);
        const lang = stack.languageLabel || item.language || item.card.language || printing?.language || 'EN';
        const isGraded = item.type === 'GRADED';
        const isFavorite=stack.items.some(copy=>copy.isFavorite);

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
              <VaultStackArt items={stack.items} quantity={stack.quantity}/>

              <div className="vault-slot-badges-top">
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span className="vault-badge-qty">
                    {isGraded ? 'SLAB' : `x${stack.quantity}`}
                  </span>
                  <span className="vault-badge-lang">{lang}</span>
                </div>

                <button
                  type="button"
                  className={`vault-favorite-btn ${isFavorite ? 'is-favorite' : ''}`}
                  onClick={e => {const pinned=stack.items.filter(copy=>copy.isFavorite);for(const copy of (pinned.length?pinned:[item]))onToggleFavorite(copy.id,e)}}
                  aria-label={isFavorite ? 'Remove from showcase' : 'Add to showcase'}
                >
                  <Star size={13} weight={isFavorite ? 'fill' : 'regular'} />
                </button>
              </div>

              <div className="vault-slot-badge-bottom">
                {isGraded ? (
                  <span className="vault-grade-pill">
                    <b>{item.provider || 'PSA'}</b> {item.grade || '10'}
                  </span>
                ) : (
                    <span className="vault-raw-pill">
                    {stack.conditionLabel}
                  </span>
                )}
              </div>
            </div>

              <div className="vault-slot-info">
              <h4 className="vault-slot-name">{item.card.name}</h4>
              <div className="vault-slot-meta-row">
                <span>{item.card.code} · {stack.printingLabel}</span>
                {!hideValues && (
                  <span className="vault-slot-value">
                    {stack.item.hasMarketEstimate ? formatCompactMoney(stack.estimatedValue, 'IDR') : '-'}
                  </span>
                )}
                </div>
                <CardStackControls item={item} stackItems={stack.items} quantity={stack.quantity} isAnonymous={isAnonymous} onSaved={onSaved} />
              </div>
          </div>
        );
      })}
    </div>
  );
}
