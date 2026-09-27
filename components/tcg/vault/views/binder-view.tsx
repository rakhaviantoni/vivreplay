'use client';

import React, { useState } from 'react';
import { 
  CaretLeftIcon as ChevronLeft, 
  CaretRightIcon as ChevronRight, 
  StarIcon as Star, 
  PlusIcon as Plus 
} from '@phosphor-icons/react';
import { CardArt } from '../card-art';
import { printings } from '@/packages/card-data/catalog';
import { formatCompactMoney } from '@/packages/domain';
import type { EnrichedCollectionItem } from '../types';

interface BinderViewProps {
  items: EnrichedCollectionItem[];
  hideValues: boolean;
  onSelectItem: (item: EnrichedCollectionItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onAddNewCard: () => void;
}

export function BinderView({
  items,
  hideValues,
  onSelectItem,
  onToggleFavorite,
  onAddNewCard,
}: BinderViewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 9; // 3 x 3 grid per binder page
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages - 1);

  const startIdx = validCurrentPage * pageSize;
  const pageItems = items.slice(startIdx, startIdx + pageSize);

  // Fill up to 9 slots with empty placeholders if on the last page
  const remainingSlots = Math.max(0, pageSize - pageItems.length);

  return (
    <div className="vault-binder-container">
      {/* Binder Page Archival Header */}
      <div className="vault-binder-page-header">
        <div className="vault-binder-page-title">
          <span>Digital Binder Archive</span>
          <span style={{ margin: '0 8px', opacity: 0.5 }}>·</span>
          <span>{items.length} cards catalogued</span>
        </div>

        {/* Page Turnover Pagination */}
        <div className="vault-binder-pagination">
          <button
            type="button"
            disabled={validCurrentPage === 0}
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            aria-label="Previous binder page"
            title="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Page {validCurrentPage + 1} of {totalPages}
          </span>
          <button
            type="button"
            disabled={validCurrentPage >= totalPages - 1}
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            aria-label="Next binder page"
            title="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 3x3 Binder Card Grid */}
      <div className="vault-binder-grid">
        {pageItems.map(item => {
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
              {/* Card Art Stage with depth and soft shadow */}
              <div className="vault-slot-card-stage">
                <CardArt card={item.card} />

                {/* Badges Overlay */}
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
                    title={item.isFavorite ? 'In Showcase (Top cards)' : 'Pin to Showcase'}
                  >
                    <Star size={13} weight={item.isFavorite ? 'fill' : 'regular'} />
                  </button>
                </div>

                {/* Grade or Condition pill on bottom of card */}
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

              {/* Slot Meta Information */}
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

        {/* Faint Empty Placeholder Slots to complete the binder page */}
        {Array.from({ length: remainingSlots }).map((_, index) => (
          <div
            key={`empty-slot-${index}`}
            className="vault-slot-empty"
            onClick={onAddNewCard}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') onAddNewCard(); }}
            title="Empty binder pocket · Click to add card"
          >
            <Plus size={22} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>Empty Pocket</span>
          </div>
        ))}
      </div>
    </div>
  );
}
