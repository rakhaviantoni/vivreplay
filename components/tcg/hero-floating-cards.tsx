'use client';

import { useEffect, useState } from 'react';
import { cardPrintingImageUrl } from '@/components/tcg/card-art';

type FloatingCardItem = {
  id: string;
  src: string;
  game: 'onepiece' | 'pokemon';
};

type CatalogRow = {
  id?: string | null;
  assetPath?: string | null;
  imageUrl?: string | null;
  setCode?: string | null;
  language?: string | null;
  printingCode?: string | null;
  localCardNumber?: string | null;
  code?: string | null;
  gameSlug?: string | null;
};

let cachedPool: FloatingCardItem[] | null = null;
let inflightPool: Promise<FloatingCardItem[]> | null = null;

function shuffleSample<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function extractRows(payload: unknown): CatalogRow[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = payload as Record<string, unknown>;
  if (Array.isArray(data.cards)) return data.cards as CatalogRow[];
  if (Array.isArray(data.items)) return data.items as CatalogRow[];
  if (Array.isArray(data.printings)) return data.printings as CatalogRow[];
  return [];
}

async function fetchPool(): Promise<FloatingCardItem[]> {
  if (cachedPool && cachedPool.length > 0) return cachedPool;
  if (inflightPool) return inflightPool;

  inflightPool = (async () => {
    try {
      const [opRes, pkRes] = await Promise.allSettled([
        fetch('/api/cards/catalog?language=EN&q=Luffy&limit=10').then((r) =>
          r.ok ? r.json() : null
        ),
        fetch('/api/cards/catalog?game=pokemon&language=EN&q=Charizard&limit=10').then((r) =>
          r.ok ? r.json() : null
        ),
      ]);

      const pool: FloatingCardItem[] = [];
      const seen = new Set<string>();

      const pushRows = (rows: CatalogRow[], game: 'onepiece' | 'pokemon') => {
        for (const row of rows) {
          const src = cardPrintingImageUrl({ ...row, gameSlug: row.gameSlug ?? game });
          const key = row.id || src;
          if (!src || !key || seen.has(key)) continue;
          seen.add(key);
          pool.push({ id: `${game}-${key}`, src, game });
        }
      };

      if (opRes.status === 'fulfilled') pushRows(extractRows(opRes.value), 'onepiece');
      if (pkRes.status === 'fulfilled') pushRows(extractRows(pkRes.value), 'pokemon');

      if (pool.length > 0) cachedPool = pool;
      return pool;
    } catch {
      return [];
    } finally {
      inflightPool = null;
    }
  })();

  return inflightPool;
}

export function HeroFloatingCards({
  count = 4,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  const [cards, setCards] = useState<FloatingCardItem[]>([]);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    fetchPool().then((pool) => {
      if (!active || pool.length === 0) return;
      const op = shuffleSample(
        pool.filter((item) => item.game === 'onepiece'),
        Math.ceil(count / 2)
      );
      const pk = shuffleSample(
        pool.filter((item) => item.game === 'pokemon'),
        Math.floor(count / 2)
      );
      const combined = shuffleSample([...op, ...pk], count);
      setCards(combined.length > 0 ? combined : shuffleSample(pool, count));
    });
    return () => {
      active = false;
    };
  }, [count]);

  const visible = cards.filter((c) => !broken[c.id]);
  if (visible.length === 0) return null;

  return (
    <div className={`hero-floating-cards${className ? ` ${className}` : ''}`} aria-hidden="true">
      {visible.map((card, index) => (
        <div key={card.id} className={`hero-floating-card hero-floating-card--${index + 1}`}>
          <img
            src={card.src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken((prev) => ({ ...prev, [card.id]: true }))}
          />
        </div>
      ))}
    </div>
  );
}
