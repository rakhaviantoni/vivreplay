'use client';

import React from 'react';
import { 
  StarIcon as Star, 
  StorefrontIcon as Store, 
  PencilSimpleIcon as Pencil, 
  ArrowUpRightIcon as ArrowUpRight 
} from '@phosphor-icons/react';
import { CardArt } from '../card-art';
import { printings } from '@/packages/card-data/catalog';
import { formatCompactMoney, formatMoney } from '@/packages/domain';
import type { EnrichedCollectionItem } from '../types';

interface ListViewProps {
  items: EnrichedCollectionItem[];
  hideValues: boolean;
  onSelectItem: (item: EnrichedCollectionItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onSellItem: (item: EnrichedCollectionItem, e: React.MouseEvent) => void;
}

export function ListView({
  items,
  hideValues,
  onSelectItem,
  onToggleFavorite,
  onSellItem,
}: ListViewProps) {
  return (
    <div style={{
      background: 'var(--vault-panel)',
      border: '1px solid var(--vault-border)',
      borderRadius: '14px',
      overflowX: 'auto',
      boxShadow: '0 4px 14px rgba(35, 28, 16, 0.04)',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
        <thead>
          <tr style={{
            background: 'var(--vault-slot-bg)',
            borderBottom: '1px solid var(--vault-border)',
            color: 'var(--vault-ink-muted)',
            fontSize: '10.5px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            <th style={{ padding: '12px 16px', width: '48px' }}>Card</th>
            <th style={{ padding: '12px 16px' }}>Identity & Printing</th>
            <th style={{ padding: '12px 16px' }}>Format & Grade</th>
            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Qty</th>
            {!hideValues && <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acquired</th>}
            {!hideValues && <th style={{ padding: '12px 16px', textAlign: 'right' }}>Est. Value</th>}
            {!hideValues && <th style={{ padding: '12px 16px', textAlign: 'right' }}>P&L</th>}
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const printing = printings.find(p => p.id === item.printingId);
            const lang = printing?.language || 'EN';
            const isGraded = item.type === 'GRADED';

            return (
              <tr
                key={item.id}
                onClick={() => onSelectItem(item)}
                style={{
                  borderBottom: idx < items.length - 1 ? '1px solid var(--vault-border-light)' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                className="vault-list-row"
              >
                {/* Thumbnail */}
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ width: '40px', aspectRatio: '420/580', borderRadius: '4px', overflow: 'hidden' }}>
                    <CardArt card={item.card} small />
                  </div>
                </td>

                {/* Name & Code */}
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={e => onToggleFavorite(item.id, e)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      aria-label="Toggle showcase"
                    >
                      <Star
                        size={14}
                        weight={item.isFavorite ? 'fill' : 'regular'}
                        color={item.isFavorite ? '#f1c40f' : 'var(--vault-ink-muted)'}
                      />
                    </button>
                    <div>
                      <strong style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '13.5px', color: 'var(--vault-ink)' }}>
                        {item.card.name}
                      </strong>
                      <div style={{ fontSize: '10.5px', color: 'var(--vault-ink-secondary)', display: 'flex', gap: '6px' }}>
                        <span>{item.card.code}</span>
                        <span>·</span>
                        <span>{lang}</span>
                        <span>·</span>
                        <span>{printing?.variant || 'Standard'}</span>
                        <span>·</span>
                        <span>{item.card.rarity}</span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Format & Grade */}
                <td style={{ padding: '10px 16px' }}>
                  {isGraded ? (
                    <span className="vault-grade-pill">
                      <b>{item.provider || 'PSA'}</b> {item.grade || '10'}
                      {item.verificationStatus === 'provider_verified' && <span style={{ color: '#4ade80' }}>✓</span>}
                    </span>
                  ) : (
                    <span className="vault-raw-pill">
                      Raw · {item.condition || 'NM'}
                    </span>
                  )}
                </td>

                {/* Quantity */}
                <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>
                  {isGraded ? '1' : item.quantity}
                </td>

                {/* Acquired Cost */}
                {!hideValues && (
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--vault-ink-secondary)' }}>
                    {item.acquisitionAmount ? formatCompactMoney(item.acquisitionAmount, 'IDR') : '-'}
                  </td>
                )}

                {/* Estimated Value */}
                {!hideValues && (
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--vault-ink)' }}>
                    {item.hasMarketEstimate ? formatCompactMoney(item.estimatedValue, 'IDR') : '-'}
                  </td>
                )}

                {/* P&L */}
                {!hideValues && (
                  <td style={{
                    padding: '10px 16px',
                    textAlign: 'right',
                    fontWeight: 600,
                    color: item.gainLossAmount >= 0 ? '#2e8b57' : '#c0392b',
                  }}>
                    {item.hasMarketEstimate && item.acquisitionAmount > 0 ? <>{item.gainLossAmount >= 0 ? '+' : ''}{formatCompactMoney(item.gainLossAmount, 'IDR')}<small style={{ display: 'block', fontSize: '10px', opacity: 0.85 }}>({item.gainLossPercent >= 0 ? '+' : ''}{item.gainLossPercent.toFixed(1)}%)</small></> : '-'}
                  </td>
                )}

                {/* Actions */}
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="vault-btn vault-btn-secondary"
                      style={{ height: '30px', padding: '0 8px', fontSize: '11px' }}
                      onClick={e => onSellItem(item, e)}
                      title="Sell on VivrePlay Market"
                    >
                      <Store size={13} />
                      Sell
                    </button>
                    <button
                      type="button"
                      className="vault-btn vault-btn-ghost"
                      style={{ height: '30px', width: '30px', padding: 0 }}
                      onClick={() => onSelectItem(item)}
                      title="View details"
                    >
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
