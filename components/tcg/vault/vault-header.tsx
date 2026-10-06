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
} from '@phosphor-icons/react';
import { formatMoney, formatCompactMoney } from '@/packages/domain';
import type { VaultStats, PrivacySettings } from './types';

interface VaultHeaderProps {
  stats: VaultStats;
  username: string;
  privacy: PrivacySettings;
  hideValues: boolean;
  isPricingLoading?: boolean;
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
  isPricingLoading = false,
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
            {t('Archive & Portfolio · VivrePlay Vault','Arsip & Portofolio · Koleksi VivrePlay')}
          </p>
          <h1>{t('Your Vault','Koleksi Anda')}</h1>
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
            {t('Add to Vault','Simpan ke koleksi')}
          </button>
          <button 
            type="button" 
            className="vault-btn vault-btn-secondary" 
            onClick={onOpenPrivacyModal}
            title={t('Configure Vault and portfolio privacy','Atur privasi koleksi dan portofolio')}
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
                <span>{isPricingLoading ? '…' : stats.marketPricedCount ? formatCompactMoney(stats.estimatedValue, 'IDR') : '-'}</span>
                {stats.marketPricedCount > 0 && <span className="vault-confidence-badge" title={language === 'ID' ? 'Data listing Yuyutei untuk cetakan Jepang yang cocok' : 'Yuyutei listing data for exact Japanese printings'}>
                  {stats.marketPricedCount} {t('printings with prices','cetakan dengan data harga')}
                </span>}
              </>
            )}
          </div>
          <span className="vault-metric-sub">
            {hideValues ? (
              t('Value masked for privacy','Nilai disamarkan untuk privasi')
            ) : isPricingLoading ? (
              t('Checking saved Yuyutei prices…','Memeriksa harga Yuyutei tersimpan…')
            ) : (
              <>
                <span>{isPricingLoading ? t('Checking saved Yuyutei prices…','Memeriksa harga Yuyutei…') : stats.marketPricedCount ? `${t('Value of priced cards:','Nilai kartu dengan data harga:')} ${formatMoney(stats.estimatedValue, 'IDR')}` : t('No exact printing prices available','Harga untuk cetakan ini belum tersedia')}</span>
              </>
            )}
          </span>
        </div>

        {/* Acquisition Cost & Unrealized Difference */}
        <div className="vault-metric-item">
          <span className="vault-metric-label">{t('Acquisition Cost · All Copies','Biaya Akuisisi · Semua Kartu')}</span>
          <div className="vault-metric-value">
            {hideValues ? 'Rp ••••••••' : formatCompactMoney(stats.totalAcquisitionCost, 'IDR')}
          </div>
          <span className={`vault-metric-sub ${stats.unrealizedChangePercent === null ? '' : stats.unrealizedChangeAmount >= 0 ? 'positive' : 'negative'}`}>
            {hideValues ? (
              t('Hidden','Tersembunyi')
            ) : (
                stats.unrealizedChangePercent === null
                ? t('Add costs to compare priced copies','Tambahkan biaya untuk membandingkan kartu berharga')
                : <><TrendingUp size={12} />{t('Priced copies:','Kartu berharga:')} {stats.unrealizedChangeAmount >= 0 ? '+' : ''}{formatCompactMoney(stats.unrealizedChangeAmount, 'IDR')} ({stats.unrealizedChangePercent >= 0 ? '+' : ''}{stats.unrealizedChangePercent.toFixed(1)}%)</>
            )}
          </span>
        </div>

        {/* 30-day change based on actual Yuyutei observations */}
        <div className="vault-metric-item">
          <span className="vault-metric-label">{t('30-Day Yuyutei change','Perubahan Yuyutei 30 Hari')}</span>
          <div className="vault-metric-value" style={{ color: stats.change30DayPercent === null ? 'var(--vault-ink-muted)' : stats.change30DayPercent >= 0 ? '#2e8b57' : '#c0392b' }}>
            {stats.change30DayPercent === null ? '-' : `${stats.change30DayPercent >= 0 ? '+' : ''}${stats.change30DayPercent.toFixed(1)}%`}
          </div>
          <span className="vault-metric-sub">
            {stats.change30DayPercent === null
              ? t('Insufficient matched history','Riwayat pembanding belum cukup')
              : t(`From ${stats.change30DayCount} printings with prices`, `Dari ${stats.change30DayCount} cetakan dengan data harga`)}
          </span>
        </div>
      </div>
    </header>
  );
}
