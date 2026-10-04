'use client';

import React, { useState } from 'react';
import { 
  XIcon as X, 
  CopyIcon as Copy, 
  CheckIcon as Check, 
  ShareNetworkIcon as Share2
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { CardArt } from '../card-art';
import { VivreMark } from '../../brand-assets';
import { formatCompactMoney } from '@/packages/domain';
import type { EnrichedCollectionItem, SetProgress } from '../types';

interface ShareVaultModalProps {
  open: boolean;
  onClose: () => void;
  username: string;
  items: EnrichedCollectionItem[];
  hideValues: boolean;
  selectedSlab?: EnrichedCollectionItem | null;
  selectedSet?: SetProgress | null;
}

export function ShareVaultModal({
  open,
  onClose,
  username,
  items,
  hideValues,
  selectedSlab,
  selectedSet,
}: ShareVaultModalProps) {
  const [shareFormat, setShareFormat] = useState<'top9' | 'slab' | 'set'>(
    selectedSlab ? 'slab' : selectedSet ? 'set' : 'top9'
  );
  const [shareStyle,setShareStyle]=useState<'light'|'dark'>('light');
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  // The Vault supplies binder order; preserve it in the share showcase.
  const displayTop9 = items.slice(0, 9);

  const activeSlab = selectedSlab || items.find(i => i.type === 'GRADED') || items[0];

  const shareOrigin = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname) ? window.location.origin : 'https://vivreplay.com';
  const shareUrl = `${shareOrigin}/players/${username}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Collection showcase link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy link failed');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 160,
      background: 'rgba(10, 12, 16, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        maxHeight: '92vh',
        overflowY: 'auto',
        borderRadius: '18px',
        background: 'var(--vault-panel)',
        border: '1px solid var(--vault-border)',
        boxShadow: '0 28px 70px rgba(0, 0, 0, 0.35)',
        padding: '26px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--vault-gold)', textTransform: 'uppercase' }}>
              Collector Pride & Social Share
            </span>
            <h3 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '22px', fontWeight: 600, margin: '2px 0 0' }}>
              Share Your Collection
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vault-ink-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Share Format Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '18px' }}>
          <button
            type="button"
            className={`vault-btn ${shareFormat === 'top9' ? 'vault-btn-primary' : 'vault-btn-secondary'}`}
            style={{ height: '34px', fontSize: '11.5px', justifyContent: 'center' }}
            onClick={() => setShareFormat('top9')}
          >
            My Top 9
          </button>
          <button
            type="button"
            className={`vault-btn ${shareFormat === 'slab' ? 'vault-btn-primary' : 'vault-btn-secondary'}`}
            style={{ height: '34px', fontSize: '11.5px', justifyContent: 'center' }}
            onClick={() => setShareFormat('slab')}
          >
            Slab Showcase
          </button>
          <button
            type="button"
            className={`vault-btn ${shareFormat === 'set' ? 'vault-btn-primary' : 'vault-btn-secondary'}`}
            style={{ height: '34px', fontSize: '11.5px', justifyContent: 'center' }}
            onClick={() => setShareFormat('set')}
          >
            Set Progress
          </button>
        </div>

        <div className="vault-share-style-picker" role="group" aria-label="Share card style">
          <span>Style</span>
          <button type="button" aria-pressed={shareStyle==='light'} className={shareStyle==='light'?'is-selected':''} onClick={()=>setShareStyle('light')}>Light</button>
          <button type="button" aria-pressed={shareStyle==='dark'} className={shareStyle==='dark'?'is-selected':''} onClick={()=>setShareStyle('dark')}>Dark</button>
        </div>

        {/* Share Card Canvas Preview */}
        <div className={`vault-share-preview is-${shareStyle}`}>
          {/* Card Header Branding */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <VivreMark size={20} label="VivrePlay" />
              <strong style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '15px', color: 'var(--share-ink)' }}>
                VivrePlay
              </strong>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--share-muted)' }}>@{username}&apos;s Vault</span>
          </div>

          {/* Format 1: My Top 9 Binder Card */}
          {shareFormat === 'top9' && (
            <div>
              <div className="vault-share-card-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '8px',
                padding: '8px',
              }}>
                {displayTop9.map(item => (
                  <div key={item.id} className="vault-share-card-slot">
                    <CardArt card={item.card} small />
                    {item.type === 'GRADED' && (
                      <span style={{
                        position: 'absolute',
                        bottom: '2px',
                        left: '2px',
                        background: 'rgba(0,0,0,0.85)',
                        color: 'var(--share-accent)',
                        fontSize: '7.5px',
                        fontWeight: 800,
                        padding: '1px 3px',
                        borderRadius: '3px',
                      }}>
                        {item.provider} {item.grade}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: 'var(--share-muted)' }}>
                <span>Curated Top 9 Cards</span>
                <span>{items.length} cards catalogued</span>
              </div>
            </div>
          )}

          {/* Format 2: Slab Showcase Card */}
          {shareFormat === 'slab' && activeSlab && (
            <div style={{ textAlign: 'center' }}>
              <div className="vault-share-slab-art" style={{
                maxWidth: '200px',
                margin: '0 auto',
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'var(--share-frame)',
                border: '2px solid var(--share-border)',
                padding: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  background: 'var(--share-frame-raised)',
                  borderRadius: '6px',
                  fontSize: '9px',
                  fontWeight: 800,
                  marginBottom: '6px',
                  color: 'var(--share-accent)',
                }}>
                  <span>{activeSlab.provider || 'PSA'}</span>
                  <span>{activeSlab.grade || '10'}</span>
                </div>
                <CardArt card={activeSlab.card} />
              </div>
              <h4 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '16px', margin: '10px 0 2px' }}>
                {activeSlab.card.name}
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--share-muted)', margin: 0 }}>
                {activeSlab.card.code} · {activeSlab.provider || 'PSA'} {activeSlab.grade || '10'}
                {!hideValues && activeSlab.hasMarketEstimate && ` · Est. ${formatCompactMoney(activeSlab.estimatedValue, 'IDR')}`}
              </p>
            </div>
          )}

          {/* Format 3: Set Progress Card */}
          {shareFormat === 'set' && (
            <div style={{ padding: '10px 0' }}>
              <h4 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '18px', margin: '0 0 4px' }}>
                {selectedSet ? selectedSet.name : 'OP-09 Emperors in the New World'}
              </h4>
              <div style={{ fontSize: '12px', color: 'var(--share-muted)', marginBottom: '14px' }}>
                Set Collection Progress: <b>{selectedSet ? selectedSet.ownedCount : 123} / {selectedSet ? selectedSet.totalCards : 142} Cards ({selectedSet ? selectedSet.percentage : 86.6}%)</b>
              </div>
              <div className="vault-set-progress-track">
                <div className="vault-set-progress-bar" style={{ width: `${selectedSet ? selectedSet.percentage : 86.6}%` }} />
              </div>
            </div>
          )}

          {/* Watermark */}
          <div style={{ textAlign: 'right', marginTop: '12px', fontSize: '9.5px', color: 'var(--share-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            vivreplay.com/vault
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
          <button
            type="button"
            className="vault-btn vault-btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleCopyLink}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Link Copied!' : 'Copy Share Link'}
          </button>
          {typeof navigator !== 'undefined' && !!navigator.share && (
            <button
              type="button"
              className="vault-btn vault-btn-secondary"
              onClick={async () => {
                try {
                  await navigator.share({
                    title: `@${username}'s VivrePlay Vault`,
                    text: `Check out my One Piece card collection on VivrePlay Vault!`,
                    url: shareUrl,
                  });
                } catch {}
              }}
            >
              <Share2 size={16} />
              Share
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
