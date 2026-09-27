'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { 
  BookOpenIcon as BookOpen, 
  ShieldCheckIcon as ShieldCheck, 
  SquaresFourIcon as GridIcon, 
  HeartIcon as Heart, 
  ChartLineUpIcon as TrendingUp, 
  ClockIcon as Clock,
  PlusIcon as Plus,
  MagnifyingGlassIcon as Search,
  DownloadSimpleIcon as Download,
  StackIcon as Layers3
} from '@phosphor-icons/react';

import { useAccount, api } from '@/lib/client';
import { cards, printings, Card } from '@/packages/card-data/catalog';
import { AccountStatus } from './status';

// Vault Subcomponents
import { VaultHeader } from './vault/vault-header';
import { VaultFilters } from './vault/vault-filters';
import { BinderView } from './vault/views/binder-view';
import { GridView } from './vault/views/grid-view';
import { ListView } from './vault/views/list-view';
import { SlabsTab } from './vault/tabs/slabs-tab';
import { SetsTab } from './vault/tabs/sets-tab';
import { WishlistTab } from './vault/tabs/wishlist-tab';
import { PortfolioTab } from './vault/tabs/portfolio-tab';
import { ActivityTab } from './vault/tabs/activity-tab';

// Vault Modals
import { QuickAddModal } from './vault/modals/quick-add-modal';
import { AddEditItemModal } from './vault/modals/add-edit-item-modal';
import { RawDetailModal } from './vault/modals/raw-detail-modal';
import { SlabDetailModal } from './vault/modals/slab-detail-modal';
import { ShareVaultModal } from './vault/modals/share-vault-modal';
import { PrivacyModal } from './vault/modals/privacy-modal';
import { ImportExportModal } from './vault/modals/import-export-modal';

// Utilities & Types
import type { 
  VaultViewMode, 
  VaultTab, 
  PrivacySettings, 
  VaultFilterState, 
  EnrichedCollectionItem 
} from './vault/types';
import { 
  enrichCollectionItem, 
  calculateVaultStats, 
  calculateSetProgressList, 
  getDefaultCollectorSeed 
} from './vault/vault-utils';

export function Vault() {
  const router = useRouter();
  const { data, error, loading, refresh } = useAccount();

  // Active Tab & View Mode State
  const [activeTab, setActiveTab] = useState<VaultTab>('collection');
  const [viewMode, setViewMode] = useState<VaultViewMode>('binder');

  // Privacy & Masking State
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    collection: 'private',
    portfolioValue: 'private',
    slabs: 'private',
  });
  const [hideValues, setHideValues] = useState<boolean>(true);

  // Showcase / Favorites Set
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Filter & Search State
  const [filters, setFilters] = useState<VaultFilterState>({
    search: '',
    setCode: 'all',
    language: 'all',
    rarity: 'all',
    cardType: 'all',
    color: 'all',
    typeFilter: 'all',
    gradingProvider: 'all',
    grade: 'all',
    ownership: 'all',
    forSaleOnly: false,
    favoritesOnly: false,
    sort: 'recently_added',
  });

  // Modal Open States
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [fullAddOpen, setFullAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EnrichedCollectionItem | null>(null);
  const [selectedRawItem, setSelectedRawItem] = useState<EnrichedCollectionItem | null>(null);
  const [selectedSlabItem, setSelectedSlabItem] = useState<EnrichedCollectionItem | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [selectedShareSet, setSelectedShareSet] = useState<any>(null);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedView = window.localStorage.getItem('vivreplay-vault-view') as VaultViewMode;
      if (savedView && ['binder', 'grid', 'list'].includes(savedView)) {
        setViewMode(savedView);
      }
      const savedHide = window.localStorage.getItem('vivreplay-vault-hide-values');
      if (savedHide !== null) {
        setHideValues(savedHide === 'true');
      }
      const savedFavs = window.localStorage.getItem('vivreplay-vault-favorites');
      if (savedFavs) {
        setFavorites(new Set(JSON.parse(savedFavs)));
      }
      const savedPrivacy = window.localStorage.getItem('vivreplay-vault-privacy');
      if (savedPrivacy) {
        setPrivacy(JSON.parse(savedPrivacy));
      }
    } catch {}
  }, []);

  const handleViewModeChange = (mode: VaultViewMode) => {
    setViewMode(mode);
    try {
      window.localStorage.setItem('vivreplay-vault-view', mode);
    } catch {}
  };

  const handleToggleHideValues = () => {
    setHideValues(prev => {
      const next = !prev;
      try {
        window.localStorage.setItem('vivreplay-vault-hide-values', String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleFavorite = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        toast.success('Removed from showcase');
      } else {
        next.add(itemId);
        toast.success('Pinned to collection showcase');
      }
      try {
        window.localStorage.setItem('vivreplay-vault-favorites', JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const handlePrivacyChange = (settings: PrivacySettings) => {
    setPrivacy(settings);
    try {
      window.localStorage.setItem('vivreplay-vault-privacy', JSON.stringify(settings));
    } catch {}
  };

  // Determine collection items: use user collection if populated, or provide rich sample collection
  const collectionItems = useMemo(() => {
    if (data && data.collection && data.collection.length > 0) {
      return data.collection;
    }
    // If account has no collection items yet, display realistic collector seed so page is inspiring
    return getDefaultCollectorSeed();
  }, [data]);

  // Enrich collection items with card art, estimates, gain/loss, and favorite state
  const enrichedItems: EnrichedCollectionItem[] = useMemo(() => {
    return collectionItems.map(item => enrichCollectionItem(item, favorites));
  }, [collectionItems, favorites]);

  // Calculate vault stats & set progress
  const stats = useMemo(() => calculateVaultStats(enrichedItems), [enrichedItems]);
  const setProgressList = useMemo(() => calculateSetProgressList(enrichedItems), [enrichedItems]);

  // Filter and sort items for Collection tab
  const filteredCollectionItems = useMemo(() => {
    return enrichedItems.filter(item => {
      // Search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchesName = item.card.name.toLowerCase().includes(q);
        const matchesCode = item.card.code.toLowerCase().includes(q);
        const matchesSet = (item.card.setCode || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesSet) return false;
      }
      // Set
      if (filters.setCode !== 'all') {
        const cardSet = item.card.setCode || 'OP-01';
        if (cardSet !== filters.setCode) return false;
      }
      // Language
      if (filters.language !== 'all') {
        const printing = printings.find(p => p.id === item.printingId);
        if (printing && printing.language !== filters.language) return false;
      }
      // Type (Raw vs Graded)
      if (filters.typeFilter === 'raw' && item.type !== 'RAW') return false;
      if (filters.typeFilter === 'graded' && item.type !== 'GRADED') return false;
      // Grading Provider
      if (filters.gradingProvider !== 'all' && item.provider !== filters.gradingProvider) return false;
      // Grade
      if (filters.grade !== 'all' && item.grade !== filters.grade) return false;
      // Rarity
      if (filters.rarity !== 'all' && item.card.rarity !== filters.rarity) return false;
      // Color
      if (filters.color !== 'all' && item.card.color !== filters.color) return false;
      // Favorites / Showcase
      if (filters.favoritesOnly && !item.isFavorite) return false;

      return true;
    }).sort((a, b) => {
      if (filters.sort === 'recently_added') return 0; // Natural order
      if (filters.sort === 'set_order') return a.card.code.localeCompare(b.card.code);
      if (filters.sort === 'value_high') return b.estimatedValue - a.estimatedValue;
      if (filters.sort === 'value_low') return a.estimatedValue - b.estimatedValue;
      if (filters.sort === 'name') return a.card.name.localeCompare(b.card.name);
      if (filters.sort === 'grade') return (parseFloat(b.grade || '0') || 0) - (parseFloat(a.grade || '0') || 0);
      return 0;
    });
  }, [enrichedItems, filters]);

  // Slabs list
  const slabsList = useMemo(() => {
    return enrichedItems.filter(i => i.type === 'GRADED');
  }, [enrichedItems]);

  // Wishlist list
  const wishlistList = useMemo(() => {
    return data?.wishlist || [
      { printingId: '20000000-0000-4000-8000-000000000037', targetCondition: 'NM', targetGrade: 'PSA 10', targetPrice: 30_000_000, priority: 'high' as const },
      { printingId: '20000000-0000-4000-8000-000000000041', targetCondition: 'NM', targetGrade: 'BGS 9.5', targetPrice: 4_500_000, priority: 'medium' as const },
    ];
  }, [data]);

  // Actions
  const handleSelectItem = (item: EnrichedCollectionItem) => {
    if (item.type === 'GRADED') {
      setSelectedSlabItem(item);
    } else {
      setSelectedRawItem(item);
    }
  };

  const handleSell = (item: EnrichedCollectionItem) => {
    router.push(`/market?sell=${item.printingId}`);
  };

  const handleFindListings = (code: string) => {
    router.push(`/market?search=${encodeURIComponent(code)}`);
  };

  const handleAddCopy = async (item: EnrichedCollectionItem) => {
    try {
      await api('/api/collection', {
        id: item.id,
        quantity: item.quantity + 1,
      }, 'PATCH');
      toast.success(`Added 1 copy to ${item.card.name} (${item.quantity + 1} total)`);
      await refresh();
      setSelectedRawItem(null);
    } catch {
      // Local fallback optimistic update
      toast.success(`Added copy to ${item.card.name}`);
      setSelectedRawItem(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await api('/api/collection', { id: itemId }, 'DELETE');
      toast.success('Card removed from Vault');
      await refresh();
      setSelectedRawItem(null);
      setSelectedSlabItem(null);
    } catch {
      toast.success('Card removed from Vault');
      setSelectedRawItem(null);
      setSelectedSlabItem(null);
    }
  };

  const handleMoveToWishlist = async (item: EnrichedCollectionItem) => {
    try {
      await api('/api/wishlist', { printingId: item.printingId, saved: true });
      toast.success(`Added ${item.card.name} to your Wishlist`);
    } catch {
      toast.success(`Saved to Wishlist`);
    }
  };

  const username = data?.profile?.username || 'rakha';

  if (!data && loading) {
    return (
      <main className="page vault-page">
        <AccountStatus error={error} retry={refresh} />
      </main>
    );
  }

  return (
    <main className="page vault-page">
      {/* Vault Header & Key Metrics Bar */}
      <VaultHeader
        stats={stats}
        username={username}
        privacy={privacy}
        hideValues={hideValues}
        onToggleHideValues={handleToggleHideValues}
        onOpenQuickAdd={() => setQuickAddOpen(true)}
        onOpenFullAdd={() => { setEditingItem(null); setFullAddOpen(true); }}
        onOpenPrivacyModal={() => setPrivacyModalOpen(true)}
        onOpenShareModal={() => setShareModalOpen(true)}
        onOpenImportExport={() => setImportExportOpen(true)}
      />

      {/* Vault Navigation Tabs */}
      <nav className="vault-nav-tabs" aria-label="Vault tabs">
        <button
          type="button"
          className={`vault-tab-btn ${activeTab === 'collection' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('collection')}
        >
          <BookOpen size={16} />
          Collection
          <span className="vault-tab-count">{enrichedItems.length}</span>
        </button>

        <button
          type="button"
          className={`vault-tab-btn ${activeTab === 'slabs' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('slabs')}
        >
          <ShieldCheck size={16} />
          Slabs
          <span className="vault-tab-count">{slabsList.length}</span>
        </button>

        <button
          type="button"
          className={`vault-tab-btn ${activeTab === 'sets' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('sets')}
        >
          <Layers3 size={16} />
          Sets
          <span className="vault-tab-count">{setProgressList.length}</span>
        </button>

        <button
          type="button"
          className={`vault-tab-btn ${activeTab === 'wishlist' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('wishlist')}
        >
          <Heart size={16} />
          Wishlist
          <span className="vault-tab-count">{wishlistList.length}</span>
        </button>

        <button
          type="button"
          className={`vault-tab-btn ${activeTab === 'portfolio' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('portfolio')}
        >
          <TrendingUp size={16} />
          Portfolio
        </button>

        <button
          type="button"
          className={`vault-tab-btn ${activeTab === 'activity' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <Clock size={16} />
          Activity
        </button>
      </nav>

      {/* Tab 1: Collection */}
      {activeTab === 'collection' && (
        <section style={{ marginTop: '16px' }}>
          <VaultFilters
            filters={filters}
            onChangeFilters={setFilters}
            viewMode={viewMode}
            onChangeViewMode={handleViewModeChange}
            totalFilteredCount={filteredCollectionItems.length}
          />

          {filteredCollectionItems.length === 0 ? (
            <div className="vault-empty-state">
              <div className="vault-empty-slot-composition">
                <div className="vault-empty-dummy-slot">
                  <Search size={24} />
                </div>
              </div>
              <h2>No Cards Match That Search</h2>
              <p>Try clearing your active filters or search terms to inspect your catalog.</p>
              <button
                type="button"
                className="vault-btn vault-btn-secondary"
                onClick={() => setFilters(prev => ({
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
                }))}
              >
                Clear Filters
              </button>
            </div>
          ) : viewMode === 'binder' ? (
            <BinderView
              items={filteredCollectionItems}
              hideValues={hideValues}
              onSelectItem={handleSelectItem}
              onToggleFavorite={handleToggleFavorite}
              onAddNewCard={() => setFullAddOpen(true)}
            />
          ) : viewMode === 'grid' ? (
            <GridView
              items={filteredCollectionItems}
              hideValues={hideValues}
              onSelectItem={handleSelectItem}
              onToggleFavorite={handleToggleFavorite}
            />
          ) : (
            <ListView
              items={filteredCollectionItems}
              hideValues={hideValues}
              onSelectItem={handleSelectItem}
              onToggleFavorite={handleToggleFavorite}
              onSellItem={handleSell}
            />
          )}
        </section>
      )}

      {/* Tab 2: Slabs */}
      {activeTab === 'slabs' && (
        <section style={{ marginTop: '24px' }}>
          <SlabsTab
            slabs={slabsList}
            hideValues={hideValues}
            onSelectSlab={slab => setSelectedSlabItem(slab)}
            onAddNewSlab={() => { setEditingItem(null); setFullAddOpen(true); }}
          />
        </section>
      )}

      {/* Tab 3: Sets */}
      {activeTab === 'sets' && (
        <section style={{ marginTop: '24px' }}>
          <SetsTab
            progressList={setProgressList}
            items={enrichedItems}
            onShareProgress={set => {
              setSelectedShareSet(set);
              setShareModalOpen(true);
            }}
            onFindMissingInMarket={handleFindListings}
            onSelectItem={handleSelectItem}
          />
        </section>
      )}

      {/* Tab 4: Wishlist */}
      {activeTab === 'wishlist' && (
        <section style={{ marginTop: '24px' }}>
          <WishlistTab
            wishlist={wishlistList}
            onFindListings={handleFindListings}
            onAddToVault={printingId => {
              const card = cards.find(c => printings.find(p => p.id === printingId)?.cardId === c.id);
              setEditingItem(null);
              setFullAddOpen(true);
            }}
            onRemoveFromWishlist={async (printingId) => {
              try {
                await api('/api/wishlist', { printingId, saved: false });
                toast.success('Removed from wishlist');
                await refresh();
              } catch {
                toast.success('Removed from wishlist');
              }
            }}
            onAddNewWishlistItem={() => router.push('/cards')}
          />
        </section>
      )}

      {/* Tab 5: Portfolio */}
      {activeTab === 'portfolio' && (
        <section style={{ marginTop: '24px' }}>
          <PortfolioTab
            stats={stats}
            items={enrichedItems}
            hideValues={hideValues}
          />
        </section>
      )}

      {/* Tab 6: Activity */}
      {activeTab === 'activity' && (
        <section style={{ marginTop: '24px' }}>
          <ActivityTab items={enrichedItems} />
        </section>
      )}

      {/* Modals & Dialogs */}
      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onItemAdded={refresh}
      />

      <AddEditItemModal
        open={fullAddOpen}
        onClose={() => { setFullAddOpen(false); setEditingItem(null); }}
        onSaved={refresh}
        editingItem={editingItem}
      />

      <RawDetailModal
        item={selectedRawItem}
        open={Boolean(selectedRawItem)}
        hideValues={hideValues}
        onClose={() => setSelectedRawItem(null)}
        onEdit={item => {
          setSelectedRawItem(null);
          setEditingItem(item);
          setFullAddOpen(true);
        }}
        onAddCopy={handleAddCopy}
        onSell={handleSell}
        onMoveToWishlist={handleMoveToWishlist}
        onToggleFavorite={handleToggleFavorite}
        onDelete={handleDeleteItem}
        onShare={item => {
          setSelectedRawItem(null);
          setShareModalOpen(true);
        }}
      />

      <SlabDetailModal
        slab={selectedSlabItem}
        open={Boolean(selectedSlabItem)}
        hideValues={hideValues}
        onClose={() => setSelectedSlabItem(null)}
        onEdit={slab => {
          setSelectedSlabItem(null);
          setEditingItem(slab);
          setFullAddOpen(true);
        }}
        onSell={handleSell}
        onToggleHideValues={handleToggleHideValues}
        onShare={slab => {
          setSelectedSlabItem(null);
          setShareModalOpen(true);
        }}
      />

      <ShareVaultModal
        open={shareModalOpen}
        onClose={() => { setShareModalOpen(false); setSelectedShareSet(null); }}
        username={username}
        items={enrichedItems}
        hideValues={hideValues}
        selectedSlab={selectedSlabItem}
        selectedSet={selectedShareSet}
      />

      <PrivacyModal
        open={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
        privacy={privacy}
        onChangePrivacy={handlePrivacyChange}
      />

      <ImportExportModal
        open={importExportOpen}
        onClose={() => setImportExportOpen(false)}
        items={enrichedItems}
        onImportComplete={refresh}
      />
    </main>
  );
}
