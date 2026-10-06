'use client';

import React from 'react';
import { 
  ChartLineUpIcon as TrendingUp, 
  InfoIcon as Info
} from '@phosphor-icons/react';
import { formatCompactMoney, formatMoney } from '@/packages/domain';
import type { VaultStats, EnrichedCollectionItem } from '../types';

interface PortfolioTabProps {
  language: 'EN'|'ID';
  stats: VaultStats;
  items: EnrichedCollectionItem[];
  hideValues: boolean;
  isPricingLoading?: boolean;
}

export function PortfolioTab({
  language,
  stats,
  items,
  hideValues,
  isPricingLoading = false,
}: PortfolioTabProps) {
  const id=language==='ID';
  const t=(en:string,indo:string)=>id?indo:en;

  // Breakdown calculations
  // 1. By Set
  const valueBySet: Record<string, number> = {};
  items.forEach(item => {
    const set = item.card.setCode || 'OP-01';
    valueBySet[set] = (valueBySet[set] || 0) + item.estimatedValue;
  });

  // 2. By Raw vs Slab
  const rawValue = items.filter(i => i.type === 'RAW').reduce((sum, i) => sum + i.estimatedValue, 0);
  const slabValue = items.filter(i => i.type === 'GRADED').reduce((sum, i) => sum + i.estimatedValue, 0);

  // 3. By Language
  const valueByLang: Record<string, number> = { JP: 0, EN: 0 };
  items.forEach(item => {
    const lang = item.language ?? item.card.language ?? 'EN';
    valueByLang[lang] = (valueByLang[lang] || 0) + item.estimatedValue;
  });

  // 4. By Grading Provider (for slabs)
  const valueByProvider: Record<string, number> = {};
  items.filter(i => i.type === 'GRADED').forEach(item => {
    const p = item.provider || 'PSA';
    valueByProvider[p] = (valueByProvider[p] || 0) + item.estimatedValue;
  });

  const totalVal = Math.max(1, stats.estimatedValue);

  return (
    <div className="vault-portfolio-container">
      {/* Portfolio Overview Summary Card */}
      <div style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'var(--vault-panel)',
        border: '1px solid var(--vault-border)',
        boxShadow: '0 4px 20px rgba(35, 28, 16, 0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--vault-gold)' }}>
              {t('Collection overview','Ringkasan koleksi')}
            </span>
            <h2 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '28px', fontWeight: 600, margin: '4px 0 0' }}>
              {t('Collection value','Nilai koleksi')}
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="vault-confidence-badge" style={{ padding: '4px 10px', fontSize: '11px' }}>
              YUYUTEI · {stats.marketPricedCount} {t('PRINTINGS WITH PRICES','CETAKAN DENGAN DATA HARGA')}
            </span>
          </div>
        </div>

        {/* Financial Overview Metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid var(--vault-border-light)',
        }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              {t('Estimated collection value','Perkiraan nilai koleksi')}
            </span>
            <div style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '32px', fontWeight: 600, color: 'var(--vault-ink)', margin: '4px 0' }}>
              {hideValues ? 'Rp ••••••••' : isPricingLoading ? 'Loading…' : stats.marketPricedCount ? formatCompactMoney(stats.estimatedValue, 'IDR') : '-'}
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--vault-ink-secondary)' }}>
              {hideValues ? t('Hidden','Disembunyikan') : isPricingLoading ? t('Checking saved Yuyutei prices…','Memeriksa harga Yuyutei…') : stats.marketPricedCount ? `${t('Priced copies only:','Nilai kartu dengan data harga:')} ${formatMoney(stats.estimatedValue, 'IDR')}` : t('No exact printing prices available','Harga untuk cetakan ini belum tersedia')}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              {t('Acquisition cost of priced copies','Biaya perolehan cetakan dengan data harga')}
            </span>
            <div style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '32px', fontWeight: 600, color: 'var(--vault-ink)', margin: '4px 0' }}>
              {hideValues ? 'Rp ••••••••' : formatCompactMoney(stats.valuedAcquisitionCost, 'IDR')}
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--vault-ink-secondary)' }}>
              {hideValues ? t('Hidden','Disembunyikan') : t('Cards with an exact current Yuyutei price','Kartu dengan harga Yuyutei terkini untuk cetakan yang sama')}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              {t('Unrealized difference','Selisih nilai saat ini')}
            </span>
            <div style={{
              fontFamily: 'var(--display-font, var(--font-sans))',
              fontSize: '32px',
              fontWeight: 600,
              color: stats.unrealizedChangePercent === null ? 'var(--vault-ink-muted)' : stats.unrealizedChangeAmount >= 0 ? '#2e8b57' : '#c0392b',
              margin: '4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {hideValues ? 'Rp ••••••••' : stats.unrealizedChangePercent === null ? '-' : (
                <>
                  <TrendingUp size={24} />
                  {stats.unrealizedChangeAmount >= 0 ? '+' : ''}
                  {formatCompactMoney(stats.unrealizedChangeAmount, 'IDR')}
                </>
              )}
            </div>
            <span style={{ fontSize: '11.5px', color: stats.unrealizedChangePercent === null ? 'var(--vault-ink-muted)' : stats.unrealizedChangeAmount >= 0 ? '#2e8b57' : '#c0392b', fontWeight: 600 }}>
              {hideValues ? t('Hidden','Disembunyikan') : stats.unrealizedChangePercent === null ? t('Add acquisition costs for comparison','Tambahkan biaya perolehan untuk melihat selisih') : `${stats.unrealizedChangePercent >= 0 ? '+' : ''}${stats.unrealizedChangePercent.toFixed(1)}% ${t('vs cost of priced copies','dari biaya cetakan dengan data harga')}`}
            </span>
          </div>
        </div>

        {/* Valuation Methodology & Confidence Note */}
        <div style={{
          marginTop: '20px',
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'var(--vault-slot-bg)',
          border: '1px solid var(--vault-border)',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          fontSize: '11.5px',
          color: 'var(--vault-ink-secondary)',
        }}>
          <Info size={18} color="var(--vault-gold)" style={{ flexShrink: 0 }} />
          <div>
            <strong>Data source:</strong> Latest scraped Yuyutei listing prices for exact Japanese printings. {stats.observationCount} stored observations across {stats.marketPricedCount} printings; English and graded cards are excluded. {stats.lastUpdated ? `Latest observation: ${new Date(stats.lastUpdated).toLocaleString()}.` : 'No current observations are available.'}
          </div>
        </div>
      </div>

      {/* Lightweight Visualizations Grid */}
      <div className="vault-portfolio-charts-grid">
        {/* Value Allocation by Set */}
        <div className="vault-chart-card">
          <h3>
            <span>{t('Value by set','Nilai per set')}</span>
            <small style={{ fontSize: '11px', color: 'var(--vault-ink-muted)', fontWeight: 400 }}>{Object.keys(valueBySet).length} sets</small>
          </h3>
          <div>
            {Object.entries(valueBySet).sort((a, b) => b[1] - a[1]).map(([setName, amount]) => {
              const pct = ((amount / totalVal) * 100).toFixed(1);
              return (
                <div key={setName} className="vault-alloc-row">
                  <span className="vault-alloc-label" title={setName}>{setName}</span>
                  <div className="vault-alloc-bar-track">
                    <div className="vault-alloc-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="vault-alloc-value">
                    {hideValues ? '•••' : `${pct}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Raw vs Graded Slabs Ratio */}
        <div className="vault-chart-card">
          <h3>
            <span>{t('Card condition','Kondisi kartu')}</span>
            <small style={{ fontSize: '11px', color: 'var(--vault-ink-muted)', fontWeight: 400 }}>{t('Raw vs graded','Tanpa grading vs dengan grading')}</small>
          </h3>
          <div>
            <div className="vault-alloc-row">
              <span className="vault-alloc-label">{t('Graded slabs','Kartu graded')}</span>
              <div className="vault-alloc-bar-track">
                <div className="vault-alloc-bar-fill" style={{ width: `${((slabValue / totalVal) * 100).toFixed(1)}%`, background: 'var(--vault-gold)' }} />
              </div>
              <span className="vault-alloc-value">
                {hideValues ? '•••' : `${((slabValue / totalVal) * 100).toFixed(1)}%`}
              </span>
            </div>
            <div className="vault-alloc-row">
              <span className="vault-alloc-label">{t('Raw cards','Kartu tanpa grading')}</span>
              <div className="vault-alloc-bar-track">
                <div className="vault-alloc-bar-fill" style={{ width: `${((rawValue / totalVal) * 100).toFixed(1)}%`, background: '#62a5cd' }} />
              </div>
              <span className="vault-alloc-value">
                {hideValues ? '•••' : `${((rawValue / totalVal) * 100).toFixed(1)}%`}
              </span>
            </div>
          </div>
          <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--vault-ink-muted)', borderTop: '1px dashed var(--vault-border-light)', paddingTop: '10px' }}>
            {t('Graded cards total','Total kartu graded')} <b>{hideValues ? '•••' : formatCompactMoney(slabValue, 'IDR')}</b> {t('across','dari')} {stats.slabsCount} {t('cards.','kartu.')}
          </div>
        </div>

        {/* Language Allocation */}
        <div className="vault-chart-card">
          <h3>
            <span>{t('Language','Bahasa')}</span>
            <small style={{ fontSize: '11px', color: 'var(--vault-ink-muted)', fontWeight: 400 }}>JP vs EN</small>
          </h3>
          <div>
            <div className="vault-alloc-row">
              <span className="vault-alloc-label">日本語 (JP)</span>
              <div className="vault-alloc-bar-track">
                <div className="vault-alloc-bar-fill" style={{ width: `${((valueByLang.JP / totalVal) * 100).toFixed(1)}%`, background: '#df675e' }} />
              </div>
              <span className="vault-alloc-value">
                {hideValues ? '•••' : `${((valueByLang.JP / totalVal) * 100).toFixed(1)}%`}
              </span>
            </div>
            <div className="vault-alloc-row">
              <span className="vault-alloc-label">English (EN)</span>
              <div className="vault-alloc-bar-track">
                <div className="vault-alloc-bar-fill" style={{ width: `${((valueByLang.EN / totalVal) * 100).toFixed(1)}%`, background: '#78ab78' }} />
              </div>
              <span className="vault-alloc-value">
                {hideValues ? '•••' : `${((valueByLang.EN / totalVal) * 100).toFixed(1)}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Grading Provider Allocation */}
        <div className="vault-chart-card">
          <h3>
            <span>{t('Grading company','Perusahaan grading')}</span>
            <small style={{ fontSize: '11px', color: 'var(--vault-ink-muted)', fontWeight: 400 }}>{t('Share of graded value','Bagian dari nilai kartu graded')}</small>
          </h3>
          <div>
            {Object.entries(valueByProvider).map(([provider, amount]) => {
              const pct = slabValue > 0 ? ((amount / slabValue) * 100).toFixed(1) : '0';
              return (
                <div key={provider} className="vault-alloc-row">
                  <span className="vault-alloc-label">{provider}</span>
                  <div className="vault-alloc-bar-track">
                    <div className="vault-alloc-bar-fill" style={{ width: `${pct}%`, background: 'var(--vault-brass)' }} />
                  </div>
                  <span className="vault-alloc-value">
                    {hideValues ? '•••' : `${pct}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Price History & Observation Inspector */}
      <div className="vault-chart-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0 }}>{t('Yuyutei price change over 30 days','Perubahan harga Yuyutei dalam 30 hari')}</h3>
            <span style={{ fontSize: '11px', color: 'var(--vault-ink-secondary)' }}>
              {t('Saved Yuyutei listing data, with a 30-day comparison when history is available.','Data listing Yuyutei tersimpan, dengan perbandingan 30 hari jika riwayat tersedia.')}
            </span>
          </div>

        </div>

        {/* Do not draw synthetic history: only report the change supported by stored observations. */}
        <div style={{
          height: '180px',
          width: '100%',
          borderRadius: '10px',
          background: 'var(--vault-slot-bg)',
          border: '1px solid var(--vault-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--vault-ink-secondary)' }}>
            <strong style={{ display: 'block', color: stats.change30DayPercent === null ? 'var(--vault-ink-muted)' : 'var(--vault-ink)', fontSize: 24 }}>
              {hideValues ? '••••••' : stats.change30DayPercent === null ? '-' : `${stats.change30DayPercent >= 0 ? '+' : ''}${stats.change30DayPercent.toFixed(1)}%`}
            </strong>
            <span>{stats.change30DayPercent===null?t('Not enough saved prices from 30 days ago to compare.','Data harga dari 30 hari lalu belum cukup untuk dibandingkan.'):`${t('Based on','Berdasarkan')} ${stats.change30DayCount} ${t('printings with comparable history','cetakan dengan riwayat harga yang sebanding')}`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
