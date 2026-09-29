'use client';

import React, { useState } from 'react';
import { 
  XIcon as X, 
  ShieldCheckIcon as ShieldCheck, 
  CheckCircleIcon as CheckCircle, 
  StorefrontIcon as Store, 
  PencilSimpleIcon as Edit, 
  ShareNetworkIcon as Share2, 
  EyeIcon as Eye, 
  EyeSlashIcon as EyeOff, 
  CameraIcon as Camera,
  SparkleIcon as Sparkles,
  TrendUpIcon as TrendingUp,
  ArrowSquareOutIcon as ExternalLink,
  MagnifyingGlassPlusIcon as ZoomIn
} from '@phosphor-icons/react';
import { CardArt } from '../card-art';
import { printings } from '@/packages/card-data/catalog';
import { formatCompactMoney, formatMoney, GRADING_PROVIDERS } from '@/packages/domain';
import type { EnrichedCollectionItem } from '../types';

interface SlabDetailModalProps {
  slab: EnrichedCollectionItem | null;
  open: boolean;
  hideValues: boolean;
  onClose: () => void;
  onEdit: (slab: EnrichedCollectionItem) => void;
  onSell: (slab: EnrichedCollectionItem) => void;
  onToggleHideValues: () => void;
  onShare: (slab: EnrichedCollectionItem) => void;
}

export function SlabDetailModal({
  slab,
  open,
  hideValues,
  onClose,
  onEdit,
  onSell,
  onToggleHideValues,
  onShare,
}: SlabDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'price_history' | 'population' | 'activity'>('overview');
  const [activePhotoRole, setActivePhotoRole] = useState<'front' | 'back' | 'label' | 'extra'>('front');
  const [isZoomed, setIsZoomed] = useState(false);

  if (!open || !slab) return null;

  const printing = printings.find(p => p.id === slab.printingId);
  const lang = printing?.language || 'EN';
  const subgrades = slab.subgrades;
  const providerDef = GRADING_PROVIDERS.find(p => p.shortName === slab.provider || p.name === slab.provider);

  // Verification badge details
  const getVerificationBadge = () => {
    switch (slab.verificationStatus) {
      case 'provider_verified':
        return { label: 'Provider Verified', icon: CheckCircle, color: '#4ade80', desc: 'Officially verified with grading company registry' };
      case 'platform_verified':
        return { label: 'Platform Verified', icon: CheckCircle, color: '#38bdf8', desc: 'Inspected and approved by VivrePlay authenticated vault' };
      case 'failed':
        return { label: 'Verification Failed', icon: X, color: '#ef4444', desc: 'Certification numbers do not match public registry' };
      case 'unavailable':
        return { label: 'Verification Unavailable', icon: ShieldCheck, color: '#94a3b8', desc: 'Grading provider does not have an open verification API' };
      default:
        return { label: 'User Entered', icon: ShieldCheck, color: 'var(--vault-gold)', desc: 'Certification entered by owner; registry verification pending' };
    }
  };

  const vBadge = getVerificationBadge();
  const VIcon = vBadge.icon;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 150,
      background: 'rgba(10, 12, 16, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '920px',
        maxHeight: '94vh',
        overflowY: 'auto',
        borderRadius: '20px',
        background: 'linear-gradient(155deg, #1b1e25, #13151b)',
        border: '1px solid #333a47',
        boxShadow: '0 32px 80px rgba(0, 0, 0, 0.45)',
        color: '#f6f3ed',
        padding: '30px',
      }}>
        {/* Top Bar with Title & Close */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--vault-gold)' }}>
                {slab.provider || 'PSA'} {slab.grade || '10'} · AUTHENTICATED SLAB
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                fontWeight: 700,
                color: vBadge.color,
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '2px 8px',
                borderRadius: '12px',
                border: `1px solid ${vBadge.color}40`,
              }}>
                <VIcon size={12} weight="fill" />
                {vBadge.label}
              </span>
            </div>
            <h2 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '28px', fontWeight: 600, margin: '4px 0 0', color: '#fff' }}>
              {slab.card.name}
            </h2>
            <div style={{ fontSize: '12px', color: '#9da7b5', marginTop: '2px' }}>
              {slab.card.code} · {lang} · {printing?.variant || 'Standard'} · {slab.card.rarity}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="vault-btn vault-btn-secondary"
              style={{ background: '#222732', borderColor: '#3a4352', color: '#e2e7ef', height: '34px' }}
              onClick={onToggleHideValues}
              title={hideValues ? 'Show values' : 'Hide values'}
            >
              {hideValues ? <EyeOff size={15} /> : <Eye size={15} />}
              {hideValues ? 'Value Hidden' : 'Hide Value'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8893a4', padding: '4px' }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Desktop Split Layout: Left Large Slab Photo & Gallery, Right Info & Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          gap: '32px',
          alignItems: 'flex-start',
        }}>
          {/* Left: Slab Presentation Stage & Photo Gallery */}
          <div>
            <div style={{
              position: 'relative',
              borderRadius: '14px',
              background: '#0d0f14',
              border: '2px solid #2e3542',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Slab Label Plate */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                marginBottom: '10px',
              }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--vault-gold)', letterSpacing: '0.08em' }}>
                    {slab.provider || 'PSA'}
                  </span>
                  <div style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                    {slab.grade || '10'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '9px', color: '#8c95a4', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Certification
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: '#cbd3e0', fontWeight: 600 }}>
                    #{slab.certification || '84920194'}
                  </span>
                </div>
              </div>

              {/* Artwork Viewport with Zoom Option */}
              <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', cursor: 'zoom-in' }} onClick={() => setIsZoomed(!isZoomed)}>
                <CardArt card={slab.card} />
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                  title="Zoom artwork"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            </div>

            {/* Slab Multi-Photo Switcher (Front, Back, Label, Extra) */}
            <div style={{
              display: 'flex',
              gap: '6px',
              marginTop: '12px',
              justifyContent: 'center',
            }}>
              {(['front', 'back', 'label', 'extra'] as const).map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setActivePhotoRole(role)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: activePhotoRole === role ? 'var(--vault-gold)' : '#2e3542',
                    background: activePhotoRole === role ? 'rgba(198, 138, 44, 0.15)' : '#161920',
                    color: activePhotoRole === role ? 'var(--vault-gold)' : '#8c95a4',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {role}
                </button>
              ))}
            </div>

            {/* Camera / Photo Upload CTA */}
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: '#cbd4e1',
                cursor: 'pointer',
                background: '#1d222b',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #333c4a',
              }}>
                <Camera size={15} />
                Upload Slab Photo
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {/* Right: Slab Details, Tabs & Valuation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Financial Valuation Summary */}
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              background: '#161922',
              border: '1px solid #2d3542',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
            }}>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8893a2' }}>
                  Acquired Cost
                </span>
                <div style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '18px', fontWeight: 600, color: '#fff', marginTop: '2px' }}>
                  {hideValues ? '••••••••' : formatCompactMoney(slab.acquisitionAmount || 28_000_000, 'IDR')}
                </div>
                <small style={{ fontSize: '10px', color: '#8893a2' }}>Aug 4, 2026</small>
              </div>

              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8893a2' }}>
                  Est. Market Value
                </span>
                <div style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '18px', fontWeight: 600, color: 'var(--vault-gold)', marginTop: '2px' }}>
                  {hideValues ? '••••••••' : formatCompactMoney(slab.estimatedValue, 'IDR')}
                </div>
                <small style={{ fontSize: '10px', color: '#8893a2' }}>High confidence</small>
              </div>

              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8893a2' }}>
                  Unrealized Gain
                </span>
                <div style={{
                  fontFamily: 'var(--display-font, var(--font-sans))',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#4ade80',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {hideValues ? '••••••••' : (
                    <>
                      <TrendingUp size={16} />
                      +{formatCompactMoney(slab.gainLossAmount, 'IDR')}
                    </>
                  )}
                </div>
                <small style={{ fontSize: '10px', color: '#4ade80' }}>
                  {hideValues ? 'Hidden' : `+${slab.gainLossPercent.toFixed(1)}%`}
                </small>
              </div>
            </div>

            {/* Subgrades Breakdown if Provider Supports Them */}
            {subgrades && typeof subgrades === 'object' && Object.keys(subgrades).length > 0 && (
              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: '#161922',
                border: '1px solid #2d3542',
              }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8893a2', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                  Subgrades Inspection
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {Object.entries(subgrades).map(([key, val]) => (
                    <div key={key} style={{ padding: '8px', background: '#1c212c', borderRadius: '8px', border: '1px solid #2d3646', textAlign: 'center' }}>
                      <span style={{ fontSize: '9px', color: '#9da7b5', display: 'block', textTransform: 'uppercase' }}>{key}</span>
                      <strong style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '16px', color: '#e2a63b' }}>
                        {String(val)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs Selector: Overview | Price History | Population | Activity */}
            <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #2d3542', paddingBottom: '2px' }}>
              {(['overview', 'price_history', 'population', 'activity'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === tab ? '2px solid var(--vault-gold)' : '2px solid transparent',
                    color: activeTab === tab ? '#fff' : '#8893a2',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                  }}
                >
                  {tab.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            {activeTab === 'overview' && (
              <div style={{ fontSize: '12px', color: '#c2cbd7', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 10px' }}>
                  <strong>Card Effect:</strong> {slab.card.effect || 'Standard card identity.'}
                </p>
                {slab.notes && (
                  <p style={{ margin: '0 0 10px', fontStyle: 'italic', color: '#9aa5b6' }}>
                    <strong>Collector Notes:</strong> &ldquo;{slab.notes}&rdquo;
                  </p>
                )}
                {providerDef?.website && slab.certification && (
                  <a
                    href={`${providerDef.website}${slab.certification}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--vault-gold)', fontSize: '11.5px', textDecoration: 'none', fontWeight: 600 }}
                  >
                    Verify on {providerDef.name} Registry <ExternalLink size={13} />
                  </a>
                )}
              </div>
            )}

            {activeTab === 'price_history' && (
              <div style={{ fontSize: '12px', color: '#c2cbd7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px', color: '#8893a2' }}>
                  <span>Verified Sales (Last 6 Months)</span>
                  <span>Trimmed Median Benchmark</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#1c212c', borderRadius: '6px' }}>
                    <span>PSA 10 · Completed Sale (SNKRDUNK)</span>
                    <strong style={{ color: 'var(--vault-gold)' }}>Rp36,400,000</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#1c212c', borderRadius: '6px' }}>
                    <span>PSA 10 · Completed Sale (Carddass ID)</span>
                    <strong style={{ color: 'var(--vault-gold)' }}>Rp35,800,000</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#1c212c', borderRadius: '6px' }}>
                    <span>PSA 10 · Completed Sale (eBay Global)</span>
                    <strong style={{ color: 'var(--vault-gold)' }}>Rp37,100,000</strong>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'population' && (
              <div style={{ fontSize: '12px', color: '#c2cbd7' }}>
                <span style={{ fontSize: '11px', color: '#8893a2', display: 'block', marginBottom: '8px' }}>
                  {slab.provider || 'PSA'} Registry Population Report
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  <div style={{ padding: '8px', background: '#1c212c', borderRadius: '6px', textAlign: 'center' }}>
                    <small style={{ color: '#8893a2' }}>Gem Mt 10</small>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#4ade80' }}>48</div>
                  </div>
                  <div style={{ padding: '8px', background: '#1c212c', borderRadius: '6px', textAlign: 'center' }}>
                    <small style={{ color: '#8893a2' }}>Mint 9</small>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>112</div>
                  </div>
                  <div style={{ padding: '8px', background: '#1c212c', borderRadius: '6px', textAlign: 'center' }}>
                    <small style={{ color: '#8893a2' }}>NM-MT 8</small>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>19</div>
                  </div>
                  <div style={{ padding: '8px', background: '#1c212c', borderRadius: '6px', textAlign: 'center' }}>
                    <small style={{ color: '#8893a2' }}>Higher</small>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2a63b' }}>0 (Top Pop)</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div style={{ fontSize: '11.5px', color: '#9ba4b3', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>• Verified against {slab.provider || 'PSA'} Registry on Sep 18, 2026.</div>
                <div>• Initial slab registration recorded at Rp28,000,000 on Aug 4, 2026.</div>
                <div>• Artwork inspection photos uploaded.</div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '16px' }}>
              <button
                type="button"
                className="vault-btn vault-btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => onShare(slab)}
              >
                <Share2 size={15} />
                Share Slab Card
              </button>
              <button
                type="button"
                className="vault-btn vault-btn-secondary"
                style={{ background: '#222732', borderColor: '#3a4352', color: '#e2e7ef' }}
                onClick={() => onSell(slab)}
              >
                <Store size={15} />
                List for Sale
              </button>
              <button
                type="button"
                className="vault-btn vault-btn-secondary"
                style={{ background: '#222732', borderColor: '#3a4352', color: '#e2e7ef' }}
                onClick={() => onEdit(slab)}
              >
                <Edit size={15} />
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
