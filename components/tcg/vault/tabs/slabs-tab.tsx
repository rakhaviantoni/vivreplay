'use client';

import React from 'react';
import { CheckCircleIcon as CheckCircle, PlusIcon as Plus } from '@phosphor-icons/react';
import { CardArt } from '../card-art';
import { printings } from '@/packages/card-data/catalog';
import { formatCompactMoney } from '@/packages/domain';
import type { EnrichedCollectionItem } from '../types';
import { VaultPanelEmpty } from '../vault-panel-empty';
import { VaultSlotMetaIdentity } from '../views/vault-slot-meta-identity';
import { VaultSlotSlabPlate } from '../views/vault-slot-slab-plate';

interface SlabsTabProps {
  slabs: EnrichedCollectionItem[];
  hideValues: boolean;
  onSelectSlab: (slab: EnrichedCollectionItem) => void;
  onAddNewSlab: () => void;
}

export function SlabsTab({ slabs, hideValues, onSelectSlab, onAddNewSlab }: SlabsTabProps) {
  if (slabs.length === 0) {
    return <VaultPanelEmpty icon={<CheckCircle size={22}/>} title="No graded cards yet" description="Add a slab to keep its grade, certificate, and value details here." action={<button type="button" className="vault-btn vault-btn-primary" onClick={onAddNewSlab}><Plus size={15}/>Add slab</button>}/>;
  }

  return <section className="vault-slabs-section">
    <header className="vault-slabs-heading">
      <div>
        <h2>Graded cards</h2>
        <p>{slabs.length} {slabs.length === 1 ? 'slab' : 'slabs'}</p>
      </div>
      <button type="button" className="vault-btn vault-btn-secondary" onClick={onAddNewSlab}><Plus size={15}/>Add slab</button>
    </header>

    <div className="vault-slabs-grid">
      {slabs.map(item => {
        const printing = printings.find(candidate => candidate.id === item.printingId);
        const label = [item.language ?? item.card.language ?? printing?.language, printing?.variant].filter(Boolean).join(' ');
        const isVerified = item.verificationStatus === 'provider_verified' || item.verificationStatus === 'platform_verified';

        return <article
          key={item.id}
          className="vault-slot is-slab vault-slab-tab-card"
          onClick={() => onSelectSlab(item)}
          role="button"
          tabIndex={0}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectSlab(item); } }}
        >
          <VaultSlotSlabPlate item={item}/>
          <div className={`vault-slot-card-stage${item.card.gameSlug === 'pokemon' ? ' is-pokemon' : ''}`}>
            <CardArt card={item.card}/>
          </div>
          <div className="vault-slot-info vault-slab-tab-info">
            <div className="vault-slot-heading-row">
              <h3 className="vault-slot-name">{item.card.name}</h3>
            </div>
            <div className="vault-slot-meta-row">
              <VaultSlotMetaIdentity item={item} printingLabel={label}/>
            </div>
            <div className="vault-slab-tab-value">
              {!hideValues && <span>{item.hasMarketEstimate ? formatCompactMoney(item.estimatedValue, 'IDR') : 'No estimate'}</span>}
              <span className={isVerified ? 'is-verified' : ''}>{isVerified ? 'Verified' : 'Entered by you'}</span>
            </div>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
