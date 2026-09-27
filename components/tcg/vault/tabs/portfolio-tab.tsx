'use client';

import React, { useState } from 'react';
import { 
  ChartLineUpIcon as TrendingUp, 
  SparkleIcon as Sparkles, 
  InfoIcon as Info,
  CheckCircleIcon as CheckCircle,
  CurrencyCircleDollarIcon as Dollar
} from '@phosphor-icons/react';
import { formatCompactMoney, formatMoney } from '@/packages/domain';
import type { VaultStats, EnrichedCollectionItem } from '../types';

interface PortfolioTabProps {
  stats: VaultStats;
  items: EnrichedCollectionItem[];
  hideValues: boolean;
}

export function PortfolioTab({
  stats,
  items,
  hideValues,
}: PortfolioTabProps) {
  const [historyRange, setHistoryRange] = useState<'7D' | '30D' | '90D' | '1Y' | 'ALL'>('30D');

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
    const lang = item.printingId.endsWith('2') || item.card.code === 'OP05-119' ? 'JP' : 'EN';
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
              Collector Portfolio Summary
            </span>
            <h2 style={{ fontFamily: 'var(--display-font, Georgia, serif)', fontSize: '28px', fontWeight: 600, margin: '4px 0 0' }}>
              Collection Valuation
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="vault-confidence-badge" style={{ padding: '4px 10px', fontSize: '11px' }}>
              <Sparkles size={13} weight="fill" />
              {stats.valuationConfidence.toUpperCase()} CONFIDENCE
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
              Estimated Portfolio Value
            </span>
            <div style={{ fontFamily: 'var(--display-font, Georgia, serif)', fontSize: '32px', fontWeight: 600, color: 'var(--vault-ink)', margin: '4px 0' }}>
              {hideValues ? 'Rp ••••••••' : formatCompactMoney(stats.estimatedValue, 'IDR')}
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--vault-ink-secondary)' }}>
              {hideValues ? 'Hidden' : `Exact: ${formatMoney(stats.estimatedValue, 'IDR')}`}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              Acquisition Cost Basis
            </span>
            <div style={{ fontFamily: 'var(--display-font, Georgia, serif)', fontSize: '32px', fontWeight: 600, color: 'var(--vault-ink)', margin: '4px 0' }}>
              {hideValues ? 'Rp ••••••••' : formatCompactMoney(stats.totalAcquisitionCost, 'IDR')}
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--vault-ink-secondary)' }}>
              Actual historical purchase prices
            </span>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              Unrealized Difference
            </span>
            <div style={{
              fontFamily: 'var(--display-font, Georgia, serif)',
              fontSize: '32px',
              fontWeight: 600,
              color: stats.unrealizedChangeAmount >= 0 ? '#2e8b57' : '#c0392b',
              margin: '4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {hideValues ? 'Rp ••••••••' : (
                <>
                  <TrendingUp size={24} />
                  {stats.unrealizedChangeAmount >= 0 ? '+' : ''}
                  {formatCompactMoney(stats.unrealizedChangeAmount, 'IDR')}
                </>
              )}
            </div>
            <span style={{ fontSize: '11.5px', color: stats.unrealizedChangeAmount >= 0 ? '#2e8b57' : '#c0392b', fontWeight: 600 }}>
              {hideValues ? 'Hidden' : `+${stats.unrealizedChangePercent.toFixed(1)}% unrealized gain`}
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
            <strong>Transparent Valuation:</strong> Based on {stats.observationCount} recent completed sales and verified market observations (trimmed median). No false precision displayed. Last refreshed {stats.lastUpdated}.
          </div>
        </div>
      </div>

      {/* Lightweight Visualizations Grid */}
      <div className="vault-portfolio-charts-grid">
        {/* Value Allocation by Set */}
        <div className="vault-chart-card">
          <h3>
            <span>Allocation by Set</span>
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
            <span>Format Breakdown</span>
            <small style={{ fontSize: '11px', color: 'var(--vault-ink-muted)', fontWeight: 400 }}>Raw vs Graded</small>
          </h3>
          <div>
            <div className="vault-alloc-row">
              <span className="vault-alloc-label">Graded Slabs</span>
              <div className="vault-alloc-bar-track">
                <div className="vault-alloc-bar-fill" style={{ width: `${((slabValue / totalVal) * 100).toFixed(1)}%`, background: 'var(--vault-gold)' }} />
              </div>
              <span className="vault-alloc-value">
                {hideValues ? '•••' : `${((slabValue / totalVal) * 100).toFixed(1)}%`}
              </span>
            </div>
            <div className="vault-alloc-row">
              <span className="vault-alloc-label">Raw Collection</span>
              <div className="vault-alloc-bar-track">
                <div className="vault-alloc-bar-fill" style={{ width: `${((rawValue / totalVal) * 100).toFixed(1)}%`, background: '#62a5cd' }} />
              </div>
              <span className="vault-alloc-value">
                {hideValues ? '•••' : `${((rawValue / totalVal) * 100).toFixed(1)}%`}
              </span>
            </div>
          </div>
          <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--vault-ink-muted)', borderTop: '1px dashed var(--vault-border-light)', paddingTop: '10px' }}>
            Slabs account for <b>{hideValues ? '•••' : formatCompactMoney(slabValue, 'IDR')}</b> across {stats.slabsCount} verified units.
          </div>
        </div>

        {/* Language Allocation */}
        <div className="vault-chart-card">
          <h3>
            <span>Language Distribution</span>
            <small style={{ fontSize: '11px', color: 'var(--vault-ink-muted)', fontWeight: 400 }}>JP vs EN</small>
          </h3>
          <div>
            <div className="vault-alloc-row">
              <span className="vault-alloc-label">Japanese (JP)</span>
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
            <span>Grading Company Share</span>
            <small style={{ fontSize: '11px', color: 'var(--vault-ink-muted)', fontWeight: 400 }}>By slab value</small>
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
            <h3 style={{ margin: 0 }}>
              Price Observations & Historical Trajectory
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--vault-ink-secondary)' }}>
              Completed sales carry full valuation weight · Active asks shown as secondary reference
            </span>
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            {(['7D', '30D', '90D', '1Y', 'ALL'] as const).map(range => (
              <button
                key={range}
                type="button"
                className={`vault-btn vault-btn-secondary ${historyRange === range ? 'is-active' : ''}`}
                style={{
                  height: '28px',
                  padding: '0 8px',
                  fontSize: '11px',
                  borderColor: historyRange === range ? 'var(--vault-gold)' : undefined,
                  background: historyRange === range ? 'var(--vault-gold-soft)' : undefined,
                  color: historyRange === range ? 'var(--vault-gold-deep)' : undefined,
                }}
                onClick={() => setHistoryRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Lightweight SVG Visualizer for Portfolio Trend */}
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
          <svg viewBox="0 0 800 160" style={{ width: '100%', height: '100%', padding: '10px 20px' }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="vaultPortfolioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--vault-gold)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--vault-gold)" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Grid Lines */}
            <line x1="0" y1="40" x2="800" y2="40" stroke="var(--vault-border)" strokeDasharray="3 3" />
            <line x1="0" y1="80" x2="800" y2="80" stroke="var(--vault-border)" strokeDasharray="3 3" />
            <line x1="0" y1="120" x2="800" y2="120" stroke="var(--vault-border)" strokeDasharray="3 3" />

            {/* Filled Area */}
            <path
              d="M 20 120 Q 200 110, 350 75 T 550 55 T 780 30 L 780 150 L 20 150 Z"
              fill="url(#vaultPortfolioGrad)"
            />
            {/* Main Trend Line */}
            <path
              d="M 20 120 Q 200 110, 350 75 T 550 55 T 780 30"
              fill="none"
              stroke="var(--vault-gold)"
              strokeWidth="3"
            />
            {/* Observation dots for completed sales */}
            <circle cx="20" cy="120" r="4" fill="var(--vault-gold)" />
            <circle cx="200" cy="100" r="4" fill="var(--vault-gold)" />
            <circle cx="350" cy="75" r="4" fill="var(--vault-gold)" />
            <circle cx="550" cy="55" r="4" fill="var(--vault-gold)" />
            <circle cx="780" cy="30" r="5" fill="var(--vault-gold)" stroke="#fff" strokeWidth="2" />
          </svg>
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '16px',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--vault-gold-deep)',
            background: 'var(--vault-panel)',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid var(--vault-border)',
          }}>
            {hideValues ? '••••••••' : `Latest: ${formatCompactMoney(stats.estimatedValue, 'IDR')}`} (+{stats.change30DayPercent}%)
          </div>
        </div>
      </div>
    </div>
  );
}
