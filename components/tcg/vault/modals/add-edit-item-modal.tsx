'use client';

import React, { useState } from 'react';
import { 
  XIcon as X, 
  ShieldCheckIcon as ShieldCheck, 
  SparkleIcon as Sparkles,
  CameraIcon as Camera
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cards, printings, Card } from '@/packages/card-data/catalog';
import { GRADING_PROVIDERS } from '@/packages/domain';
import { CardArt } from '../card-art';
import { api } from '@/lib/client';
import type { EnrichedCollectionItem } from '../types';

interface AddEditItemModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  editingItem?: EnrichedCollectionItem | null;
  initialCard?: Card;
}

export function AddEditItemModal({
  open,
  onClose,
  onSaved,
  editingItem,
  initialCard,
}: AddEditItemModalProps) {
  const isEditing = Boolean(editingItem);

  const [selectedCardCode, setSelectedCardCode] = useState<string>(
    editingItem ? editingItem.card.code : (initialCard ? initialCard.code : 'OP05-119')
  );
  const [itemType, setItemType] = useState<'RAW' | 'GRADED'>(
    editingItem ? editingItem.type : 'RAW'
  );
  const [language, setLanguage] = useState<'EN' | 'JP'>('JP');
  const [condition, setCondition] = useState(editingItem?.condition || 'NM');
  const [quantity, setQuantity] = useState(editingItem ? editingItem.quantity : 1);
  const [provider, setProvider] = useState(editingItem?.provider || 'PSA');
  const [grade, setGrade] = useState(editingItem?.grade || '10');
  const [certification, setCertification] = useState(editingItem?.certification || '');
  const [acquisitionCost, setAcquisitionCost] = useState(editingItem ? String(editingItem.acquisitionAmount || '') : '');
  const [acquiredDate, setAcquiredDate] = useState(editingItem?.acquiredAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [visibility, setVisibility] = useState<'private' | 'public' | 'marketplace-only'>(editingItem?.visibility || 'private');
  const [notes, setNotes] = useState(editingItem?.notes || '');
  
  // Subgrades state
  const existingSub = editingItem?.subgrades || {};
  const [centering, setCentering] = useState(String(existingSub.Centering || '10'));
  const [corners, setCorners] = useState(String(existingSub.Corners || '9.5'));
  const [edges, setEdges] = useState(String(existingSub.Edges || '10'));
  const [surface, setSurface] = useState(String(existingSub.Surface || '9.5'));

  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const currentCard = cards.find(c => c.code === selectedCardCode) || cards[0];
  const targetPrinting = printings.find(p => p.cardId === currentCard.id && p.language === language) || printings.find(p => p.cardId === currentCard.id) || printings[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      const subgradesObj = itemType === 'GRADED' ? {
        Centering: parseFloat(centering) || 10,
        Corners: parseFloat(corners) || 9.5,
        Edges: parseFloat(edges) || 10,
        Surface: parseFloat(surface) || 9.5,
      } : undefined;

      const payload = {
        id: editingItem?.id,
        printingId: targetPrinting.id,
        catalogCard: currentCard,
        type: itemType,
        quantity: itemType === 'GRADED' ? 1 : Number(quantity),
        condition: itemType === 'GRADED' ? 'NM' : condition,
        provider: itemType === 'GRADED' ? provider : null,
        grade: itemType === 'GRADED' ? grade : null,
        certification: itemType === 'GRADED' ? (certification.trim() || 'CERT-' + Math.floor(Math.random() * 899999 + 100000)) : null,
        visibility,
        acquisitionAmount: Math.round(Number(acquisitionCost || 0)),
        currency: 'IDR',
        acquiredAt: acquiredDate ? new Date(acquiredDate).toISOString() : new Date().toISOString(),
        notes,
        subgrades: subgradesObj,
      };

      if (isEditing) {
        await api('/api/collection', payload, 'PATCH');
        toast.success(`Updated ${currentCard.name} in your Vault`);
      } else {
        await api('/api/collection', payload, 'POST');
        toast.success(`Added ${currentCard.name} (${itemType === 'GRADED' ? `${provider} ${grade}` : `${quantity}x ${condition}`}) to Vault`);
      }

      await onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save to Vault.');
    } finally {
      setBusy(false);
    }
  };

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
        maxWidth: '680px',
        maxHeight: '92vh',
        overflowY: 'auto',
        borderRadius: '18px',
        background: 'var(--vault-panel)',
        border: '1px solid var(--vault-border)',
        boxShadow: '0 28px 70px rgba(0, 0, 0, 0.3)',
        padding: '28px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--vault-gold)', textTransform: 'uppercase' }}>
              {isEditing ? 'Curate Archive Item' : 'New Collection Record'}
            </span>
            <h2 style={{ fontFamily: 'var(--display-font, Georgia, serif)', fontSize: '24px', fontWeight: 600, margin: '2px 0 0' }}>
              {isEditing ? `Edit ${editingItem?.card.name}` : 'Add Card to Your Vault'}
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Top Card Preview & Selection */}
          <div style={{
            display: 'flex',
            gap: '16px',
            padding: '14px',
            borderRadius: '12px',
            background: 'var(--vault-slot-bg)',
            border: '1px solid var(--vault-border)',
            alignItems: 'center',
          }}>
            <div style={{ width: '64px', aspectRatio: '420/580', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
              <CardArt card={currentCard} small />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                Select Card Identity:
              </label>
              <select
                className="vault-select-compact"
                style={{ width: '100%', height: '38px', fontSize: '12.5px' }}
                value={selectedCardCode}
                onChange={e => setSelectedCardCode(e.target.value)}
                disabled={isEditing}
              >
                {cards.map(c => (
                  <option key={c.id} value={c.code}>
                    {c.code} · {c.name} ({c.rarity})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Format Selector: Raw Card vs Graded Slab */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '6px' }}>
              Format & Grading Type:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`vault-btn ${itemType === 'RAW' ? 'vault-btn-primary' : 'vault-btn-secondary'}`}
                style={{ justifyContent: 'center', height: '40px' }}
                onClick={() => setItemType('RAW')}
              >
                Raw Card
              </button>
              <button
                type="button"
                className={`vault-btn ${itemType === 'GRADED' ? 'vault-btn-primary' : 'vault-btn-secondary'}`}
                style={{ justifyContent: 'center', height: '40px' }}
                onClick={() => setItemType('GRADED')}
              >
                <ShieldCheck size={16} />
                Graded Slab
              </button>
            </div>
          </div>

          {/* Language & Variant */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                Language:
              </label>
              <select
                className="vault-select-compact"
                style={{ width: '100%' }}
                value={language}
                onChange={e => setLanguage(e.target.value as any)}
              >
                <option value="JP">Japanese (JP)</option>
                <option value="EN">English (EN)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                Printing Variant:
              </label>
              <input
                type="text"
                readOnly
                value={targetPrinting.variant || 'Standard'}
                className="vault-select-compact"
                style={{ width: '100%', background: 'var(--vault-slot-bg)', color: 'var(--vault-ink-muted)' }}
              />
            </div>
          </div>

          {/* Conditional Fields based on RAW vs GRADED */}
          {itemType === 'RAW' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                  Condition:
                </label>
                <select
                  className="vault-select-compact"
                  style={{ width: '100%' }}
                  value={condition}
                  onChange={e => setCondition(e.target.value)}
                >
                  <option value="NM">Near Mint (NM)</option>
                  <option value="LP">Lightly Played (LP)</option>
                  <option value="MP">Moderately Played (MP)</option>
                  <option value="HP">Heavily Played (HP)</option>
                  <option value="DMG">Damaged (DMG)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                  Quantity:
                </label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  className="vault-select-compact"
                  style={{ width: '100%' }}
                  value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  required
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                    Grading Provider:
                  </label>
                  <select
                    className="vault-select-compact"
                    style={{ width: '100%' }}
                    value={provider}
                    onChange={e => setProvider(e.target.value)}
                  >
                    {GRADING_PROVIDERS.map(p => (
                      <option key={p.id} value={p.shortName}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                    Grade:
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    placeholder="10, 9.5, Pristine 10..."
                    className="vault-select-compact"
                    style={{ width: '100%' }}
                    value={grade}
                    onChange={e => setGrade(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                  Certification Number:
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="e.g. 84920194"
                  className="vault-select-compact"
                  style={{ width: '100%' }}
                  value={certification}
                  onChange={e => setCertification(e.target.value)}
                />
              </div>

              {/* Subgrades row */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                  Subgrades (Optional):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>Centering</span>
                    <input
                      type="text"
                      className="vault-select-compact"
                      style={{ width: '100%' }}
                      value={centering}
                      onChange={e => setCentering(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>Corners</span>
                    <input
                      type="text"
                      className="vault-select-compact"
                      style={{ width: '100%' }}
                      value={corners}
                      onChange={e => setCorners(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>Edges</span>
                    <input
                      type="text"
                      className="vault-select-compact"
                      style={{ width: '100%' }}
                      value={edges}
                      onChange={e => setEdges(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>Surface</span>
                    <input
                      type="text"
                      className="vault-select-compact"
                      style={{ width: '100%' }}
                      value={surface}
                      onChange={e => setSurface(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Acquisition Cost & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                Acquisition Cost (IDR):
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 28000000"
                className="vault-select-compact"
                style={{ width: '100%' }}
                value={acquisitionCost}
                onChange={e => setAcquisitionCost(e.target.value)}
              />
              <span style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>
                Acquisition costs remain strictly private.
              </span>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                Acquisition Date:
              </label>
              <input
                type="date"
                className="vault-select-compact"
                style={{ width: '100%' }}
                value={acquiredDate}
                onChange={e => setAcquiredDate(e.target.value)}
              />
            </div>
          </div>

          {/* Visibility & Notes */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
              Item Visibility:
            </label>
            <select
              className="vault-select-compact"
              style={{ width: '100%' }}
              value={visibility}
              onChange={e => setVisibility(e.target.value as any)}
            >
              <option value="private">Private (Only you can see this item)</option>
              <option value="public">Public (Visible on your profile & showcase)</option>
              <option value="marketplace-only">Marketplace Only (Visible when listed for sale)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
              Collector Notes:
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              placeholder="Provenance, event pull, centering notes, or trade story..."
              className="vault-select-compact"
              style={{ width: '100%', height: 'auto', padding: '8px 10px', resize: 'vertical' }}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Submit Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              className="vault-btn vault-btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="vault-btn vault-btn-primary"
              disabled={busy}
            >
              {busy ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add to Vault')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
