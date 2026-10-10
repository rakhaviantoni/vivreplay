import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../lib/card-catalog-cache.ts', import.meta.url);
const source = readFileSync(path, 'utf8');
const revision = new Date().toISOString().replace(/[-:.TZ]/g, '');
const updated = source.replace(
  /export const CARD_CATALOG_CACHE_REVISION = '[^']+';/,
  `export const CARD_CATALOG_CACHE_REVISION = '${revision}';`,
);
if (updated === source) throw new Error('Could not find the card catalog cache revision.');
writeFileSync(path, updated);
console.log(`Card catalog and play-rules cache revision bumped to ${revision}.`);
