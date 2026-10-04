'use client';

import React from 'react';
import {
  MagnifyingGlassIcon as Search,
  SquaresFourIcon as GridIcon,
  BookOpenIcon as BookOpen,
  ListDashesIcon as ListIcon,
  XIcon as X,
  StarIcon as Star,
} from '@phosphor-icons/react';
import { SETS_CATALOG, colors, cards } from '@/packages/card-data/catalog';
import { GRADING_PROVIDERS } from '@/packages/domain';
import type { VaultFilterState, VaultViewMode } from './types';
import { MultiFilter, Picker } from '../catalog';

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
    filters.cardType !== 'all' ||
    filters.color !== 'all' ||
    filters.typeFilter !== 'all' ||
    filters.gradingProvider !== 'all' ||
    filters.grade !== 'all' ||
    filters.favoritesOnly
  );

  const resetFilters = () => {
    onChangeFilters(prev => ({
      ...prev,
      search: '',
      setCode: 'all',
      language: 'all',
      rarity: 'all',
      cardType: 'all',
      color: 'all',
      typeFilter: 'all',
      gradingProvider: 'all',
      grade: 'all',
      favoritesOnly: false,
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
      <span className="vault-filter-count" aria-live="polite">{totalFilteredCount} {t('slots','slot')}</span>

      {/* Filter Dropdowns */}
      <div className="vault-toolbar-filters">
        {/* Set Filter */}
        <MultiFilter label="Set" values={SETS_CATALOG.map(set=>({value:set.code,label:`${set.code} · ${set.name}`}))} selected={filters.setCode==='all'?[]:[filters.setCode]} onToggle={value=>onChangeFilters(prev=>({...prev,setCode:prev.setCode===value?'all':value}))} searchPlaceholder={t('Find a set','Cari set')} />

        {/* Language Filter */}
        <Picker value={filters.language} onChange={value => onChangeFilters(prev => ({ ...prev, language: value }))} label={t('Filter by language','Filter berdasarkan bahasa')} options={[{value:'all',label:t('All Languages','Semua Bahasa')},{value:'JP',label:'Japanese (JP)'},{value:'EN',label:'English (EN)'}]} />

        {/* Type Filter: Raw vs Slabs */}
        <Picker value={filters.typeFilter} onChange={value => onChangeFilters(prev => ({ ...prev, typeFilter: value as VaultFilterState['typeFilter'] }))} label={t('Filter by raw or slab','Filter kartu reguler atau slab')} options={[{value:'all',label:t('Raw & Slabs','Reguler & Slab')},{value:'raw',label:t('Raw Only','Hanya Reguler')},{value:'graded',label:t('Slabs Only','Hanya Slab')}]} />

        {/* Grading Provider (if slabs or all) */}
        {filters.typeFilter !== 'raw' && (
          <Picker value={filters.gradingProvider} onChange={value => onChangeFilters(prev => ({ ...prev, gradingProvider: value }))} label={t('Filter by grading provider','Filter berdasarkan grading')} options={[{value:'all',label:t('All Graders','Semua Grader')},...GRADING_PROVIDERS.map(provider=>({value:provider.id,label:provider.shortName}))]} />
        )}

        {/* Rarity Filter */}
        <Picker value={filters.rarity} onChange={value => onChangeFilters(prev => ({ ...prev, rarity: value }))} label={t('Filter by rarity','Filter berdasarkan kelangkaan')} options={[{value:'all',label:t('All Rarities','Semua Kelangkaan')},...[...new Set(cards.map(card=>card.rarity).filter(Boolean))].sort().map(rarity=>({value:rarity,label:rarity}))]} />

        <Picker value={filters.color} onChange={value => onChangeFilters(prev => ({ ...prev, color: value }))} label={t('Filter by color','Filter berdasarkan warna')} options={[{value:'all',label:t('All Colors','Semua Warna')},...Object.keys(colors).map(color=>({value:color,label:color}))]} />
        <Picker value={filters.cardType} onChange={value => onChangeFilters(prev => ({ ...prev, cardType: value }))} label={t('Filter by card type','Filter berdasarkan jenis kartu')} options={[{value:'all',label:t('All Card Types','Semua Jenis Kartu')},...[...new Set(cards.map(card=>card.type))].sort().map(type=>({value:type,label:type}))]} />
        {filters.typeFilter === 'graded' && <Picker value={filters.grade} onChange={value => onChangeFilters(prev => ({ ...prev, grade: value }))} label={t('Filter by grade','Filter berdasarkan grade')} options={[{value:'all',label:t('All Grades','Semua Grade')},...['10','9.5','9','8.5','8','7','6','5'].map(grade=>({value:grade,label:grade}))]} />}

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
        <Picker value={filters.sort} onChange={value => onChangeFilters(prev => ({ ...prev, sort: value as VaultFilterState['sort'] }))} label={t('Sort collection','Urutkan koleksi')} options={[
          {value:'recently_added',label:t('Recently Added','Baru Ditambahkan')},{value:'set_order',label:t('Set Order','Urutan Set')},{value:'value_high',label:t('Market price: High to Low','Harga pasar: Tertinggi')},{value:'value_low',label:t('Market price: Low to High','Harga pasar: Terendah')},{value:'name',label:t('Name (A-Z)','Nama (A-Z)')},{value:'grade',label:t('Grade (10 - 1)','Grade (10 - 1)')}
        ]} />

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
