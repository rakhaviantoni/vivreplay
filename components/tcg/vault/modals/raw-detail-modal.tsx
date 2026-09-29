'use client';

import React from 'react';
import { 
  XIcon as X, 
  StorefrontIcon as Store, 
  PlusIcon as Plus, 
  HeartIcon as Heart, 
  PencilSimpleIcon as Edit, 
  ShareNetworkIcon as Share2, 
  TrashIcon as Trash,
  StarIcon as Star,
  TrendUpIcon as TrendingUp
} from '@phosphor-icons/react';
import { CardArt } from '../card-art';
import { printings } from '@/packages/card-data/catalog';
import { formatCompactMoney, formatMoney } from '@/packages/domain';
import type { EnrichedCollectionItem } from '../types';

interface RawDetailModalProps {
  item: EnrichedCollectionItem | null;
  open: boolean;
  hideValues: boolean;
  onClose: () => void;
  onEdit: (item: EnrichedCollectionItem) => void;
  onAddCopy: (item: EnrichedCollectionItem) => void;
  onSell: (item: EnrichedCollectionItem) => void;
  onMoveToWishlist: (item: EnrichedCollectionItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string) => void;
  onShare: (item: EnrichedCollectionItem) => void;
}

export function RawDetailModal({
  item,
  open,
  hideValues,
  onClose,
  onEdit,
  onAddCopy,
  onSell,
  onMoveToWishlist,
  onToggleFavorite,
  onDelete,
  onShare,
}: RawDetailModalProps) {
  if (!open || !item) return null;

  const printing = printings.find(p => p.id === item.printingId);
  const lang = printing?.language || 'EN';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 150,
      background: 'rgba(10, 12, 16, 0.75)',
      backdropFilter: 'blur(7px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '720px',
        borderRadius: '18px',
        background: 'var(--vault-panel)',
        border: '1px solid var(--vault-border)',
        boxShadow: '0 28px 70px rgba(0, 0, 0, 0.3)',
        padding: '28px',
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 280px) 1fr',
        gap: '28px',
      }}>
        {/* Left: Card Artwork */}
        <div>
          <div style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 12px 28px rgba(35, 28, 16, 0.18)',
          }}>
            <CardArt card={item.card} />
          </div>

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              className={`vault-btn ${item.isFavorite ? 'vault-btn-primary' : 'vault-btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'center', height: '36px' }}
              onClick={e => onToggleFavorite(item.id, e)}
            >
              <Star size={15} weight={item.isFavorite ? 'fill' : 'regular'} />
              {item.isFavorite ? 'Showcase Pinned' : 'Pin to Showcase'}
            </button>
          </div>
        </div>

        {/* Right: Card Details & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--vault-gold)', textTransform: 'uppercase' }}>
                {item.card.code} · {item.card.rarity} · {item.visibility.toUpperCase()}
              </span>
              <h2 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '24px', fontWeight: 600, margin: '2px 0 0', color: 'var(--vault-ink)' }}>
                {item.card.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vault-ink-muted)' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Attributes Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            margin: '18px 0',
            padding: '14px',
            borderRadius: '10px',
            background: 'var(--vault-slot-bg)',
            border: '1px solid var(--vault-border)',
            fontSize: '11.5px',
          }}>
            <div>
              <span style={{ color: 'var(--vault-ink-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Printing & Lang
              </span>
              <strong>{lang} · {printing?.variant || 'Standard'}</strong>
            </div>

            <div>
              <span style={{ color: 'var(--vault-ink-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Condition & Copies
              </span>
              <strong>{item.condition} · {item.quantity} {item.quantity > 1 ? 'copies' : 'copy'}</strong>
            </div>

            <div>
              <span style={{ color: 'var(--vault-ink-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Acquisition Cost
              </span>
              <strong>{hideValues ? '••••••••' : (item.acquisitionAmount ? formatMoney(item.acquisitionAmount, 'IDR') : '-')}</strong>
            </div>

            <div>
              <span style={{ color: 'var(--vault-ink-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Est. Market Value
              </span>
              <strong style={{ color: 'var(--vault-gold)' }}>
                {hideValues ? '••••••••' : formatMoney(item.estimatedValue, 'IDR')}
              </strong>
            </div>
          </div>

          {/* Gain / Loss Pill */}
          {!hideValues && item.acquisitionAmount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11.5px',
              fontWeight: 600,
              color: item.gainLossAmount >= 0 ? '#2e8b57' : '#c0392b',
              marginBottom: '14px',
            }}>
              <TrendingUp size={15} />
              <span>
                {item.gainLossAmount >= 0 ? '+' : ''}{formatCompactMoney(item.gainLossAmount, 'IDR')} ({item.gainLossPercent >= 0 ? '+' : ''}{item.gainLossPercent.toFixed(1)}% unrealized change)
              </span>
            </div>
          )}

          {/* Collector Notes */}
          {item.notes && (
            <div style={{ marginBottom: '18px', fontSize: '12px', color: 'var(--vault-ink-secondary)', fontStyle: 'italic', background: 'var(--vault-panel)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--vault-border-light)' }}>
              &ldquo;{item.notes}&rdquo;
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: 'auto' }}>
            <button
              type="button"
              className="vault-btn vault-btn-primary"
              onClick={() => onAddCopy(item)}
            >
              <Plus size={15} />
              Add Copy (+1)
            </button>
            <button
              type="button"
              className="vault-btn vault-btn-secondary"
              onClick={() => onSell(item)}
            >
              <Store size={15} />
              List for Sale
            </button>
            <button
              type="button"
              className="vault-btn vault-btn-secondary"
              onClick={() => onMoveToWishlist(item)}
            >
              <Heart size={15} />
              Wishlist Copy
            </button>
            <button
              type="button"
              className="vault-btn vault-btn-secondary"
              onClick={() => onEdit(item)}
            >
              <Edit size={15} />
              Edit Details
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--vault-border-light)' }}>
            <button
              type="button"
              className="vault-btn vault-btn-ghost"
              style={{ color: '#c0392b', padding: '0 6px' }}
              onClick={() => onDelete(item.id)}
            >
              <Trash size={14} />
              Delete Item
            </button>
            <button
              type="button"
              className="vault-btn vault-btn-ghost"
              onClick={() => onShare(item)}
            >
              <Share2 size={14} />
              Share Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
