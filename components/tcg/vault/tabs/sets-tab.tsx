'use client';

import React, { useState } from 'react';
import { 
  TrophyIcon as Trophy, 
  ShareNetworkIcon as Share2, 
  StorefrontIcon as Store, 
  ArrowLeftIcon as ArrowLeft,
  CheckCircleIcon as CheckCircle,
  EyeIcon as Eye,
  SparkleIcon as Sparkles
} from '@phosphor-icons/react';
import { CardArt } from '../card-art';
import { cards, printings, Card } from '@/packages/card-data/catalog';
import type { SetProgress, EnrichedCollectionItem } from '../types';

interface SetsTabProps {
  progressList: SetProgress[];
  items: EnrichedCollectionItem[];
  onShareProgress: (set: SetProgress) => void;
  onFindMissingInMarket: (setCode: string) => void;
  onSelectItem: (item: EnrichedCollectionItem) => void;
}

export function SetsTab({
  progressList,
  items,
  onShareProgress,
  onFindMissingInMarket,
  onSelectItem,
}: SetsTabProps) {
  const [activeSetCode, setActiveSetCode] = useState<string | null>(null);
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [variantFilter, setVariantFilter] = useState<'all' | 'standard' | 'parallel'>('all');

  const selectedSet = progressList.find(s => s.code === activeSetCode);

  if (activeSetCode && selectedSet) {
    // Collect all cards associated with this set code
    const setAllCards = cards.filter(c => c.setCode === activeSetCode);
    
    // Determine which are owned
    const ownedMap = new Map<string, EnrichedCollectionItem>();
    items.forEach(item => {
      if (item.card.setCode === activeSetCode) {
        ownedMap.set(item.card.code, item);
      }
    });

    const displayCards = setAllCards.filter(c => {
      const isOwned = ownedMap.has(c.code);
      if (filterMissingOnly && isOwned) return false;
      return true;
    });

    return (
      <div>
        {/* Back and Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button
            type="button"
            className="vault-btn vault-btn-secondary"
            onClick={() => setActiveSetCode(null)}
          >
            <ArrowLeft size={16} />
            All Sets
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="vault-btn vault-btn-secondary"
              onClick={() => onShareProgress(selectedSet)}
            >
              <Share2 size={15} />
              Share Progress
            </button>
            <button
              type="button"
              className="vault-btn vault-btn-primary"
              onClick={() => onFindMissingInMarket(selectedSet.code)}
            >
              <Store size={15} />
              Find Missing Cards
            </button>
          </div>
        </div>

        {/* Set Header Card */}
        <div className="vault-set-card" style={{ marginBottom: '24px' }}>
          <div className="vault-set-header">
            <div>
              <span className="vault-set-code">{selectedSet.code}</span>
              <h2 className="vault-set-title">{selectedSet.name}</h2>
              <p style={{ fontSize: '12px', color: 'var(--vault-ink-secondary)', margin: '4px 0 0' }}>
                Official set sequence inspection. Owned cards are illuminated; missing cards appear as silhouettes.
              </p>
            </div>
            <span className="vault-set-percent">{selectedSet.percentage}%</span>
          </div>

          <div className="vault-set-progress-track">
            <div className="vault-set-progress-bar" style={{ width: `${selectedSet.percentage}%` }} />
          </div>

          <div className="vault-set-stats-row">
            <span>Main Set: <b>{selectedSet.mainSetOwned} / {selectedSet.mainSetTotal}</b></span>
            <span>Parallels: <b>{selectedSet.parallelsOwned} / {selectedSet.parallelsTotal}</b></span>
            <span>Master Set: <b>{Math.min(100, Math.round(((selectedSet.mainSetOwned + selectedSet.parallelsOwned) / (selectedSet.mainSetTotal + selectedSet.parallelsTotal)) * 100))}%</b></span>
          </div>
        </div>

        {/* Completion Milestone Moment (Restrained Archival Banner) */}
        {selectedSet.isComplete && (
          <div className="vault-completion-banner">
            <div className="vault-completion-banner-text">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trophy size={20} color="var(--vault-gold)" weight="fill" />
                <h3>Set Complete · {selectedSet.code}</h3>
              </div>
              <p>
                {selectedSet.name} collection complete ({selectedSet.mainSetTotal} / {selectedSet.mainSetTotal} cards acquired).
              </p>
            </div>
            <button
              type="button"
              className="vault-btn vault-btn-primary"
              onClick={() => onShareProgress(selectedSet)}
            >
              <Share2 size={15} />
              Share Milestone
            </button>
          </div>
        )}

        {/* Filter bar for Set View */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className={`vault-btn vault-btn-secondary ${!filterMissingOnly ? 'is-active' : ''}`}
              onClick={() => setFilterMissingOnly(false)}
            >
              All Set Cards ({setAllCards.length})
            </button>
            <button
              type="button"
              className={`vault-btn vault-btn-secondary ${filterMissingOnly ? 'is-active' : ''}`}
              onClick={() => setFilterMissingOnly(true)}
            >
              Missing Only ({Math.max(0, setAllCards.length - ownedMap.size)})
            </button>
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--vault-ink-muted)' }}>
            Showing {displayCards.length} cards in official release order
          </span>
        </div>

        {/* Official Set Sequence Grid */}
        <div className="vault-set-inspect-grid">
          {displayCards.map(card => {
            const ownedItem = ownedMap.get(card.code);
            const isOwned = Boolean(ownedItem);

            return (
              <div
                key={card.id}
                className={`vault-set-item-slot ${!isOwned ? 'is-missing' : ''}`}
                onClick={() => {
                  if (ownedItem) {
                    onSelectItem(ownedItem);
                  } else {
                    onFindMissingInMarket(card.code);
                  }
                }}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                title={isOwned ? `${card.name} (Owned)` : `${card.name} (Missing · Click to find listings)`}
              >
                <div className="vault-slot-card-stage">
                  <CardArt card={card} />
                </div>
                <div style={{ padding: '2px 4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--vault-ink-muted)' }}>
                    <span>{card.code}</span>
                    <span>{card.rarity}</span>
                  </div>
                  <strong style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', color: 'var(--vault-ink)' }}>
                    {card.name}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '22px', fontWeight: 600, margin: 0 }}>
            Set Completion Trackers
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--vault-ink-secondary)', margin: '2px 0 0' }}>
            Track main set quotas, parallel variations, and master set progress.
          </p>
        </div>
      </div>

      <div className="vault-sets-overview">
        {progressList.map(set => (
          <div key={set.code} className="vault-set-card">
            <div className="vault-set-header">
              <div>
                <span className="vault-set-code">{set.code}</span>
                <h3 className="vault-set-title">{set.name}</h3>
                <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)' }}>
                  Released {set.releaseYear}
                </span>
              </div>
              <span className="vault-set-percent">{set.percentage}%</span>
            </div>

            <div className="vault-set-progress-track">
              <div className="vault-set-progress-bar" style={{ width: `${set.percentage}%` }} />
            </div>

            <div className="vault-set-stats-row">
              <span>Main Set: <b>{set.mainSetOwned} / {set.mainSetTotal}</b></span>
              <span>Parallels: <b>{set.parallelsOwned} / {set.parallelsTotal}</b></span>
            </div>

            <div className="vault-set-actions">
              <button
                type="button"
                className="vault-btn vault-btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setActiveSetCode(set.code)}
              >
                View Set Cards
              </button>
              <button
                type="button"
                className="vault-btn vault-btn-secondary"
                onClick={() => onFindMissingInMarket(set.code)}
                title="Find missing cards on market"
              >
                <Store size={14} />
              </button>
              <button
                type="button"
                className="vault-btn vault-btn-secondary"
                onClick={() => onShareProgress(set)}
                title="Share set progress"
              >
                <Share2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
