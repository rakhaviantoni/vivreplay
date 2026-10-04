import type { Card } from '@/packages/card-data/catalog';
import type { CollectionItem } from '@/packages/domain';

export type VaultViewMode = 'binder' | 'grid' | 'list';

export type VaultTab = 'collection' | 'listings' | 'slabs' | 'sets' | 'wishlist' | 'portfolio' | 'activity';

export type VaultPrinting = {id:string;language:string;variant:string;printing_code?:string;card_image_url?:string|null;rarity?:string;set_code?:string};
export type VaultCard = Card & {availablePrintings?:VaultPrinting[]};
export type VaultMarketPrice={amount:number;currency:string;observedAt:string;observationCount:number;previousAmount:number|null;previousCurrency:string|null;previousObservedAt:string|null;source?:'yuyutei'|'pricecharting';sourceUrl?:string};

export type PrivacySettings = {
  collection: 'public' | 'private';
  portfolioValue: 'public' | 'private';
  slabs: 'public' | 'private';
};

export type VaultFilterState = {
  search: string;
  setCode: string;
  language: string;
  rarity: string;
  cardType: string;
  color: string;
  typeFilter: 'all' | 'raw' | 'graded';
  gradingProvider: string;
  grade: string;
  ownership: 'all' | 'owned' | 'missing';
  forSaleOnly: boolean;
  favoritesOnly: boolean;
  sort: 'set_order' | 'recently_added' | 'value_high' | 'value_low' | 'name' | 'grade';
};

export type VaultStats = {
  totalCards: number;
  uniqueIdentities: number;
  slabsCount: number;
  rawCount: number;
  totalAcquisitionCost: number;
  estimatedValue: number;
  unrealizedChangeAmount: number;
  unrealizedChangePercent: number | null;
  change30DayPercent: number | null;
  change30DayCount:number;
  marketPricedCount:number;
  valuedAcquisitionCost:number;
  observationCount: number;
  lastUpdated: string | null;
};

export type EnrichedCollectionItem = CollectionItem & {
  card: VaultCard;
  estimatedValue: number;
  gainLossAmount: number;
  gainLossPercent: number;
  hasMarketEstimate:boolean;
  marketPricePerCard:number|null;
  marketPriceCurrency:string|null;
  marketPriceSource:'yuyutei'|'pricecharting'|null;
  marketPriceUrl:string|null;
  marketObservedAt:string|null;
  marketObservationsCount:number;
  marketPreviousValue:number|null;
  observationsCount: number;
  isFavorite?: boolean;
};

export type VaultStackGroup = {
  item: EnrichedCollectionItem;
  items: EnrichedCollectionItem[];
  quantity: number;
  estimatedValue: number;
  languageLabel: string;
  conditionLabel: string;
  printingLabel: string;
};

export type SetProgress = {
  code: string;
  name: string;
  releaseYear: number;
  totalCards: number;
  ownedCount: number;
  percentage: number;
  mainSetOwned: number;
  mainSetTotal: number;
  parallelsOwned: number;
  parallelsTotal: number;
  isComplete: boolean;
};
