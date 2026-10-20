'use client';

import React from 'react';
import { 
  EyeIcon as Eye, 
  EyeSlashIcon as EyeOff, 
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
  privacy: PrivacySettings;
  hideValues: boolean;
  isPricingLoading?: boolean;
  language?: 'EN' | 'ID';
  gameSlug?: 'one-piece'|'pokemon';
  onToggleHideValues: () => void;
  onOpenQuickAdd: () => void;
  onOpenFullAdd: () => void;
  onOpenPrivacyModal: () => void;
  onOpenShareModal: () => void;
  onOpenImportExport: () => void;
}

export function VaultHeader({
  stats,
  privacy,
  hideValues,
  isPricingLoading = false,
  language = 'EN',
  gameSlug = 'one-piece',
  onToggleHideValues,
  onOpenQuickAdd,
  onOpenFullAdd,
  onOpenPrivacyModal,
  onOpenShareModal,
  onOpenImportExport,
}: VaultHeaderProps) {
  const t = (en: string, idStr: string) => language === 'ID' ? idStr : en;

  return (
    <header className="vault-header">
      <div className="vault-header-top">
        <div className="vault-title-group">
          <p className="vault-eyebrow">{t('Card collection','Koleksi kartu')}</p>
          <h1>{t('Your Vault','Koleksi Anda')}</h1>
          <p className="vault-subtitle">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={12} />
              {privacy.collection === 'public' ? t('Visible to others','Terlihat oleh orang lain') : t('Only you can see this','Hanya Anda yang dapat melihat')}
            </span>
          </p>
        </div>

        <div className="vault-actions-group">
          <button 
            type="button" 
            className="vault-btn vault-btn-secondary" 
            onClick={onOpenQuickAdd}
            title={t('Add a card quickly','Tambah kartu dengan cepat')}
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
            title={t('Choose who can see your collection','Atur siapa yang dapat melihat koleksi')}
          >
            <Lock size={14} />
            {t('Privacy','Privasi')}
          </button>
          <button 
            type="button" 
            className="vault-btn vault-btn-secondary" 
            onClick={onOpenShareModal}
            title={t('Share your collection','Bagikan koleksi')}
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
            <b>{stats.uniqueIdentities}</b> {t('different cards','kartu berbeda')}
          </span>
        </div>

        {/* Graded Slabs */}
        <div className="vault-metric-item">
          <span className="vault-metric-label">{t('Graded Slabs','Slab Graded')}</span>
          <div className="vault-metric-value">
            {stats.slabsCount} <small style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vault-ink-muted)' }}>{t('Slabs','Slab')}</small>
          </div>
          <span className="vault-metric-sub">
            {stats.rawCount} {t('ungraded cards','kartu tanpa grading')}
          </span>
        </div>

        {/* Estimated Value with Privacy Toggle & Confidence Badge */}
        <div className="vault-metric-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="vault-metric-label">{gameSlug==='pokemon'?t('Purchase costs recorded','Total pembelian tercatat'):t('Estimated Value','Estimasi Nilai')}</span>
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
                <span>{gameSlug==='pokemon'?formatCompactMoney(stats.totalAcquisitionCost,'IDR'):isPricingLoading ? '…' : stats.marketPricedCount ? formatCompactMoney(stats.estimatedValue, 'IDR') : '-'}</span>
                {gameSlug!=='pokemon'&&stats.marketPricedCount > 0 && <span className="vault-confidence-badge">
                  {stats.marketPricedCount} {t('priced cards','kartu dengan harga')}
                </span>}
              </>
            )}
          </div>
          <span className="vault-metric-sub">
            {hideValues ? (
              t('Value masked for privacy','Nilai disamarkan untuk privasi')
            ) : gameSlug==='pokemon' ? (
              t('Based on purchase prices you entered','Berdasarkan harga pembelian yang Anda catat')
            ) : isPricingLoading ? (
              t('Checking card prices…','Memeriksa harga kartu…')
            ) : (
              <>
                <span>{isPricingLoading ? t('Checking card prices…','Memeriksa harga kartu…') : stats.marketPricedCount ? `${t('Based on priced cards:','Berdasarkan kartu dengan harga:')} ${formatMoney(stats.estimatedValue, 'IDR')}` : t('No price data yet','Belum ada data harga')}</span>
              </>
            )}
          </span>
        </div>

        {/* Acquisition Cost & Unrealized Difference */}
        {gameSlug!=='pokemon'&&<div className="vault-metric-item">
          <span className="vault-metric-label">{t('Total paid','Total pembelian')}</span>
          <div className="vault-metric-value">
            {hideValues ? 'Rp ••••••••' : formatCompactMoney(stats.totalAcquisitionCost, 'IDR')}
          </div>
          <span className={`vault-metric-sub ${stats.unrealizedChangePercent === null ? '' : stats.unrealizedChangeAmount >= 0 ? 'positive' : 'negative'}`}>
            {hideValues ? (
              t('Hidden','Tersembunyi')
            ) : (
                stats.unrealizedChangePercent === null
                ? t('Add purchase prices to track changes','Tambahkan harga beli untuk melihat perubahan')
                : <><TrendingUp size={12} />{t('Change in value:','Perubahan nilai:')} {stats.unrealizedChangeAmount >= 0 ? '+' : ''}{formatCompactMoney(stats.unrealizedChangeAmount, 'IDR')} ({stats.unrealizedChangePercent >= 0 ? '+' : ''}{stats.unrealizedChangePercent.toFixed(1)}%)</>
            )}
          </span>
        </div>}

        {/* 30-day price change */}
        {gameSlug!=='pokemon'&&<div className="vault-metric-item">
          <span className="vault-metric-label">{t('Price change over 30 days','Perubahan harga selama 30 hari')}</span>
          <div className="vault-metric-value" style={{ color: stats.change30DayPercent === null ? 'var(--vault-ink-muted)' : stats.change30DayPercent >= 0 ? '#2e8b57' : '#c0392b' }}>
            {stats.change30DayPercent === null ? '-' : `${stats.change30DayPercent >= 0 ? '+' : ''}${stats.change30DayPercent.toFixed(1)}%`}
          </div>
          <span className="vault-metric-sub">
            {stats.change30DayPercent === null
              ? t('Not enough price history','Riwayat harga belum cukup')
              : t(`Based on ${stats.change30DayCount} cards`, `Berdasarkan ${stats.change30DayCount} kartu`)}
          </span>
        </div>}
      </div>
    </header>
  );
}
