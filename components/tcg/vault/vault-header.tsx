'use client';

import React from 'react';
import { 
  EyeIcon as Eye, 
  EyeSlashIcon as EyeOff, 
  ShieldCheckIcon as ShieldCheck, 
  PlusIcon as Plus, 
  LightningIcon as Zap, 
  LockKeyIcon as Lock, 
  ShareNetworkIcon as Share2, 
  ArrowDownIcon as Download, 
  ChartLineUpIcon as TrendingUp,
  SparkleIcon as Sparkles
} from '@phosphor-icons/react';
import { formatMoney, formatCompactMoney } from '@/packages/domain';
import type { VaultStats, PrivacySettings } from './types';

interface VaultHeaderProps {
  stats: VaultStats;
  username: string;
  privacy: PrivacySettings;
  hideValues: boolean;
  onToggleHideValues: () => void;
  onOpenQuickAdd: () => void;
  onOpenFullAdd: () => void;
  onOpenPrivacyModal: () => void;
  onOpenShareModal: () => void;
  onOpenImportExport: () => void;
}

export function VaultHeader({
  stats,
  username,
  privacy,
  hideValues,
  onToggleHideValues,
  onOpenQuickAdd,
  onOpenFullAdd,
  onOpenPrivacyModal,
  onOpenShareModal,
  onOpenImportExport,
}: VaultHeaderProps) {
  const isPrivate = privacy.collection === 'private' || privacy.portfolioValue === 'private';

  return (
    <header className="vault-header">
      <div className="vault-header-top">
        <div className="vault-title-group">
          <p className="vault-eyebrow">
            <ShieldCheck size={14} weight="bold" />
            Archive & Portfolio · VivrePlay Vault
          </p>
          <h1>Your Vault</h1>
          <p className="vault-subtitle">
            <span>@{username}&apos;s digital archive</span>
            <span>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={12} />
              {privacy.collection === 'public' ? 'Public Collection' : 'Private Collection'}
            </span>
          </p>
        </div>

        <div className="vault-actions-group">
          <button 
            type="button" 
            className="vault-btn vault-btn-secondary" 
            onClick={onOpenQuickAdd}
            title="Fast 1-click add raw NM card"
          >
            <Zap size={15} weight="fill" color="#c68a2c" />
            Quick Add
          </button>
          <button 
            type="button" 
            className="vault-btn vault-btn-primary" 
            onClick={onOpenFullAdd}
          >
            <Plus size={15} weight="bold" />
            Add to Vault
          </button>
          <button 
            type="button" 
            className="vault-btn vault-btn-secondary" 
            onClick={onOpenPrivacyModal}
            title="Configure Vault and portfolio privacy"
          >
            <Lock size={14} />
            Privacy
          </button>
          <button 
            type="button" 
            className="vault-btn vault-btn-secondary" 
            onClick={onOpenShareModal}
            title="Generate Top 9 binder, slab, or set progress share card"
          >
            <Share2 size={14} />
            Share
          </button>
          <button 
            type="button" 
            className="vault-btn vault-btn-ghost" 
            onClick={onOpenImportExport}
            title="Import or Export collection data"
          >
            <Download size={14} />
            Import / Export
          </button>
        </div>
      </div>

      {/* Primary Key Metrics Overview Bar */}
      <div className="vault-metrics-card">
        {/* Total & Unique Cards */}
        <div className="vault-metric-item">
          <span className="vault-metric-label">Collection Size</span>
          <div className="vault-metric-value">
            {stats.totalCards} <small style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vault-ink-muted)' }}>Cards</small>
          </div>
          <span className="vault-metric-sub">
            <b>{stats.uniqueIdentities}</b> unique identities
          </span>
        </div>

        {/* Graded Slabs */}
        <div className="vault-metric-item">
          <span className="vault-metric-label">Graded Slabs</span>
          <div className="vault-metric-value">
            {stats.slabsCount} <small style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vault-ink-muted)' }}>Slabs</small>
          </div>
          <span className="vault-metric-sub">
            {stats.rawCount} raw binder copies
          </span>
        </div>

        {/* Estimated Value with Privacy Toggle & Confidence Badge */}
        <div className="vault-metric-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="vault-metric-label">Estimated Value</span>
            <button
              type="button"
              className="vault-privacy-toggle"
              onClick={onToggleHideValues}
              aria-label={hideValues ? 'Show portfolio value' : 'Hide portfolio value'}
              title={hideValues ? 'Show value' : 'Hide value'}
            >
              {hideValues ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="vault-metric-value vault-value-row">
            {hideValues ? (
              <span style={{ letterSpacing: '0.15em', color: 'var(--vault-ink-muted)' }}>Rp ••••••••</span>
            ) : (
              <>
                <span>{formatCompactMoney(stats.estimatedValue, 'IDR')}</span>
                <span className="vault-confidence-badge" title={`Based on verified sales (${stats.observationCount} observations)`}>
                  <Sparkles size={10} weight="fill" />
                  {stats.valuationConfidence}
                </span>
              </>
            )}
          </div>
          <span className="vault-metric-sub">
            {hideValues ? (
              'Value masked for privacy'
            ) : (
              <>
                <span>Full: {formatMoney(stats.estimatedValue, 'IDR')}</span>
              </>
            )}
          </span>
        </div>

        {/* Acquisition Cost & Unrealized Difference */}
        <div className="vault-metric-item">
          <span className="vault-metric-label">Acquisition Cost</span>
          <div className="vault-metric-value">
            {hideValues ? 'Rp ••••••••' : formatCompactMoney(stats.totalAcquisitionCost, 'IDR')}
          </div>
          <span className={`vault-metric-sub ${stats.unrealizedChangeAmount >= 0 ? 'positive' : 'negative'}`}>
            {hideValues ? (
              'Hidden'
            ) : (
              <>
                <TrendingUp size={12} />
                {stats.unrealizedChangeAmount >= 0 ? '+' : ''}
                {formatCompactMoney(stats.unrealizedChangeAmount, 'IDR')} ({stats.unrealizedChangePercent >= 0 ? '+' : ''}{stats.unrealizedChangePercent.toFixed(1)}%)
              </>
            )}
          </span>
        </div>

        {/* 30-Day Market Change */}
        <div className="vault-metric-item">
          <span className="vault-metric-label">30-Day Index</span>
          <div className="vault-metric-value" style={{ color: stats.change30DayPercent >= 0 ? '#2e8b57' : '#c0392b' }}>
            +{stats.change30DayPercent}%
          </div>
          <span className="vault-metric-sub">
            OPTCG benchmark index
          </span>
        </div>
      </div>
    </header>
  );
}
