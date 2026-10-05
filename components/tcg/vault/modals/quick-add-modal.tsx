'use client';

import React, { useState } from 'react';
import { 
  XIcon as X, 
  MagnifyingGlassIcon as Search, 
  LightningIcon as Zap,
  CheckCircleIcon as CheckCircle
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cards, printings, Card } from '@/packages/card-data/catalog';
import { CardArt } from '../card-art';
import { api } from '@/lib/client';
import { addLocalVaultItem } from '../local-vault';

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  onItemAdded: () => Promise<void> | void;
  isAnonymous?: boolean;
  language?: 'EN' | 'ID';
}

export function QuickAddModal({
  open,
  onClose,
  onItemAdded,
  isAnonymous = false,
  language = 'EN',
}: QuickAddModalProps) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const filteredCards = query.trim().length >= 2
    ? cards.filter(c => `${c.name} ${c.code}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : [];
  const preferredPrinting=(card:Card)=>printings.find(item=>item.cardId===card.id&&item.language==='EN'&&/^(standard|base)$/i.test(item.variant??''))
    ||printings.find(item=>item.cardId===card.id&&item.language==='EN')
    ||printings.find(item=>item.cardId===card.id);

  const handleQuickAdd = async (card: Card) => {
    setBusy(true);
    try {
      const p = preferredPrinting(card);
      if (!p) throw new Error(language==='ID'?'Cetakan kartu ini belum tersedia.':'No catalog printing is available for this card yet.');
      const printingCard={...card,language:p.language,variant:p.variant,setCode:p.set,printingCode:card.printingCode??card.code};
      if (isAnonymous) {
        addLocalVaultItem({
          printingId: p.id,
          card:printingCard,
          type: 'RAW',
          quantity: 1,
          condition: 'NM',
          visibility: 'private',
          acquisitionAmount: 0,
          currency: 'IDR',
          acquiredAt: new Date().toISOString(),
          notes: 'Quick-added 1 Raw NM copy. Details can be updated anytime.',
          provider: null,
          grade: null,
          certification: null,
        });
        toast.success(
          language === 'ID'
            ? `Berhasil menambahkan 1x ${card.name} (Raw NM) ke koleksi lokal`
            : `Added 1x ${card.name} (Raw NM) to local Vault`
        );
        await onItemAdded();
        onClose();
        return;
      }

      await api('/api/collection', {
        printingId: p.id,
        catalogCard: printingCard,
        type: 'RAW',
        quantity: 1,
        condition: 'NM',
        visibility: 'private',
        acquisitionAmount: 0,
        currency: 'IDR',
        acquiredAt: new Date().toISOString(),
        notes: 'Quick-added 1 Raw NM copy. Details can be updated anytime.',
      });
      toast.success(`Added 1x ${card.name} (Raw NM) to Vault`);
      await onItemAdded();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to quick add.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 150,
      background: 'rgba(10, 12, 16, 0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        borderRadius: '16px',
        background: 'var(--vault-panel)',
        border: '1px solid var(--vault-border)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)',
        padding: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={20} weight="fill" color="var(--vault-gold)" />
            <h3 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '20px', fontWeight: 600, margin: 0 }}>
              Quick Add to Vault
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vault-ink-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--vault-ink-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>
          Rapid 1-click card entry. Adds 1 Raw NM copy immediately to your collection so you can keep logging cards without interruption.
        </p>

        {/* Instant Search Bar */}
        <div className="vault-toolbar-search" style={{ marginBottom: '16px' }}>
          <Search size={16} color="var(--vault-ink-muted)" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
              placeholder="Search card name or code (e.g. OP05-119, Zoro)..."
              aria-label="Search card name or code"
          />
        </div>

        {/* Results List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
          {!query.trim().length || query.trim().length<2 ? <p className="vault-quick-add-hint">Search by card name or code. Quick Add uses the catalog’s English default printing and adds one raw NM copy.</p> : filteredCards.length===0 ? <p className="vault-quick-add-hint">No catalog cards matched that search.</p> : filteredCards.map(card => (
            <div
              key={card.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'var(--vault-slot-bg)',
                border: '1px solid var(--vault-border)',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ width: '36px', aspectRatio: '420/580', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                  <CardArt card={card} small />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h4 style={{ margin: 0, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {card.name}
                  </h4>
                  <span style={{ fontSize: '10.5px', color: 'var(--vault-ink-muted)' }}>
                    {card.code} · {card.rarity} · {card.type} · {preferredPrinting(card)?.language??'EN'} {preferredPrinting(card)?.variant??'Standard'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="vault-btn vault-btn-primary"
                style={{ height: '32px', fontSize: '11px', flexShrink: 0 }}
                disabled={busy}
                onClick={() => handleQuickAdd(card)}
              >
                <Zap size={13} weight="fill" />
                Add 1 Raw NM
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
