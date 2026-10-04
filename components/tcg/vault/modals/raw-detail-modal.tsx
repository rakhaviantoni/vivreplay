'use client';

import React from 'react';
import Link from 'next/link';
import { 
  XIcon as X, 
  StorefrontIcon as Store, 
  PlusIcon as Plus, 
  HeartIcon as Heart, 
  PencilSimpleIcon as Edit, 
  ShareNetworkIcon as Share2, 
  TrashIcon as Trash,
  StarIcon as Star,
  TrendUpIcon as TrendingUp,
  StackIcon as Deck
} from '@phosphor-icons/react';
import { CardArt } from '../card-art';
import { printings } from '@/packages/card-data/catalog';
import { PRICECHARTING_USD_TO_IDR_RATE } from '@/lib/market/pricecharting';
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
  const lang = item.language || item.card.language || printing?.language || 'EN';
  const variant = item.variant || item.card.variant || printing?.variant || 'Standard';
  const listedQuantity = Math.min(item.quantity, item.listedQuantity ?? 0);
  const availableQuantity = Math.max(0, item.quantity - listedQuantity);
  const activeListingHref = item.activeListingId ? `/market/${encodeURIComponent(item.activeListingId)}` : null;
  const notes = item.notes?.trim();
  const showNotes = notes && notes.toLowerCase() !== 'market listing copy';

  return (
    <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} style={{
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
      <div className="vault-detail-modal" role="dialog" aria-modal="true" aria-label={`${item.card.name} card details`} style={{
        width: '100%',
        maxWidth: '760px',
        borderRadius: '18px',
        background: 'var(--vault-panel)',
        border: '1px solid var(--vault-border)',
        boxShadow: '0 28px 70px rgba(0, 0, 0, 0.3)',
        position: 'relative',
        maxHeight: 'calc(100dvh - 40px)',
        overflow: 'hidden',
      }}>
        <button type="button" className="vault-modal-close" onClick={onClose} aria-label="Close card details">
          <X size={20} />
        </button>
        <div className="vault-detail-scroll">
        {/* Left: Card Artwork */}
        <div>
          <div className="vault-detail-art" style={{
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--vault-gold)', textTransform: 'uppercase' }}>
                {item.card.code} · {item.card.rarity} · {(item.visibility==='marketplace-only'?'private':item.visibility).toUpperCase()}
              </span>
              <h2 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '24px', fontWeight: 600, margin: '2px 0 0', color: 'var(--vault-ink)' }}>
                {item.card.name}
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)' }}>
                {item.printingCode || item.card.printingCode || item.card.code} · {item.setCode || printing?.set || item.card.setCode || 'Set not listed'}
              </span>
              {listedQuantity > 0 && (
                <span style={{ alignSelf: 'flex-start', marginTop: '3px', padding: '4px 8px', borderRadius: '5px', background: 'var(--vault-slot-bg)', border: '1px solid var(--vault-border)', color: 'var(--vault-ink-secondary)', fontSize: '10px', fontWeight: 700 }}>
                  {listedQuantity} of {item.quantity} {listedQuantity === 1 ? 'copy' : 'copies'} listed · {availableQuantity} available
                </span>
              )}
            </div>
          </div>

          {/* Attributes Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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
              <strong>{lang} · {variant}</strong>
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
                {hideValues ? '••••••••' : item.hasMarketEstimate ? formatMoney(item.estimatedValue, 'IDR') : 'Not available'}
              </strong>
              {!hideValues && item.marketPriceSource === 'pricecharting' && (
                <small style={{ display: 'block', marginTop: 4, color: 'var(--vault-ink-muted)' }}>
                  PriceCharting ungraded · USD converted at Rp {PRICECHARTING_USD_TO_IDR_RATE.toLocaleString('id-ID')}/USD
                  {item.marketPriceUrl && <a href={item.marketPriceUrl} target="_blank" rel="noopener noreferrer"> View source</a>}
                </small>
              )}
              {!hideValues && item.marketPriceSource === 'yuyutei' && <small style={{ display: 'block', marginTop: 4, color: 'var(--vault-ink-muted)' }}>Yuyutei · exact printing</small>}
            </div>
          </div>

          {/* Gain / Loss Pill */}
          {!hideValues && item.acquisitionAmount > 0 && item.hasMarketEstimate && (
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
          {showNotes && (
            <div style={{ marginBottom: '18px', fontSize: '12px', color: 'var(--vault-ink-secondary)', fontStyle: 'italic', background: 'var(--vault-panel)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--vault-border-light)' }}>
              &ldquo;{item.notes}&rdquo;
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginTop: 'auto' }}>
            <Link
              href={`/decks/builder?card=${encodeURIComponent(item.printingId)}`}
              className="vault-btn vault-btn-secondary"
            >
              <Deck size={15} />
              Build with this card
            </Link>
            <button
              type="button"
              className="vault-btn vault-btn-primary"
              onClick={() => onAddCopy(item)}
            >
              <Plus size={15} />
              Add Copy (+1)
            </button>
            {listedQuantity > 0 ? (
              <Link href={activeListingHref ?? '/market'} className="vault-btn vault-btn-secondary">
                <Store size={15} />
                {activeListingHref ? 'View Active Listing' : 'Manage Listings'}
              </Link>
            ) : (
              <button
                type="button"
                className="vault-btn vault-btn-secondary"
                onClick={() => onSell(item)}
              >
                <Store size={15} />
                List for Sale
              </button>
            )}
            <button
              type="button"
              className="vault-btn vault-btn-secondary"
              onClick={() => onMoveToWishlist(item)}
            >
              <Heart size={15} />
              Add to Wishlist
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
    </div>
  );
}
