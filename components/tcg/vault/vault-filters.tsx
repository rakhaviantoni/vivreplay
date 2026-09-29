'use client';

import React from 'react';
import {
  MagnifyingGlassIcon as Search,
  SquaresFourIcon as GridIcon,
  BookOpenIcon as BookOpen,
  ListDashesIcon as ListIcon,
  XIcon as X,
  FunnelIcon as Filter,
  StarIcon as Star,
} from '@phosphor-icons/react';
import { SETS_CATALOG } from '@/packages/card-data/catalog';
import { GRADING_PROVIDERS } from '@/packages/domain';
import type { VaultFilterState, VaultViewMode } from './types';

interface VaultFiltersProps {
  filters: VaultFilterState;
  onChangeFilters: (updater: (prev: VaultFilterState) => VaultFilterState) => void;
  viewMode: VaultViewMode;
  onChangeViewMode: (mode: VaultViewMode) => void;
  totalFilteredCount: number;
  language?: 'EN' | 'ID';
}

export function VaultFilters({
  filters,
  onChangeFilters,
  viewMode,
  onChangeViewMode,
  totalFilteredCount,
  language = 'EN',
}: VaultFiltersProps) {
  const t = (en: string, idStr: string) => language === 'ID' ? idStr : en;
  const hasActiveFilters = Boolean(
    filters.search ||
    filters.setCode !== 'all' ||
    filters.language !== 'all' ||
    filters.rarity !== 'all' ||
    filters.color !== 'all' ||
    filters.typeFilter !== 'all' ||
    filters.gradingProvider !== 'all' ||
    filters.grade !== 'all' ||
    filters.favoritesOnly ||
    filters.ownership !== 'all'
  );

  const resetFilters = () => {
    onChangeFilters(prev => ({
      ...prev,
      search: '',
      setCode: 'all',
      language: 'all',
      rarity: 'all',
      color: 'all',
      typeFilter: 'all',
      gradingProvider: 'all',
      grade: 'all',
      favoritesOnly: false,
      ownership: 'all',
    }));
  };

  return (
    <div className="vault-toolbar">
      {/* Search Input with Autocomplete and Clear */}
      <div className="vault-toolbar-search">
        <Search size={16} color="var(--vault-ink-muted)" />
        <input
          type="text"
          value={filters.search}
          onChange={e => onChangeFilters(prev => ({ ...prev, search: e.target.value }))}
          placeholder={t('Search card name, code (e.g. OP05-119), or set...','Cari nama kartu, kode (mis. OP05-119), atau set...')}
        />
        {filters.search && (
          <button
            type="button"
            onClick={() => onChangeFilters(prev => ({ ...prev, search: '' }))}
            style={{ background: 'none', border: 'none', color: 'var(--vault-ink-muted)', cursor: 'pointer', padding: '2px' }}
            aria-label={t('Clear search','Hapus pencarian')}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter Dropdowns */}
      <div className="vault-toolbar-filters">
        {/* Set Filter */}
        <select
          className="vault-select-compact"
          value={filters.setCode}
          onChange={e => onChangeFilters(prev => ({ ...prev, setCode: e.target.value }))}
          aria-label={t('Filter by set','Filter berdasarkan set')}
        >
          <option value="all">{t('All Sets','Semua Set')}</option>
          {SETS_CATALOG.map(s => (
            <option key={s.code} value={s.code}>
              {s.code} · {s.name}
            </option>
          ))}
        </select>

        {/* Language Filter */}
        <select
          className="vault-select-compact"
          value={filters.language}
          onChange={e => onChangeFilters(prev => ({ ...prev, language: e.target.value }))}
          aria-label={t('Filter by language','Filter berdasarkan bahasa')}
        >
          <option value="all">{t('All Langs','Semua Bahasa')}</option>
          <option value="JP">Japanese (JP)</option>
          <option value="EN">English (EN)</option>
        </select>

        {/* Type Filter: Raw vs Slabs */}
        <select
          className="vault-select-compact"
          value={filters.typeFilter}
          onChange={e => onChangeFilters(prev => ({ ...prev, typeFilter: e.target.value as any }))}
          aria-label={t('Filter by raw or slab','Filter kartu reguler atau slab')}
        >
          <option value="all">{t('Raw & Slabs','Reguler & Slab')}</option>
          <option value="raw">{t('Raw Only','Hanya Reguler')}</option>
          <option value="graded">{t('Slabs Only','Hanya Slab')}</option>
        </select>

        {/* Grading Provider (if slabs or all) */}
        {filters.typeFilter !== 'raw' && (
          <select
            className="vault-select-compact"
            value={filters.gradingProvider}
            onChange={e => onChangeFilters(prev => ({ ...prev, gradingProvider: e.target.value }))}
            aria-label={t('Filter by grading provider','Filter berdasarkan grading')}
          >
            <option value="all">{t('All Graders','Semua Grader')}</option>
            {GRADING_PROVIDERS.map(p => (
              <option key={p.id} value={p.id}>
                {p.shortName}
              </option>
            ))}
          </select>
        )}

        {/* Rarity Filter */}
        <select
          className="vault-select-compact"
          value={filters.rarity}
          onChange={e => onChangeFilters(prev => ({ ...prev, rarity: e.target.value }))}
          aria-label={t('Filter by rarity','Filter berdasarkan kelangkaan')}
        >
          <option value="all">{t('All Rarities','Semua Kelangkaan')}</option>
          <option value="SEC">SEC (Secret Rare)</option>
          <option value="L">L (Leader)</option>
          <option value="SR">SR (Super Rare)</option>
          <option value="R">R (Rare)</option>
          <option value="UC">UC (Uncommon)</option>
          <option value="C">C (Common)</option>
        </select>

        {/* Showcase / Favorites Toggle */}
        <button
          type="button"
          className={`vault-btn vault-btn-secondary ${filters.favoritesOnly ? 'is-active' : ''}`}
          style={{
            height: '36px',
            padding: '0 10px',
            borderColor: filters.favoritesOnly ? 'var(--vault-gold)' : undefined,
            background: filters.favoritesOnly ? 'var(--vault-gold-soft)' : undefined,
            color: filters.favoritesOnly ? 'var(--vault-gold-deep)' : undefined,
          }}
          onClick={() => onChangeFilters(prev => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))}
          title={t('Showcase items only','Hanya kartu showcase')}
        >
          <Star size={14} weight={filters.favoritesOnly ? 'fill' : 'regular'} />
          Showcase
        </button>

        {/* Sort Dropdown */}
        <select
          className="vault-select-compact"
          value={filters.sort}
          onChange={e => onChangeFilters(prev => ({ ...prev, sort: e.target.value as any }))}
          aria-label={t('Sort collection','Urutkan koleksi')}
        >
          <option value="recently_added">{t('Recently Added','Baru Ditambahkan')}</option>
          <option value="set_order">{t('Set Order','Urutan Set')}</option>
          <option value="value_high">{t('Value: High to Low','Nilai: Tertinggi ke Terendah')}</option>
          <option value="value_low">{t('Value: Low to High','Nilai: Terendah ke Tertinggi')}</option>
          <option value="name">{t('Name (A-Z)','Nama (A-Z)')}</option>
          <option value="grade">{t('Grade (10 - 1)','Grade (10 - 1)')}</option>
        </select>

        {/* Reset Filter Button if active */}
        {hasActiveFilters && (
          <button
            type="button"
            className="vault-btn vault-btn-ghost"
            style={{ height: '36px', padding: '0 8px', color: 'var(--vault-gold-deep)' }}
            onClick={resetFilters}
            title={t('Reset all active filters','Reset semua filter aktif')}
          >
            <X size={14} />
            {t('Reset','Reset')}
          </button>
        )}

        {/* View Switcher: Binder | Grid | List */}
        <div className="vault-view-toggle">
          <button
            type="button"
            className={viewMode === 'binder' ? 'is-active' : ''}
            onClick={() => onChangeViewMode('binder')}
            title={t('Binder View (3x3 Archival Presentation)','Tampilan Binder (Format Arsip 3x3)')}
            aria-label={t('Binder view','Tampilan binder')}
          >
            <BookOpen size={16} />
          </button>
          <button
            type="button"
            className={viewMode === 'grid' ? 'is-active' : ''}
            onClick={() => onChangeViewMode('grid')}
            title={t('Grid View','Tampilan Kisi')}
            aria-label={t('Grid view','Tampilan kisi')}
          >
            <GridIcon size={16} />
          </button>
          <button
            type="button"
            className={viewMode === 'list' ? 'is-active' : ''}
            onClick={() => onChangeViewMode('list')}
            title={t('List View','Tampilan Daftar')}
            aria-label={t('List view','Tampilan daftar')}
          >
            <ListIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
