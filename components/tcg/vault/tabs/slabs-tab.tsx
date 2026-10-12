'use client';

import React from 'react';
import { 
  CheckCircleIcon as CheckCircle, 
  PlusIcon as Plus
} from '@phosphor-icons/react';
import { CardArt } from '../card-art';
import { printings } from '@/packages/card-data/catalog';
import { formatCompactMoney } from '@/packages/domain';
import type { EnrichedCollectionItem } from '../types';
import { VaultPanelEmpty } from '../vault-panel-empty';

interface SlabsTabProps {
  slabs: EnrichedCollectionItem[];
  hideValues: boolean;
  onSelectSlab: (slab: EnrichedCollectionItem) => void;
  onAddNewSlab: () => void;
}

export function SlabsTab({
  slabs,
  hideValues,
  onSelectSlab,
  onAddNewSlab,
}: SlabsTabProps) {
  if (slabs.length === 0) {
    return (
      <VaultPanelEmpty icon={<CheckCircle size={22}/>} title="No graded cards yet" description="Add a slab to keep its grade, certificate, and value details here." action={<button type="button" className="vault-btn vault-btn-primary" onClick={onAddNewSlab}><Plus size={15}/>Add slab</button>}/>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '22px', fontWeight: 600, margin: 0 }}>
            Graded cards
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--vault-ink-secondary)', margin: '2px 0 0' }}>
            {slabs.length} Grades, certificates, and values in one place.
          </p>
        </div>
        <button
          type="button"
          className="vault-btn vault-btn-secondary"
          onClick={onAddNewSlab}
        >
          <Plus size={15} />
          Add slab
        </button>
      </div>

      <div className="vault-slabs-grid">
        {slabs.map(item => {
          const printing = printings.find(p => p.id === item.printingId);
          const lang = item.language || item.card.language || printing?.language || 'EN';
          const subgrades = item.subgrades;
          const isVerified = item.verificationStatus === 'provider_verified' || item.verificationStatus === 'platform_verified';

          return (
            <div
              key={item.id}
              className="vault-slab-card"
              onClick={() => onSelectSlab(item)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') onSelectSlab(item); }}
            >
              {/* Restrained Archival Slab Plate (Not imitating trademark PSA/CGC labels) */}
              <div className="vault-slab-plate">
                <div className="vault-slab-plate-left">
                  <span className="vault-slab-provider">{item.provider || 'PSA'}</span>
                  <span className="vault-slab-grade-num">{item.grade || '10'}</span>
                </div>
                <span className="vault-slab-cert-pill">
                  #{item.certification ? String(item.certification).slice(0, 10) : 'UNVERIFIED'}
                </span>
              </div>

              {/* Slab Card Artwork Stage */}
              <div className="vault-slab-art-stage">
                <CardArt card={item.card} />
              </div>

              {/* Subgrades Row if Available */}
              {subgrades && typeof subgrades === 'object' && Object.keys(subgrades).length > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  marginTop: '8px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  fontSize: '9px',
                  color: '#b0b8c4',
                }}>
                  {Object.entries(subgrades).slice(0, 4).map(([key, val]) => (
                    <span key={key}>
                      <b style={{ color: '#e2a63b' }}>{key[0]}:</b> {String(val)}
                    </span>
                  ))}
                </div>
              )}

              {/* Slab Footer Details */}
              <div className="vault-slab-footer">
                <h4 className="vault-slab-title">{item.card.name}</h4>
                <div className="vault-slab-subtitle">
                  {item.card.code} · {lang} · {printing?.variant || 'Standard'}
                </div>

                <div className="vault-slab-value-row">
                  <div>
                    <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8c95a2', display: 'block' }}>
                      Est. Value
                    </span>
                    <strong className="vault-slab-est-value">
                      {hideValues ? '••••••••' : item.hasMarketEstimate ? formatCompactMoney(item.estimatedValue, 'IDR') : '-'}
                    </strong>
                  </div>

                  {isVerified ? (
                    <span className="vault-slab-verified-tag" title="Verified against database registry">
                      <CheckCircle size={13} weight="fill" />
                      Verified
                    </span>
                  ) : (
                    <span style={{ fontSize: '9.5px', color: '#9ba4b2' }}>
                      User Entered
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
