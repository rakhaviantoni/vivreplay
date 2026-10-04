'use client';

import type { CollectionItem } from '@/packages/domain';

const LOCAL_VAULT_KEY = 'vivreplay-local-vault';
const LOCAL_VAULT_MODIFIED_KEY = 'vivreplay-local-vault-modified';

/**
 * Load collection items from localStorage.
 * If none exists, initializes with an empty collection.
 */
export function getLocalVaultItems(): CollectionItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_VAULT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized: CollectionItem[] = [];
        for (const item of parsed as CollectionItem[]) {
          if (item.type !== 'RAW') { normalized.push(item); continue; }
          const existing = normalized.find(candidate => candidate.type === 'RAW' && candidate.printingId === item.printingId && candidate.condition === item.condition && candidate.currency === item.currency);
          if (!existing) { normalized.push(item); continue; }
          existing.quantity += item.quantity;
          existing.acquisitionAmount += item.acquisitionAmount;
          if (existing.visibility === 'private' || item.visibility === 'private') existing.visibility = 'private';
          else if (existing.visibility === 'marketplace-only' || item.visibility === 'marketplace-only') existing.visibility = 'marketplace-only';
          existing.notes = [...new Set([existing.notes?.trim(), item.notes?.trim()].filter((value): value is string => Boolean(value)))].join('\n').slice(0, 2000) || null;
        }
        if (normalized.length !== parsed.length) window.localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(normalized));
        return normalized;
      }
    }
    window.localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify([]));
    return [];
  } catch {
    return [];
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
  if (item.type === 'RAW') {
    const stack = items.find(existing => existing.type === 'RAW' && existing.printingId === item.printingId && existing.condition === item.condition && existing.currency === item.currency);
    if (stack) {
      const visibility: CollectionItem['visibility'] = stack.visibility === 'private' || item.visibility === 'private' ? 'private' : stack.visibility === 'marketplace-only' || item.visibility === 'marketplace-only' ? 'marketplace-only' : 'public';
      const notes = [...new Set([stack.notes?.trim(), item.notes?.trim()].filter((value): value is string => Boolean(value)))].join('\n').slice(0, 2000) || null;
      const next = items.map(existing => existing.id === stack.id ? {
        ...existing,
        quantity: existing.quantity + item.quantity,
        acquisitionAmount: existing.acquisitionAmount + item.acquisitionAmount,
        visibility,
        notes,
      } : existing);
      saveLocalVaultItems(next);
      return next.find(existing => existing.id === stack.id)!;
    }
  }
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

export function updateLocalVaultItems(ids:string[],updates:Partial<CollectionItem>):CollectionItem[]{
  const selected=new Set(ids);
  const next=getLocalVaultItems().map(item=>selected.has(item.id)?{...item,...updates}:item);
  saveLocalVaultItems(next);
  return getLocalVaultItems();
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
