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
import type { Card } from '@/packages/card-data/catalog';
import { GRADING_PROVIDERS } from '@/packages/domain';
import type { VaultFilterState, VaultViewMode } from './types';
import { MultiFilter, Picker } from '../catalog';
import { CardScanButton } from '../card-scan-button';

interface VaultFiltersProps {
  filters: VaultFilterState;
  onChangeFilters: (updater: (prev: VaultFilterState) => VaultFilterState) => void;
  viewMode: VaultViewMode;
  onChangeViewMode: (mode: VaultViewMode) => void;
  totalFilteredCount: number;
  language?: 'EN' | 'ID';
  cardsInVault?: Card[];
  gameSlug?: 'one-piece' | 'pokemon' | 'all';
}

export function VaultFilters({
  filters,
  onChangeFilters,
  viewMode,
  onChangeViewMode,
  totalFilteredCount,
  language = 'EN',
  cardsInVault = [],
  gameSlug = 'one-piece',
}: VaultFiltersProps) {
  const t = (en: string, idStr: string) => language === 'ID' ? idStr : en;
  const sets = [...new Set(cardsInVault.map(card => card.setCode).filter((code):code is string=>Boolean(code)))].sort();
  const rarities = [...new Set(cardsInVault.map(card => card.rarity).filter(Boolean))].sort();
  const colorsInVault = [...new Set(cardsInVault.flatMap(card => card.color.split(/\s*(?:\/|&|,)\s*|\s+/)).filter(Boolean))].sort();
  const cardTypes = [...new Set(cardsInVault.map(card => card.type).filter(Boolean))].sort();
  const hasActiveFilters = Boolean(
    filters.search ||
    filters.setCode.length > 0 ||
    filters.language.length > 0 ||
    filters.rarity.length > 0 ||
    (gameSlug==='one-piece'&&(filters.cardType !== 'all' || filters.color !== 'all')) ||
    filters.typeFilter !== 'all' ||
    filters.gradingProvider.length > 0 ||
    filters.grade !== 'all' ||
    filters.favoritesOnly
  );

  const resetFilters = () => {
    onChangeFilters(prev => ({
      ...prev,
      search: '',
      setCode: [],
      language: [],
      rarity: [],
      cardType: 'all',
      color: 'all',
      typeFilter: 'all',
      gradingProvider: [],
      grade: 'all',
      favoritesOnly: false,
    }));
  };

  return (
    <div className="vault-toolbar">
      <div className="vault-toolbar-search-row">
        {/* Search Input with Autocomplete and Clear */}
        <div className="vault-toolbar-search">
          <Search size={16} color="var(--vault-ink-muted)" />
          <input
            type="text"
            value={filters.search}
            onChange={e => onChangeFilters(prev => ({ ...prev, search: e.target.value }))}
            placeholder={gameSlug==='pokemon'?t('Search Pokémon, card number, or set...','Cari Pokémon, nomor kartu, atau set...'):gameSlug==='all'?t('Search card name, number, or set...','Cari nama kartu, nomor, atau set...'):t('Search card name, code (e.g. OP05-119), or set...','Cari nama kartu, kode (mis. OP05-119), atau set...')}
          />
          <CardScanButton game={gameSlug==='all'?'auto':gameSlug} locale={language} selectionPurpose="filter" onSelect={card=>onChangeFilters(prev=>({
            ...prev,
            search:card.game==='pokemon'?card.cardNumber:card.code,
            setCode:card.setCode?[card.setCode]:[],
            language:card.language?[card.language]:[],
          }))}/>
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
      </div>

      {/* Filter Dropdowns */}
      <div className="vault-toolbar-filters">
        {/* Set Filter */}
        <MultiFilter label="Set" values={sets.map(code=>({value:code,label:code}))} selected={filters.setCode} onToggle={value=>onChangeFilters(prev=>({...prev,setCode:prev.setCode.includes(value)?prev.setCode.filter(item=>item!==value):[...prev.setCode,value]}))} searchPlaceholder={t('Find a set','Cari set')} />

        {/* Language Filter */}
        <MultiFilter label={t('Language','Bahasa')} values={[{value:'JP',label:'Japanese (JP)'},{value:'EN',label:'English (EN)'},...(gameSlug!=='one-piece'?[{value:'ID',label:'Bahasa Indonesia (ID)'}]:[])]} selected={filters.language} onToggle={value=>onChangeFilters(prev=>({...prev,language:prev.language.includes(value)?prev.language.filter(item=>item!==value):[...prev.language,value]}))} searchPlaceholder={t('Find a language','Cari bahasa')} />

        {/* Type Filter: Raw vs Slabs */}
        <Picker filterStyle searchPlaceholder={t('Search…','Cari…')} emptyLabel={t('No matches','Tidak ada hasil')} value={filters.typeFilter} onChange={value => onChangeFilters(prev => ({ ...prev, typeFilter: value as VaultFilterState['typeFilter'] }))} label={t('Filter by raw or slab','Filter kartu reguler atau slab')} options={[{value:'all',label:t('Raw & Slabs','Reguler & Slab')},{value:'raw',label:t('Raw Only','Hanya Reguler')},{value:'graded',label:t('Slabs Only','Hanya Slab')}]} />

        {/* Grading Provider (if slabs or all) */}
        {filters.typeFilter !== 'raw' && (
          <MultiFilter label={t('Grader','Grader')} values={GRADING_PROVIDERS.map(provider=>({value:provider.id,label:provider.shortName}))} selected={filters.gradingProvider} onToggle={value=>onChangeFilters(prev=>({...prev,gradingProvider:prev.gradingProvider.includes(value)?prev.gradingProvider.filter(item=>item!==value):[...prev.gradingProvider,value]}))} searchPlaceholder={t('Find a grader','Cari grader')} />
        )}

        {/* Rarity Filter */}
        <MultiFilter label={t('Rarity','Kelangkaan')} values={rarities.map(rarity=>({value:rarity,label:rarity}))} selected={filters.rarity} onToggle={value=>onChangeFilters(prev=>({...prev,rarity:prev.rarity.includes(value)?prev.rarity.filter(item=>item!==value):[...prev.rarity,value]}))} searchPlaceholder={t('Find a rarity','Cari rarity')} />

        {gameSlug==='one-piece'&&<>
          <Picker filterStyle searchPlaceholder={t('Search…','Cari…')} emptyLabel={t('No matches','Tidak ada hasil')} value={filters.color} onChange={value => onChangeFilters(prev => ({ ...prev, color: value }))} label={t('Filter by color','Filter berdasarkan warna')} options={[{value:'all',label:t('All Colors','Semua Warna')},...colorsInVault.map(color=>({value:color,label:color}))]} />
          <Picker filterStyle searchPlaceholder={t('Search…','Cari…')} emptyLabel={t('No matches','Tidak ada hasil')} value={filters.cardType} onChange={value => onChangeFilters(prev => ({ ...prev, cardType: value }))} label={t('Filter by card type','Filter berdasarkan jenis kartu')} options={[{value:'all',label:t('All Card Types','Semua Jenis Kartu')},...cardTypes.map(type=>({value:type,label:type}))]} />
        </>}
        {filters.typeFilter === 'graded' && <Picker filterStyle searchPlaceholder={t('Search…','Cari…')} emptyLabel={t('No matches','Tidak ada hasil')} value={filters.grade} onChange={value => onChangeFilters(prev => ({ ...prev, grade: value }))} label={t('Filter by grade','Filter berdasarkan grade')} options={[{value:'all',label:t('All Grades','Semua Grade')},...['10','9.5','9','8.5','8','7','6','5'].map(grade=>({value:grade,label:grade}))]} />}

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
        <Picker filterStyle searchPlaceholder={t('Search…','Cari…')} emptyLabel={t('No matches','Tidak ada hasil')} value={filters.sort} onChange={value => onChangeFilters(prev => ({ ...prev, sort: value as VaultFilterState['sort'] }))} label={t('Sort collection','Urutkan koleksi')} options={[
          {value:'recently_added',label:t('Recently Added','Baru Ditambahkan')},{value:'set_order',label:t('Set Order','Urutan Set')},...(gameSlug==='one-piece'?[{value:'value_high' as const,label:t('Market price: High to Low','Harga pasar: Tertinggi')},{value:'value_low' as const,label:t('Market price: Low to High','Harga pasar: Terendah')}] : []),{value:'name',label:t('Name (A-Z)','Nama (A-Z)')},{value:'grade',label:t('Grade (10 - 1)','Grade (10 - 1)')}
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
