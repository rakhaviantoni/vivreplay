'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MagnifyingGlassIcon as Search, ArrowUpRightIcon } from '@phosphor-icons/react';
import { CardArt } from '@/components/tcg/card-art';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type GameCard = {
  id: string; rarity: string; variant: string; set_code: string; set_name: string; printing_code: string;
  language: string; attribute?: string; card_image_url?: string | null;
  tcg_card_identities?: { code: string; name: string; color: string; card_type: string; cost: number; power: number; effect_text: string };
};
type SetRecord = { code: string; name: string };
type DisplayCard = { id: string; code: string; name: string; color: string; type: 'Character'; cost: number; power: number; rarity: string; art: number; effect: string; imageUrl?: string; setCode?: string; language?: string; printingCode?: string; variant?: string };

const languages = ['ID', 'EN', 'JP'] as const;
type Language = typeof languages[number];

export function PokemonLibrary({ initialSet }: { initialSet?: string }) {
  const [language, setLanguage] = useState<Language>('ID');
  const [cards, setCards] = useState<GameCard[]>([]);
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState('');
  const [setFilter, setSetFilter] = useState(initialSet ?? 'all');
  const [selected, setSelected] = useState<GameCard | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/cards/catalog?game=pokemon&language=${language}&limit=240&offset=0`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Catalog unavailable');
        const result = await response.json() as { cards?: GameCard[] };
        setCards(result.cards ?? []);
        setHasMore((result.cards?.length ?? 0) === 240);
      })
      .catch(error => { if (error.name !== 'AbortError') setCards([]); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    fetch(`/api/cards/sets?game=pokemon&language=${language}`, { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<{ sets?: SetRecord[] }> : { sets: [] })
      .then(result => setSets(result.sets ?? []))
      .catch(error => { if (error.name !== 'AbortError') setSets([]); });
    return () => controller.abort();
  }, [language]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/cards/catalog?game=pokemon&language=${language}&limit=240&offset=${cards.length}`);
      if (!response.ok) throw new Error('Catalog unavailable');
      const result = await response.json() as { cards?: GameCard[] };
      const next = result.cards ?? [];
      setCards(current => [...current, ...next]);
      setHasMore(next.length === 240);
    } finally { setLoadingMore(false); }
  };
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return cards.filter(card => {
      const identity = card.tcg_card_identities;
      const matchesQuery = !needle || [identity?.name, identity?.code, card.printing_code, card.set_code, card.set_name, card.rarity, identity?.card_type].some(value => String(value ?? '').toLocaleLowerCase().includes(needle));
      return matchesQuery && (setFilter === 'all' || card.set_code === setFilter);
    });
  }, [cards, query, setFilter]);

  const displayCard = (card: GameCard): DisplayCard => ({
    id: card.id,
    code: card.tcg_card_identities?.code ?? card.printing_code,
    name: card.tcg_card_identities?.name ?? card.printing_code,
    color: 'Yellow',
    type: 'Character',
    cost: 0,
    power: card.tcg_card_identities?.power ?? 0,
    rarity: card.rarity,
    art: 0,
    effect: card.tcg_card_identities?.effect_text ?? '',
    imageUrl: card.card_image_url ?? undefined,
    setCode: card.set_code,
    language: card.language,
    printingCode: card.printing_code,
    variant: card.variant,
  });

  return <main className="page catalog-page pokemon-catalog-page">
    <section className="library-intro">
      <div className="library-intro-copy">
        <p className="kicker">POKÉMON TCG</p>
        <h1>Explore the card library.</h1>
        <p>Browse sets and printings in Indonesian, English, and Japanese.</p>
      </div>
      <div className="pokemon-intro-mark" aria-hidden="true"><span>Pokémon</span><b>TCG</b></div>
    </section>
    <section className="library-controls pokemon-library-controls" aria-label="Pokémon card filters">
      <label className="search-box"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, card number, rarity, or set"/></label>
      <div className="pokemon-library-filters">
        <label className="pokemon-set-filter"><span>Set</span><select value={setFilter} onChange={event => setSetFilter(event.target.value)}><option value="all">All sets</option>{sets.map(set => <option key={set.code} value={set.code}>{set.name} ({set.code})</option>)}</select></label>
        <div className="language-switch" aria-label="Card language">{languages.map(option => <button type="button" key={option} aria-pressed={language === option} onClick={() => { setLoading(true); setLanguage(option); }}>{option}</button>)}</div>
      </div>
    </section>
    <div className="pokemon-library-count" aria-live="polite">{loading ? ' ' : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? 'card' : 'cards'}`}</div>
    {loading ? <div className="pokemon-card-grid" aria-label="Loading Pokémon cards">{Array.from({ length: 12 }, (_, index) => <i key={index}/>)}</div> : filtered.length ? <div className="pokemon-card-grid">{filtered.map(card => {
      const display = displayCard(card);
      return <button type="button" className="pokemon-card-tile" key={`${card.id}:${card.language}`} onClick={() => setSelected(card)}>
        <CardArt card={display}/>
        <span><strong>{display.name}</strong><small>{card.printing_code} <i/> {card.rarity}</small></span>
      </button>;
    })}</div> : <section className="empty-state pokemon-empty"><h2>{cards.length ? 'No cards match these filters.' : 'No Pokémon cards are available in this language yet.'}</h2>{cards.length>0&&<p>Try a shorter search or choose another set.</p>}</section>}
    {!loading && hasMore && <button type="button" className="pokemon-load-more" onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore}>{loadingMore ? ' ' : 'Load more cards'}</button>}
    <nav className="pokemon-library-links" aria-label="Pokémon catalog sections"><Link href="/pokemon/sets">Browse sets <ArrowUpRightIcon size={15}/></Link><a href="https://github.com/tcgdex/cards-database" target="_blank" rel="noreferrer">Card data from TCGdex <ArrowUpRightIcon size={15}/></a></nav>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="pokemon-card-dialog">
        {selected && <div className="pokemon-card-dialog-layout"><CardArt card={displayCard(selected)} priority/><div><DialogHeader><p className="kicker">{selected.set_name}</p><DialogTitle>{selected.tcg_card_identities?.name ?? selected.printing_code}</DialogTitle><DialogDescription>Printing {selected.printing_code}, {selected.language}. Rarity: {selected.rarity}.</DialogDescription></DialogHeader>{selected.tcg_card_identities?.effect_text && <div className="pokemon-card-effect"><h3>Card text</h3><p>{selected.tcg_card_identities.effect_text}</p></div>}</div></div>}
      </DialogContent>
    </Dialog>
  </main>;
}
