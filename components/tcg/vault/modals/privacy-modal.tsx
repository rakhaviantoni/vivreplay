'use client';

import React from 'react';
import { 
  XIcon as X, 
  LockKeyIcon as Lock, 
  EyeIcon as Eye, 
  EyeSlashIcon as EyeOff, 
  ShieldCheckIcon as ShieldCheck,
  CheckCircleIcon as CheckCircle
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { PrivacySettings } from '../types';

interface PrivacyModalProps {
  open: boolean;
  onClose: () => void;
  privacy: PrivacySettings;
  onChangePrivacy: (settings: PrivacySettings) => void;
}

export function PrivacyModal({
  open,
  onClose,
  privacy,
  onChangePrivacy,
}: PrivacyModalProps) {
  if (!open) return null;

  const handleToggle = (key: keyof PrivacySettings) => {
    const updated: PrivacySettings = {
      ...privacy,
      [key]: privacy[key] === 'public' ? 'private' : 'public',
    };
    onChangePrivacy(updated);
    toast.success(`Updated ${key} privacy to ${updated[key]}`);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 160,
      background: 'rgba(10, 12, 16, 0.75)',
      backdropFilter: 'blur(7px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '500px',
        borderRadius: '18px',
        background: 'var(--vault-panel)',
        border: '1px solid var(--vault-border)',
        boxShadow: '0 28px 70px rgba(0, 0, 0, 0.35)',
        padding: '26px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={20} color="var(--vault-gold)" />
            <h3 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '20px', fontWeight: 600, margin: 0 }}>
              Collection Privacy Controls
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

        <p style={{ fontSize: '12px', color: 'var(--vault-ink-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Control which parts of your collection and financials are visible to the public. Portfolio values are never exposed by default.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Collection Privacy */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'var(--vault-slot-bg)',
            border: '1px solid var(--vault-border)',
          }}>
            <div>
              <strong style={{ fontSize: '13px', display: 'block', color: 'var(--vault-ink)' }}>
                Collection Showcase
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)' }}>
                {privacy.collection === 'public' ? 'Publicly visible on your player profile' : 'Private to you only'}
              </span>
            </div>
            <button
              type="button"
              className={`vault-btn ${privacy.collection === 'public' ? 'vault-btn-primary' : 'vault-btn-secondary'}`}
              style={{ height: '32px', fontSize: '11px', padding: '0 12px' }}
              onClick={() => handleToggle('collection')}
            >
              {privacy.collection === 'public' ? 'Public' : 'Private'}
            </button>
          </div>

          {/* Portfolio Value Privacy */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'var(--vault-slot-bg)',
            border: '1px solid var(--vault-border)',
          }}>
            <div>
              <strong style={{ fontSize: '13px', display: 'block', color: 'var(--vault-ink)' }}>
                Portfolio Financial Value
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)' }}>
                {privacy.portfolioValue === 'public' ? 'Total estimated portfolio value is public' : 'Estimated portfolio value is hidden'}
              </span>
            </div>
            <button
              type="button"
              className={`vault-btn ${privacy.portfolioValue === 'public' ? 'vault-btn-primary' : 'vault-btn-secondary'}`}
              style={{ height: '32px', fontSize: '11px', padding: '0 12px' }}
              onClick={() => handleToggle('portfolioValue')}
            >
              {privacy.portfolioValue === 'public' ? 'Public' : 'Private'}
            </button>
          </div>

          {/* Slabs Privacy */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'var(--vault-slot-bg)',
            border: '1px solid var(--vault-border)',
          }}>
            <div>
              <strong style={{ fontSize: '13px', display: 'block', color: 'var(--vault-ink)' }}>
                Graded Slabs Gallery
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)' }}>
                {privacy.slabs === 'public' ? 'Authenticated slabs appear in your public gallery' : 'Slabs are kept confidential'}
              </span>
            </div>
            <button
              type="button"
              className={`vault-btn ${privacy.slabs === 'public' ? 'vault-btn-primary' : 'vault-btn-secondary'}`}
              style={{ height: '32px', fontSize: '11px', padding: '0 12px' }}
              onClick={() => handleToggle('slabs')}
            >
              {privacy.slabs === 'public' ? 'Public' : 'Private'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="vault-btn vault-btn-primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
