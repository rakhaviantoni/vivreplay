import type { Card } from '@/packages/card-data/catalog';
import type { CollectionItem } from '@/packages/domain';

export type VaultViewMode = 'binder' | 'grid' | 'list';

export type VaultTab = 'collection' | 'slabs' | 'sets' | 'wishlist' | 'portfolio' | 'activity';

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
  unrealizedChangePercent: number;
  change30DayPercent: number;
  valuationConfidence: 'high' | 'medium' | 'low';
  observationCount: number;
  lastUpdated: string;
};

export type EnrichedCollectionItem = CollectionItem & {
  card: Card;
  estimatedValue: number;
  gainLossAmount: number;
  gainLossPercent: number;
  confidence: 'high' | 'medium' | 'low';
  observationsCount: number;
  isFavorite?: boolean;
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
