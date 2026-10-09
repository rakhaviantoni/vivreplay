'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  StackIcon as Layers3,
  FloppyDiskIcon as Save,
  UploadSimpleIcon as Upload,
  StorefrontIcon as Storefront,
} from '@phosphor-icons/react';

import { useAccount, api } from '@/lib/client';
import { cards, printings, Card } from '@/packages/card-data/catalog';

import {
  getLocalVaultItems,
  updateLocalVaultItem,
  deleteLocalVaultItem,
  hasLocalVaultCustomizations,
  clearLocalVault
} from './vault/local-vault';
import type { CollectionItem } from '@/packages/domain';

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
import { ListingsTab } from './vault/tabs/listings-tab';
import { VivreMark } from './brand-assets';

// Vault Modals
import { QuickAddModal } from './vault/modals/quick-add-modal';
import { AddEditItemModal } from './vault/modals/add-edit-item-modal';
import { RawDetailModal } from './vault/modals/raw-detail-modal';
import { SlabDetailModal } from './vault/modals/slab-detail-modal';
import { ShareVaultModal } from './vault/modals/share-vault-modal';
import { PrivacyModal } from './vault/modals/privacy-modal';
import { ImportExportModal } from './vault/modals/import-export-modal';
import { BulkListingModal } from './vault/modals/bulk-listing-modal';

// Utilities & Types
import type { 
  VaultViewMode, 
  VaultTab, 
  PrivacySettings, 
  VaultFilterState, 
  EnrichedCollectionItem,
  VaultMarketPrice,
} from './vault/types';
import { 
  enrichCollectionItem, 
  calculateVaultStats, 
  calculateSetProgressList,
  groupVaultStacks
} from './vault/vault-utils';

export function Vault() {
  const router = useRouter();
  const searchParams=useSearchParams();
  const { data, error, loading, refresh } = useAccount();

  // Active Tab & View Mode State
  const [activeTab, setActiveTab] = useState<VaultTab>(searchParams.get('tab')==='wishlist'?'wishlist':searchParams.get('tab')==='portfolio'?'portfolio':'collection');
  const [viewMode, setViewMode] = useState<VaultViewMode>('binder');
  const binderOrderStorageKey=`vivreplay-vault-binder-order:${String(data?.profile?.id??'guest')}`;
  const [binderOrder,setBinderOrder]=useState<string[]>([]);

  // Privacy & Masking State
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    collection: 'private',
    portfolioValue: 'private',
    slabs: 'private',
  });
  const [hideValues, setHideValues] = useState<boolean>(true);
  const [language, setLanguage] = useState<'EN' | 'ID'>('EN');

  const t = (en: string, idStr: string) => language === 'ID' ? idStr : en;

  useEffect(()=>{
    if(data?.profile&&new URLSearchParams(window.location.search).get('tab')==='listings')setActiveTab('listings');
  },[data?.profile]);

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
  const [bulkListingOpen, setBulkListingOpen] = useState(false);
  const [selectedShareSet, setSelectedShareSet] = useState<any>(null);

  // Local-first vault state for anonymous visitors and offline capability
  const [localVaultItems, setLocalVaultItems] = useState<CollectionItem[]>([]);
  const [vaultMarketPrices,setVaultMarketPrices]=useState<Record<string,VaultMarketPrice>>({});
  const [vaultMarketRate,setVaultMarketRate]=useState(110);
  const [vaultMarketPricesLoading,setVaultMarketPricesLoading]=useState(false);
  const [hasCustomLocalItems, setHasCustomLocalItems] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const loadLocal = () => {
      setLocalVaultItems(getLocalVaultItems());
      setHasCustomLocalItems(hasLocalVaultCustomizations());
    };
    loadLocal();
    window.addEventListener('vivreplay:vault-updated', loadLocal);
    return () => window.removeEventListener('vivreplay:vault-updated', loadLocal);
  }, []);

  useEffect(()=>{
    try{setBinderOrder(JSON.parse(window.localStorage.getItem(binderOrderStorageKey)??'[]') as string[]);}catch{setBinderOrder([]);}
  },[binderOrderStorageKey]);

  const handleBinderOrderChange=(visibleOrder:string[])=>{
    const visibleIds=new Set(visibleOrder);
    const next=[...visibleOrder,...binderOrder.filter(id=>!visibleIds.has(id))];
    setBinderOrder(next);
    try{window.localStorage.setItem(binderOrderStorageKey,JSON.stringify(next));}catch{}
  };

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
      setLanguage(window.localStorage.getItem('vivreplay-locale') === 'ID' ? 'ID' : 'EN');
    } catch {}

    const onLocale = (event: Event) => setLanguage((event as CustomEvent<'EN' | 'ID'>).detail === 'ID' ? 'ID' : 'EN');
    window.addEventListener('vivreplay:locale', onLocale);
    return () => window.removeEventListener('vivreplay:locale', onLocale);
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

  // Determine collection items: use user collection if populated, or provide local vault collection
  const collectionItems = useMemo(() => {
    if (loading) return [];
    return data?.collection ?? localVaultItems;
  }, [data, localVaultItems, loading]);

  const pricingPrintingIds=useMemo(()=>[...new Set(collectionItems.map(item=>item.printingId))].sort(),[collectionItems]);
  const pricingRequestKey=pricingPrintingIds.join(',');
  useEffect(()=>{
    if(!pricingPrintingIds.length){setVaultMarketPrices({});setVaultMarketPricesLoading(false);return}
    const controller=new AbortController();
    setVaultMarketPrices({});setVaultMarketPricesLoading(true);
    void fetch('/api/market/vault-prices',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({printingIds:pricingPrintingIds}),signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('Vault prices unavailable');return await response.json() as {prices?:Record<string,VaultMarketPrice>;jpyToIdrRate?:number}})
      .then(result=>{setVaultMarketPrices(result.prices??{});if(result.jpyToIdrRate&&Number.isFinite(result.jpyToIdrRate))setVaultMarketRate(result.jpyToIdrRate)})
      .catch(error=>{if(!(error instanceof DOMException&&error.name==='AbortError'))setVaultMarketPrices({})})
      .finally(()=>{if(!controller.signal.aborted)setVaultMarketPricesLoading(false)});
    return()=>controller.abort();
  },[pricingRequestKey]);

  // Enrich collection items with card art, estimates, gain/loss, and favorite state
  const enrichedItems: EnrichedCollectionItem[] = useMemo(() => {
    return collectionItems.map(item => enrichCollectionItem(item, favorites,vaultMarketPrices,vaultMarketRate));
  }, [collectionItems, favorites,vaultMarketPrices,vaultMarketRate]);
  const orderedShareItems=useMemo(()=>{
    const grouped=groupVaultStacks(enrichedItems);
    const rank=new Map(binderOrder.map((id,index)=>[id,index]));
    return grouped.sort((a,b)=>(rank.get(a.item.id)??Number.MAX_SAFE_INTEGER)-(rank.get(b.item.id)??Number.MAX_SAFE_INTEGER)).map(stack=>stack.item);
  },[enrichedItems,binderOrder]);

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
        const itemLanguage = printing?.language ?? item.language ?? item.card.language;
        if (itemLanguage && itemLanguage !== filters.language) return false;
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
      if (filters.color !== 'all' && !item.card.color.split(/\s*(?:\/|&|,|·)\s*|\s+/).includes(filters.color)) return false;
      // Card type
      if (filters.cardType !== 'all' && item.card.type !== filters.cardType) return false;
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
  const filteredStackCount=useMemo(()=>groupVaultStacks(filteredCollectionItems).length,[filteredCollectionItems]);

  // Slabs list
  const slabsList = useMemo(() => {
    return enrichedItems.filter(i => i.type === 'GRADED');
  }, [enrichedItems]);

  // Wishlist list
  const wishlistList = useMemo(() => data?.wishlist ?? [], [data]);

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
    if (!data) {
      updateLocalVaultItem(item.id, { quantity: item.quantity + 1 });
      toast.success(
        language === 'ID'
          ? `Menambahkan 1 salinan ke ${item.card.name} (${item.quantity + 1} total)`
          : `Added 1 copy to ${item.card.name} (${item.quantity + 1} total)`
      );
      setSelectedRawItem(null);
      return;
    }
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
    if (!data) {
      deleteLocalVaultItem(itemId);
      toast.success(
        language === 'ID' ? 'Kartu dihapus dari koleksi lokal' : 'Card removed from local Vault'
      );
      setSelectedRawItem(null);
      setSelectedSlabItem(null);
      return;
    }
    try {
      await api('/api/collection', { id: itemId }, 'DELETE');
      toast.success(language==='ID'?'Kartu dihapus dari koleksi.':'Card removed from Vault.');
      await refresh();
      setSelectedRawItem(null);
      setSelectedSlabItem(null);
    } catch {
      toast.success(language==='ID'?'Kartu dihapus dari koleksi.':'Card removed from Vault.');
      setSelectedRawItem(null);
      setSelectedSlabItem(null);
    }
  };

  const handleMoveToWishlist = async (item: EnrichedCollectionItem) => {
    if (!data) {
      toast.error(language === 'ID' ? 'Masuk untuk menambahkan kartu ke Wishlist.' : 'Sign in to add cards to your Wishlist.');
      return;
    }
    try {
      await api('/api/wishlist', { printingId: item.printingId, saved: true });
      toast.success(`Added ${item.card.name} to your Wishlist`);
      await refresh();
    } catch {
      toast.error('Could not add this card to your Wishlist. Please try again.');
    }
  };

  const handleSyncLocalToCloud = async () => {
    if (!data) return;
    setSyncing(true);
    try {
      const itemsToSync = getLocalVaultItems();
      let syncedCount = 0;
      for (const item of itemsToSync) {
        try {
          await api('/api/collection', {
            printingId: item.printingId,
            type: item.type,
            quantity: item.quantity,
            condition: item.condition,
            provider: item.provider,
            grade: item.grade,
            certification: item.certification,
            visibility: item.visibility,
            acquisitionAmount: item.acquisitionAmount,
            currency: item.currency,
            acquiredAt: item.acquiredAt,
            notes: item.notes,
            subgrades: item.subgrades,
            catalogCard: item.card ? {code:item.card.code,name:item.card.name,color:item.card.color,type:item.card.type,cost:item.card.cost,power:item.card.power,rarity:item.rarity??item.card.rarity,effect:item.card.effect,setCode:item.setCode??item.card.setCode,language:item.language??item.card.language,variant:item.variant??item.card.variant,printingCode:item.printingCode??item.card.printingCode,imageUrl:item.card.imageUrl}:undefined,
          }, 'POST');
          syncedCount++;
        } catch {}
      }
      clearLocalVault();
      setHasCustomLocalItems(false);
      toast.success(
        language === 'ID'
          ? `Berhasil menyinkronkan ${syncedCount} kartu ke akun Anda!`
          : `Successfully synced ${syncedCount} cards to your account!`
      );
      await refresh();
    } catch {
      toast.error(
        language === 'ID'
          ? 'Gagal menyinkronkan koleksi lokal ke akun.'
          : 'Failed to sync local collection to account.'
      );
    } finally {
      setSyncing(false);
    }
  };

  const username = data?.profile?.username || (language === 'ID' ? 'kolektor-tamu' : 'guest-collector');

  if (loading) return <main className="page vault-page vault-loading-page" aria-busy="true" aria-live="polite"><VivreMark size={42} label="VivrePlay"/><h1>{t('Opening your Vault…','Membuka koleksi…')}</h1><p>{t('Loading your saved cards and collection details.','Memuat kartu tersimpan dan detail koleksi Anda.')}</p><div className="vault-loading-grid" aria-hidden="true">{Array.from({length:6},(_,index)=><i key={index}/>)}</div></main>;
  if (!data && error && !/sign in to save/i.test(error)) return <main className="page vault-loading-page vault-error-page" role="alert"><VivreMark size={42} label="VivrePlay"/><h1>{t('Your Vault could not load','Koleksi Anda tidak dapat dimuat')}</h1><p>{error}</p><button type="button" className="vault-btn vault-btn-primary" onClick={()=>void refresh()}>{t('Try again','Coba lagi')}</button></main>;

  return (
    <main className="page vault-page">
      {/* Guest Mode Banner (when not logged in) */}
      {!data && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          marginBottom: '20px',
          borderRadius: '12px',
          background: 'var(--vault-panel)',
          border: '1px solid var(--vault-border)',
          color: 'var(--vault-ink-secondary)',
          fontSize: '12.5px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <Save size={18} color="var(--vault-gold)" weight="fill" />
            <span>
              {language === 'ID'
                ? 'Mode koleksi lokal: data Anda disimpan di browser ini. Masuk untuk mencadangkannya ke cloud dan membagikan koleksi.'
                : 'Local Vault Mode: Your collection is saved on this browser. Sign in to back up to the cloud and share your vault.'}
            </span>
          </div>
          <button
            type="button"
            className="vault-btn vault-btn-primary"
            style={{ height: '30px', fontSize: '11.5px', padding: '0 14px' }}
            onClick={() => window.dispatchEvent(new CustomEvent('vivreplay:open-auth', { detail: 'sign-in' }))}
          >
            {language === 'ID' ? 'Masuk' : 'Sign in'}
          </button>
        </div>
      )}

      {/* Cloud Sync Prompt (when logged in and has local guest items) */}
      {data && hasCustomLocalItems && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          marginBottom: '20px',
          borderRadius: '12px',
          background: 'rgba(198, 138, 44, 0.1)',
          border: '1px solid var(--vault-gold)',
          color: 'var(--vault-ink)',
          fontSize: '12.5px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <Upload size={18} color="var(--vault-gold)" weight="bold" />
            <span>
              {language === 'ID'
                ? 'Ditemukan kartu dari sesi tamu di perangkat ini. Gabungkan ke vault cloud akun Anda?'
                : 'Found cards saved locally from your guest session. Merge them into your cloud vault?'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSyncLocalToCloud}
              disabled={syncing}
              className="vault-btn vault-btn-primary"
              style={{ height: '30px', fontSize: '11.5px', padding: '0 14px' }}
            >
              {syncing
                ? (language === 'ID' ? 'Menyinkronkan...' : 'Syncing...')
                : (language === 'ID' ? 'Sinkronkan Sekarang' : 'Sync to Cloud')}
            </button>
            <button
              type="button"
              onClick={() => { clearLocalVault(); setHasCustomLocalItems(false); }}
              className="vault-btn vault-btn-secondary"
              style={{ height: '30px', fontSize: '11.5px', padding: '0 12px' }}
            >
              {language === 'ID' ? 'Abaikan' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}
      {/* Vault Header & Key Metrics Bar */}
      <VaultHeader
        stats={stats}
        username={username}
        privacy={privacy}
        hideValues={hideValues}
        isPricingLoading={vaultMarketPricesLoading}
        language={language}
        onToggleHideValues={handleToggleHideValues}
        onOpenQuickAdd={() => setQuickAddOpen(true)}
        onOpenFullAdd={() => { setEditingItem(null); setFullAddOpen(true); }}
        onOpenPrivacyModal={() => setPrivacyModalOpen(true)}
        onOpenShareModal={() => setShareModalOpen(true)}
        onOpenImportExport={() => setImportExportOpen(true)}
      />

      {/* Vault Navigation Tabs */}
      <nav className="vault-nav-tabs" aria-label={t('Vault tabs','Tab koleksi')}>
        <button
          type="button"
          className={`vault-tab-btn ${activeTab === 'collection' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('collection')}
        >
          <BookOpen size={16} />
          {t('Collection','Koleksi')}
          <span className="vault-tab-count">{enrichedItems.length}</span>
        </button>

        {data?.profile && <button
          type="button"
          className={`vault-tab-btn ${activeTab === 'listings' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('listings')}
        >
          <Storefront size={16} />
          {t('My listings','Listing saya')}
        </button>}

        <button
          type="button"
          className={`vault-tab-btn ${activeTab === 'slabs' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('slabs')}
        >
          <ShieldCheck size={16} />
          {t('Slabs','Slab')}
          <span className="vault-tab-count">{slabsList.length}</span>
        </button>

        <button
          type="button"
          className={`vault-tab-btn ${activeTab === 'sets' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('sets')}
        >
          <Layers3 size={16} />
          {t('Sets','Set')}
          <span className="vault-tab-count">{setProgressList.length}</span>
        </button>

        <button
          type="button"
          className={`vault-tab-btn ${activeTab === 'wishlist' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('wishlist')}
        >
          <Heart size={16} />
          {t('Wishlist','Kartu incaran')}
          <span className="vault-tab-count">{wishlistList.length}</span>
        </button>

        <button
          type="button"
          className={`vault-tab-btn ${activeTab === 'portfolio' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('portfolio')}
        >
          <TrendingUp size={16} />
          {t('Portfolio','Portofolio')}
        </button>

        <button
          type="button"
          className={`vault-tab-btn ${activeTab === 'activity' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <Clock size={16} />
          {t('Activity','Aktivitas')}
        </button>
      </nav>

      {/* Tab 1: Collection */}
      {activeTab === 'collection' && (
        <section style={{ marginTop: '16px' }}>
          {data?.profile && <div className="vault-bulk-listing-launch-row"><p>{t('Combine selected Vault cards into one Market listing.','Gabungkan beberapa kartu koleksi menjadi satu listing Market.')}</p><button type="button" className="vault-btn vault-btn-secondary" onClick={()=>setBulkListingOpen(true)}><Storefront size={16}/>{t('Create bundle listing','Buat listing bundle')}</button></div>}
          <VaultFilters
            filters={filters}
            onChangeFilters={setFilters}
            viewMode={viewMode}
            onChangeViewMode={handleViewModeChange}
            totalFilteredCount={filteredStackCount}
            language={language}
          />

          {filteredCollectionItems.length === 0 ? (
            <div className="vault-empty-state">
              <div className="vault-empty-slot-composition">
                <div className="vault-empty-dummy-slot" aria-hidden="true" />
                <div className="vault-empty-dummy-slot">
                  <Search size={24} />
                </div>
                <div className="vault-empty-dummy-slot" aria-hidden="true" />
              </div>
              <h2>{enrichedItems.length===0?t('Your Vault is empty','Koleksi Anda masih kosong'):t('No cards match','Tidak ada kartu yang cocok')}</h2>
              <p>{enrichedItems.length===0?t('Add a card printing to start your collection.','Tambahkan cetakan kartu untuk memulai koleksi Anda.'):t('Clear a filter or change your search.','Hapus filter atau ubah pencarian Anda.')}</p>
              {enrichedItems.length===0?<button type="button" className="vault-btn vault-btn-primary" onClick={()=>setQuickAddOpen(true)}>{t('Find a card to add','Cari kartu untuk ditambahkan')}</button>:<button
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
                {t('Clear Filters','Hapus Filter')}
              </button>}
            </div>
          ) : viewMode === 'binder' ? (
            <BinderView
              items={filteredCollectionItems}
              hideValues={hideValues}
              onSelectItem={handleSelectItem}
              onToggleFavorite={handleToggleFavorite}
              onAddNewCard={() => setFullAddOpen(true)}
              onSaved={refresh}
              isAnonymous={!data}
              savedOrder={binderOrder}
              onOrderChange={handleBinderOrderChange}
              gridSizeStorageKey={`${binderOrderStorageKey}:grid-size`}
            />
          ) : viewMode === 'grid' ? (
            <GridView
              items={filteredCollectionItems}
              hideValues={hideValues}
              onSelectItem={handleSelectItem}
              onToggleFavorite={handleToggleFavorite}
              onSaved={refresh}
              isAnonymous={!data}
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

      {activeTab === 'listings' && data?.profile && <section style={{marginTop:'16px'}}><ListingsTab language={language}/></section>}

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
            language={language}
            progressList={setProgressList}
            items={enrichedItems}
            onShareProgress={set => {
              setSelectedShareSet(set);
              setShareModalOpen(true);
            }}
            onFindMissingInMarket={handleFindListings}
            onSelectItem={handleSelectItem}
            wishlistSetCodes={wishlistList.map(item=>item.card?.setCode??'').filter(Boolean)}
          />
        </section>
      )}

      {/* Tab 4: Wishlist */}
      {activeTab === 'wishlist' && (
        <section style={{ marginTop: '24px' }}>
          <WishlistTab
            wishlist={wishlistList}
            language={language}
            onUpdated={refresh}
            onRemoveFromWishlist={async (printingId) => {
              try {
                await api('/api/wishlist', { printingId, saved: false });
                toast.success(t('Removed from wishlist','Dihapus dari kartu incaran'));
                await refresh();
              } catch (error) {
                toast.error(error instanceof Error?error.message:t('Could not remove card','Kartu gagal dihapus'));
              }
            }}
          />
        </section>
      )}

      {/* Tab 5: Portfolio */}
      {activeTab === 'portfolio' && (
        <section style={{ marginTop: '24px' }}>
          <PortfolioTab
            language={language}
            stats={stats}
            items={enrichedItems}
            hideValues={hideValues}
            isPricingLoading={vaultMarketPricesLoading}
          />
        </section>
      )}

      {/* Tab 6: Activity */}
      {activeTab === 'activity' && (
        <section style={{ marginTop: '24px' }}>
          <ActivityTab language={language} />
        </section>
      )}

      {/* Modals & Dialogs */}
      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onItemAdded={refresh}
        isAnonymous={!data}
        language={language}
      />

      <AddEditItemModal
        key={`${editingItem?.id ?? 'new'}-${fullAddOpen?'open':'closed'}`}
        open={fullAddOpen}
        onClose={() => { setFullAddOpen(false); setEditingItem(null); }}
        onSaved={refresh}
        editingItem={editingItem}
        isAnonymous={!data}
        language={language}
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
        canManagePhotos={Boolean(data?.profile)}
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
        items={orderedShareItems}
        hideValues={hideValues}
        selectedSlab={selectedSlabItem}
        selectedSet={selectedShareSet}
        language={language}
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
      <BulkListingModal open={bulkListingOpen} onClose={()=>setBulkListingOpen(false)} stacks={groupVaultStacks(enrichedItems)} language={language} onPublished={async()=>{await refresh()}} />
    </main>
  );
}
