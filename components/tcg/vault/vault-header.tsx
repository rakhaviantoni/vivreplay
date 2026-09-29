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
  language?: 'EN' | 'ID';
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
  language = 'EN',
  onToggleHideValues,
  onOpenQuickAdd,
  onOpenFullAdd,
  onOpenPrivacyModal,
  onOpenShareModal,
  onOpenImportExport,
}: VaultHeaderProps) {
  const isPrivate = privacy.collection === 'private' || privacy.portfolioValue === 'private';
  const t = (en: string, idStr: string) => language === 'ID' ? idStr : en;

  return (
    <header className="vault-header">
      <div className="vault-header-top">
        <div className="vault-title-group">
          <p className="vault-eyebrow">
            <ShieldCheck size={14} weight="bold" />
            {t('Archive & Portfolio · VivrePlay Vault','Arsip & Portofolio · VivrePlay Vault')}
          </p>
          <h1>{t('Your Vault','Vault Anda')}</h1>
          <p className="vault-subtitle">
            <span>{language === 'ID' ? `Arsip digital @${username}` : `@${username}'s digital archive`}</span>
            <span>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={12} />
              {privacy.collection === 'public' ? t('Public Collection','Koleksi Publik') : t('Private Collection','Koleksi Privat')}
            </span>
          </p>
        </div>

        <div className="vault-actions-group">
          <button 
            type="button" 
            className="vault-btn vault-btn-secondary" 
            onClick={onOpenQuickAdd}
            title={t('Fast 1-click add raw NM card','Tambah cepat kartu reguler NM')}
          >
            <Zap size={15} weight="fill" color="#c68a2c" />
            {t('Quick Add','Tambah Cepat')}
          </button>
          <button 
            type="button" 
            className="vault-btn vault-btn-primary" 
            onClick={onOpenFullAdd}
          >
            <Plus size={15} weight="bold" />
            {t('Add to Vault','Simpan ke Vault')}
          </button>
          <button 
            type="button" 
            className="vault-btn vault-btn-secondary" 
            onClick={onOpenPrivacyModal}
            title={t('Configure Vault and portfolio privacy','Atur privasi Vault dan portofolio')}
          >
            <Lock size={14} />
            {t('Privacy','Privasi')}
          </button>
          <button 
            type="button" 
            className="vault-btn vault-btn-secondary" 
            onClick={onOpenShareModal}
            title={t('Generate Top 9 binder, slab, or set progress share card','Buat kartu showcase binder, slab, atau set')}
          >
            <Share2 size={14} />
            {t('Share','Bagikan')}
          </button>
          <button 
            type="button" 
            className="vault-btn vault-btn-ghost" 
            onClick={onOpenImportExport}
            title={t('Import or Export collection data','Impor atau Ekspor data koleksi')}
          >
            <Download size={14} />
            {t('Import / Export','Impor / Ekspor')}
          </button>
        </div>
      </div>

      {/* Primary Key Metrics Overview Bar */}
      <div className="vault-metrics-card">
        {/* Total & Unique Cards */}
        <div className="vault-metric-item">
          <span className="vault-metric-label">{t('Collection Size','Ukuran Koleksi')}</span>
          <div className="vault-metric-value">
            {stats.totalCards} <small style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vault-ink-muted)' }}>{t('Cards','Kartu')}</small>
          </div>
          <span className="vault-metric-sub">
            <b>{stats.uniqueIdentities}</b> {t('unique identities','kartu unik')}
          </span>
        </div>

        {/* Graded Slabs */}
        <div className="vault-metric-item">
          <span className="vault-metric-label">{t('Graded Slabs','Slab Graded')}</span>
          <div className="vault-metric-value">
            {stats.slabsCount} <small style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vault-ink-muted)' }}>{t('Slabs','Slab')}</small>
          </div>
          <span className="vault-metric-sub">
            {stats.rawCount} {t('raw binder copies','kartu reguler di binder')}
          </span>
        </div>

        {/* Estimated Value with Privacy Toggle & Confidence Badge */}
        <div className="vault-metric-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="vault-metric-label">{t('Estimated Value','Estimasi Nilai')}</span>
            <button
              type="button"
              className="vault-privacy-toggle"
              onClick={onToggleHideValues}
              aria-label={hideValues ? t('Show portfolio value','Tampilkan nilai portofolio') : t('Hide portfolio value','Sembunyikan nilai portofolio')}
              title={hideValues ? t('Show value','Tampilkan nilai') : t('Hide value','Sembunyikan nilai')}
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
                <span className="vault-confidence-badge" title={language === 'ID' ? `Berdasarkan pantauan pasar (${stats.observationCount} data)` : `Based on verified sales (${stats.observationCount} observations)`}>
                  <Sparkles size={10} weight="fill" />
                  {stats.valuationConfidence}
                </span>
              </>
            )}
          </div>
          <span className="vault-metric-sub">
            {hideValues ? (
              t('Value masked for privacy','Nilai disamarkan untuk privasi')
            ) : (
              <>
                <span>{t('Full:','Total:')} {formatMoney(stats.estimatedValue, 'IDR')}</span>
              </>
            )}
          </span>
        </div>

        {/* Acquisition Cost & Unrealized Difference */}
        <div className="vault-metric-item">
          <span className="vault-metric-label">{t('Acquisition Cost','Biaya Akuisisi')}</span>
          <div className="vault-metric-value">
            {hideValues ? 'Rp ••••••••' : formatCompactMoney(stats.totalAcquisitionCost, 'IDR')}
          </div>
          <span className={`vault-metric-sub ${stats.unrealizedChangeAmount >= 0 ? 'positive' : 'negative'}`}>
            {hideValues ? (
              t('Hidden','Tersembunyi')
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
          <span className="vault-metric-label">{t('30-Day Index','Indeks 30 Hari')}</span>
          <div className="vault-metric-value" style={{ color: stats.change30DayPercent >= 0 ? '#2e8b57' : '#c0392b' }}>
            +{stats.change30DayPercent}%
          </div>
          <span className="vault-metric-sub">
            {t('OPTCG benchmark index','Indeks tolok ukur OPTCG')}
          </span>
        </div>
      </div>
    </header>
  );
}
