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
}

export function VaultFilters({
  filters,
  onChangeFilters,
  viewMode,
  onChangeViewMode,
  totalFilteredCount,
}: VaultFiltersProps) {
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
          placeholder="Search card name, code (e.g. OP05-119), or set..."
        />
        {filters.search && (
          <button
            type="button"
            onClick={() => onChangeFilters(prev => ({ ...prev, search: '' }))}
            style={{ background: 'none', border: 'none', color: 'var(--vault-ink-muted)', cursor: 'pointer', padding: '2px' }}
            aria-label="Clear search"
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
          aria-label="Filter by set"
        >
          <option value="all">All Sets</option>
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
          aria-label="Filter by language"
        >
          <option value="all">All Langs</option>
          <option value="JP">Japanese (JP)</option>
          <option value="EN">English (EN)</option>
        </select>

        {/* Type Filter: Raw vs Slabs */}
        <select
          className="vault-select-compact"
          value={filters.typeFilter}
          onChange={e => onChangeFilters(prev => ({ ...prev, typeFilter: e.target.value as any }))}
          aria-label="Filter by raw or slab"
        >
          <option value="all">Raw & Slabs</option>
          <option value="raw">Raw Only</option>
          <option value="graded">Slabs Only</option>
        </select>

        {/* Grading Provider (if slabs or all) */}
        {filters.typeFilter !== 'raw' && (
          <select
            className="vault-select-compact"
            value={filters.gradingProvider}
            onChange={e => onChangeFilters(prev => ({ ...prev, gradingProvider: e.target.value }))}
            aria-label="Filter by grading provider"
          >
            <option value="all">All Graders</option>
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
          aria-label="Filter by rarity"
        >
          <option value="all">All Rarities</option>
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
          title="Showcase items only"
        >
          <Star size={14} weight={filters.favoritesOnly ? 'fill' : 'regular'} />
          Showcase
        </button>

        {/* Sort Dropdown */}
        <select
          className="vault-select-compact"
          value={filters.sort}
          onChange={e => onChangeFilters(prev => ({ ...prev, sort: e.target.value as any }))}
          aria-label="Sort collection"
        >
          <option value="recently_added">Recently Added</option>
          <option value="set_order">Set Order</option>
          <option value="value_high">Value: High to Low</option>
          <option value="value_low">Value: Low to High</option>
          <option value="name">Name (A-Z)</option>
          <option value="grade">Grade (10 - 1)</option>
        </select>

        {/* Reset Filter Button if active */}
        {hasActiveFilters && (
          <button
            type="button"
            className="vault-btn vault-btn-ghost"
            style={{ height: '36px', padding: '0 8px', color: 'var(--vault-gold-deep)' }}
            onClick={resetFilters}
            title="Reset all active filters"
          >
            <X size={14} />
            Reset
          </button>
        )}

        {/* View Switcher: Binder | Grid | List */}
        <div className="vault-view-toggle">
          <button
            type="button"
            className={viewMode === 'binder' ? 'is-active' : ''}
            onClick={() => onChangeViewMode('binder')}
            title="Binder View (3x3 Archival Presentation)"
            aria-label="Binder view"
          >
            <BookOpen size={16} />
          </button>
          <button
            type="button"
            className={viewMode === 'grid' ? 'is-active' : ''}
            onClick={() => onChangeViewMode('grid')}
            title="Grid View"
            aria-label="Grid view"
          >
            <GridIcon size={16} />
          </button>
          <button
            type="button"
            className={viewMode === 'list' ? 'is-active' : ''}
            onClick={() => onChangeViewMode('list')}
            title="List View"
            aria-label="List view"
          >
            <ListIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
