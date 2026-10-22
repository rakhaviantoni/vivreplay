'use client';

import React from 'react';
import { StarIcon as Star } from '@phosphor-icons/react';
import { printings } from '@/packages/card-data/catalog';
import { formatCompactMoney } from '@/packages/domain';
import type { EnrichedCollectionItem } from '../types';
import { CardStackControls } from './card-stack-controls';
import { VaultStackArt } from './vault-stack-art';
import { groupVaultStacks } from '../vault-utils';
import {VaultSlotSlabPlate} from './vault-slot-slab-plate';
import {VaultSlotMetaIdentity} from './vault-slot-meta-identity';

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
      alignItems: 'start',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '20px 15px',
      padding: '10px 0'
    }}>
      {groupVaultStacks(items).map(stack => {
        const item=stack.item;
        const printing = printings.find(p => p.id === item.printingId);
        const lang = stack.languageLabel || item.language || item.card.language || printing?.language || 'EN';
        const isGraded = item.type === 'GRADED';
        const isOnePiece = item.card.gameSlug === 'one-piece';
        const isFavorite=stack.items.some(copy=>copy.isFavorite);

        return (
          <div
            key={item.id}
            className={`vault-slot${isGraded?' is-slab':''}`}
            onClick={() => onSelectItem(item)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') onSelectItem(item); }}
          >
            {isGraded&&<VaultSlotSlabPlate item={item}/>}
            <div className={`vault-slot-card-stage${item.card.gameSlug==='pokemon'?' is-pokemon':''}`}>
              <VaultStackArt items={stack.items} quantity={stack.quantity}/>

              <div className="vault-slot-badges-top">
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {!isGraded&&<span className="vault-badge-qty">x{stack.quantity}</span>}
                  {!isGraded&&<span className="vault-badge-lang">{lang}</span>}
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
                {!isGraded&&(
                    <span className="vault-raw-pill">
                    {stack.conditionLabel}
                  </span>
                )}
              </div>
            </div>

              {!isGraded&&<div className={`vault-slot-info${isOnePiece?' is-one-piece':''}`}>
                <div className="vault-slot-heading-row">
                  <h4 className="vault-slot-name">{item.card.name}</h4>
                  {isOnePiece&&<div className="vault-slot-meta-row">
                    <VaultSlotMetaIdentity item={item} printingLabel={stack.printingLabel}/>
                    {!hideValues && stack.item.hasMarketEstimate && <span className="vault-slot-value">{formatCompactMoney(stack.estimatedValue, 'IDR')}</span>}
                  </div>}
                  {!isOnePiece&&<CardStackControls item={item} stackItems={stack.items} quantity={stack.quantity} isAnonymous={isAnonymous} onSaved={onSaved} />}
                </div>
                {isOnePiece&&<CardStackControls item={item} stackItems={stack.items} quantity={stack.quantity} isAnonymous={isAnonymous} onSaved={onSaved} />}
                {!isOnePiece&&<div className="vault-slot-meta-row">
                  <VaultSlotMetaIdentity item={item} printingLabel={stack.printingLabel}/>
                  {!hideValues && stack.item.hasMarketEstimate && (
                    <span className="vault-slot-value">
                      {formatCompactMoney(stack.estimatedValue, 'IDR')}
                    </span>
                  )}
                </div>}
              </div>}
          </div>
        );
      })}
    </div>
  );
}
