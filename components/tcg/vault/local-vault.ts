'use client';

import type { CollectionItem } from '@/packages/domain';
import { getDefaultCollectorSeed } from './vault-utils';

const LOCAL_VAULT_KEY = 'vivreplay-local-vault';
const LOCAL_VAULT_MODIFIED_KEY = 'vivreplay-local-vault-modified';

/**
 * Load collection items from localStorage.
 * If none exists, initializes with the default collector seed.
 */
export function getLocalVaultItems(): CollectionItem[] {
  if (typeof window === 'undefined') return getDefaultCollectorSeed();
  try {
    const raw = window.localStorage.getItem(LOCAL_VAULT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    // Initialize with default collector seed so visitors have an inspiring starting vault
    const seed = getDefaultCollectorSeed();
    window.localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(seed));
    return seed;
  } catch {
    return getDefaultCollectorSeed();
  }
}

/**
 * Save collection items array to localStorage and notify listeners.
 */
export function saveLocalVaultItems(items: CollectionItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(items));
    window.localStorage.setItem(LOCAL_VAULT_MODIFIED_KEY, 'true');
    window.dispatchEvent(new CustomEvent('vivreplay:vault-updated'));
  } catch {}
}

/**
 * Add a new item to the local vault.
 */
export function addLocalVaultItem(item: Omit<CollectionItem, 'id'> & { id?: string }): CollectionItem {
  const items = getLocalVaultItems();
  const newItem: CollectionItem = {
    ...item,
    id: item.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  const next = [newItem, ...items];
  saveLocalVaultItems(next);
  return newItem;
}

/**
 * Update an existing item in the local vault.
 */
export function updateLocalVaultItem(id: string, updates: Partial<CollectionItem>): CollectionItem[] {
  const items = getLocalVaultItems();
  const next = items.map(item => (item.id === id ? { ...item, ...updates } : item));
  saveLocalVaultItems(next);
  return next;
}

/**
 * Delete an item from the local vault.
 */
export function deleteLocalVaultItem(id: string): CollectionItem[] {
  const items = getLocalVaultItems();
  const next = items.filter(item => item.id !== id);
  saveLocalVaultItems(next);
  return next;
}

/**
 * Check if the user has made any additions or modifications to the local vault.
 */
export function hasLocalVaultCustomizations(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LOCAL_VAULT_MODIFIED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Clear local vault data (used after syncing to cloud account).
 */
export function clearLocalVault(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LOCAL_VAULT_KEY);
    window.localStorage.removeItem(LOCAL_VAULT_MODIFIED_KEY);
    window.dispatchEvent(new CustomEvent('vivreplay:vault-updated'));
  } catch {}
}
