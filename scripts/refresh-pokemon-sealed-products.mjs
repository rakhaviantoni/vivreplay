import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const USER_AGENT = 'VivrePlayCatalogSync/1.0';
const OUTPUT_PATH = path.resolve(process.cwd(), 'packages/card-data/pokemon-sealed-products.json');
const MIN_YEAR = process.argv.includes('--all') ? 1998 : 2022;

const SOURCES = [
  { categoryId: 3, edition: 'global', label: 'EN' },
  { categoryId: 85, edition: 'asia', label: 'JP' },
];

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

function classifyProductKind(name) {
  const lower = name.toLowerCase();
  if (/\bsleeve/i.test(lower)) return 'SLEEVE';
  if (/\bplaymat/i.test(lower)) return 'PLAYMAT';
  if (/\bbinder|portfolio/i.test(lower)) return 'BINDER';
  if (/\bdeck box|storage|case\b/i.test(lower) && !/\bbooster box\b/i.test(lower)) return 'STORAGE';
  if (/\bmini tin\b|\btin\b/i.test(lower)) return 'MINI_TIN';
  if (/\b(battle|starter|theme|league|ex|v|deluxe)\s+deck\b|\bdeck set\b/i.test(lower)) return 'STARTER_DECK';
  if (/\belite trainer box\b|\betb\b|\bultra-?premium\b|\bpremium\b/i.test(lower)) return 'PREMIUM_COLLECTION';
  if (/\bbooster box\b|\bdisplay box\b|\bhalf booster box\b/i.test(lower)) return 'BOOSTER_BOX';
  if (/\bbooster pack\b|\bsleeved booster\b|\bpack\b/i.test(lower) && !/\bblister\b|\bcollection\b|\bbundle\b/i.test(lower)) return 'BOOSTER_PACK';
  if (/\bcollection\b|\bbundle\b|\bblister\b|\bbox\b/i.test(lower)) return 'CARD_COLLECTION';
  return 'OTHER';
}

function stripHtml(raw) {
  if (!raw || typeof raw !== 'string') return undefined;
  const text = raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return undefined;
  return text.length > 220 ? `${text.slice(0, 217).trim()}...` : text;
}

function isSealedCandidate(product) {
  const name = product.name ?? '';
  if (!name || !product.imageUrl) return false;
  const ext = Array.isArray(product.extendedData) ? product.extendedData : [];
  if (ext.some((entry) => entry.name === 'Number' || entry.name === 'Rarity')) {
    return false;
  }
  if (/code card|tcg live|tcg online|empty |empty box|divider|pin only|coin only|dice only/i.test(name)) {
    return false;
  }
  if (/\bcase\b/i.test(name) && !/\bdeck box\b/i.test(name)) {
    // Skip wholesale master cases (e.g. "Booster Box Case")
    return false;
  }
  return true;
}

async function run() {
  const records = [];
  const seenIds = new Set();

  for (const source of SOURCES) {
    const groupsPayload = await fetchJson(`https://tcgcsv.com/tcgplayer/${source.categoryId}/groups`);
    const groups = (groupsPayload.results ?? []).filter((g) => {
      if (!g.publishedOn) return true;
      const year = Number(String(g.publishedOn).slice(0, 4));
      return !Number.isFinite(year) || year >= MIN_YEAR;
    });

    console.log(`[${source.label}] Scanning ${groups.length} groups (${MIN_YEAR}+)...`);

    const BATCH = 6;
    for (let i = 0; i < groups.length; i += BATCH) {
      const slice = groups.slice(i, i + BATCH);
      const results = await Promise.all(
        slice.map(async (group) => {
          try {
            const payload = await fetchJson(
              `https://tcgcsv.com/tcgplayer/${source.categoryId}/${group.groupId}/products`
            );
            return { group, products: payload.results ?? [] };
          } catch {
            return { group, products: [] };
          }
        })
      );

      for (const { group, products } of results) {
        for (const product of products) {
          if (!isSealedCandidate(product)) continue;
          const id = `sealed:pokemon:${source.edition}:${product.productId}`;
          if (seenIds.has(id)) continue;
          seenIds.add(id);

          const rawDate = product.presaleInfo?.releasedOn || group.publishedOn || '';
          const releaseDate = rawDate ? String(rawDate).slice(0, 10) : undefined;
          const cardText = (product.extendedData ?? []).find((e) => e.name === 'CardText')?.value;

          records.push({
            id,
            name: product.name,
            displayName: product.name,
            kind: classifyProductKind(product.name),
            setCode: group.abbreviation || '',
            edition: source.edition,
            imageUrl: product.imageUrl,
            sourceUrl: product.url || `https://www.tcgplayer.com/product/${product.productId}`,
            ...(releaseDate ? { releaseDate } : {}),
            ...(stripHtml(cardText) ? { contents: stripHtml(cardText) } : {}),
          });
        }
      }
    }
  }

  records.sort(
    (a, b) =>
      (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || a.name.localeCompare(b.name)
  );

  await writeFile(OUTPUT_PATH, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  console.log(`Saved ${records.length} Pokemon sealed products to ${OUTPUT_PATH}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
