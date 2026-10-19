'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MagnifyingGlassIcon as Search, ArrowUpRightIcon } from '@phosphor-icons/react';
import { CardArt } from '@/components/tcg/card-art';
import { PokemonCardText } from '@/components/tcg/pokemon-card-text';
import { MultiFilter } from '@/components/tcg/catalog';
import { versionedCardCatalogUrl } from '@/lib/card-catalog-cache';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type GameCard = {
  id: string; rarity: string; variant: string; set_code: string; set_name: string; printing_code: string;
  language: string; attribute?: string; card_image_url?: string | null;
  source_payload?: { illustrator?: string; [key: string]: unknown };
  tcg_card_identities?: { code: string; name: string; color: string; card_type: string; cost: number; power: number; effect_text: string };
};
type SetRecord = { code: string; name: string };
type DisplayCard = { id: string; code: string; name: string; color: string; type: 'Character'; cost: number; power: number; rarity: string; art: number; effect: string; imageUrl?: string; setCode?: string; language?: string; printingCode?: string; variant?: string };

const languages = ['ID', 'EN', 'JP'] as const;
type Language = typeof languages[number];

export function PokemonLibrary({ initialSet, initialQuery }: { initialSet?: string; initialQuery?: string }) {
  const pathname = usePathname();
  const id = pathname === '/id' || pathname.startsWith('/id/');
  const localize = (href: string) => id ? `/id${href}` : href;
  const [language, setLanguage] = useState<Language>('ID');
  const [cards, setCards] = useState<GameCard[]>([]);
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [rarities, setRarities] = useState<string[]>([]);
  const [illustrators, setIllustrators] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState(initialQuery ?? '');
  const [searchQuery, setSearchQuery] = useState(initialQuery ?? '');
  const [setFilters, setSetFilters] = useState<string[]>(() => initialSet ? [initialSet] : []);
  const [rarityFilters, setRarityFilters] = useState<string[]>([]);
  const [illustratorFilters, setIllustratorFilters] = useState<string[]>([]);
  const [selected, setSelected] = useState<GameCard | null>(null);

  useEffect(() => { setQuery(initialQuery ?? ''); setSearchQuery(initialQuery ?? ''); }, [initialQuery]);
  useEffect(() => { setSetFilters(initialSet ? [initialSet] : []); }, [initialSet]);
  useEffect(() => { const timer = window.setTimeout(() => setSearchQuery(query.trim()), 250); return () => window.clearTimeout(timer); }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ game: 'pokemon', language, limit: '240', offset: '0' });
    setFilters.forEach(value => params.append('set', value));
    if (searchQuery) params.set('q', searchQuery);
    rarityFilters.forEach(value => params.append('rarity', value));
    illustratorFilters.forEach(value => params.append('illustrator', value));
    setLoading(true);
    setLoadError(false);
    fetch(versionedCardCatalogUrl(`/api/cards/catalog?${params}`), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Catalog unavailable');
        const result = await response.json() as { cards?: GameCard[] };
        setCards(result.cards ?? []);
        setHasMore((result.cards?.length ?? 0) === 240);
      })
      .catch(error => { if (error.name !== 'AbortError') { setCards([]); setLoadError(true); setHasMore(false); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    fetch(versionedCardCatalogUrl(`/api/cards/sets?game=pokemon&language=${language}`), { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<{ sets?: SetRecord[] }> : { sets: [] })
      .then(result => setSets(result.sets ?? []))
      .catch(error => { if (error.name !== 'AbortError') setSets([]); });
    fetch(versionedCardCatalogUrl(`/api/cards/catalog/facets?game=pokemon&language=${language}`), { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<{ rarities?: string[]; illustrators?: string[] }> : { rarities: [], illustrators: [] })
      .then(result => { setRarities(result.rarities ?? []); setIllustrators(result.illustrators ?? []); })
      .catch(error => { if (error.name !== 'AbortError') { setRarities([]); setIllustrators([]); } });
    return () => controller.abort();
  }, [language, setFilters, searchQuery, rarityFilters, illustratorFilters, retryVersion]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ game: 'pokemon', language, limit: '240', offset: String(cards.length) });
      setFilters.forEach(value => params.append('set', value));
      if (searchQuery) params.set('q', searchQuery);
      rarityFilters.forEach(value => params.append('rarity', value));
      illustratorFilters.forEach(value => params.append('illustrator', value));
      const response = await fetch(versionedCardCatalogUrl(`/api/cards/catalog?${params}`));
      if (!response.ok) throw new Error('Catalog unavailable');
      const result = await response.json() as { cards?: GameCard[] };
      const next = result.cards ?? [];
      setCards(current => [...current, ...next]);
      setHasMore(next.length === 240);
    } catch { setLoadError(true); }
    finally { setLoadingMore(false); }
  };
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
  const hasFilters = Boolean(query.trim() || setFilters.length || rarityFilters.length || illustratorFilters.length);
  const clearFilters = () => { setQuery(''); setSearchQuery(''); setSetFilters([]); setRarityFilters([]); setIllustratorFilters([]); };

  return <main className="page catalog-page pokemon-catalog-page">
    <section className="library-intro">
      <div className="library-intro-copy">
        <p className="kicker">POKÉMON TCG</p>
        <h1>{id ? 'Jelajahi katalog kartu.' : 'Explore the card library.'}</h1>
        <p>{id ? 'Telusuri set dan cetakan kartu dalam bahasa Indonesia, Inggris, dan Jepang.' : 'Browse sets and printings in Indonesian, English, and Japanese.'}</p>
      </div>
      <div className="pokemon-intro-mark" aria-hidden="true"><span>Pokémon</span><b>TCG</b></div>
    </section>
    <section className="library-controls pokemon-library-controls" aria-label={id ? 'Filter kartu Pokémon' : 'Pokémon card filters'}>
      <label className="search-box"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={id ? 'Nama, nomor kartu, rarity, atau set' : 'Name, card number, rarity, or set'}/></label>
      <div className="pokemon-library-filterbar">
        <div className="pokemon-library-filters">
          <MultiFilter label="Set" values={sets.map(set=>({value:set.code,label:`${set.name} (${set.code})`}))} selected={setFilters} onToggle={value=>setSetFilters(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])} searchPlaceholder={id ? 'Cari set' : 'Find a set'}/>
          <MultiFilter label={id?'Kelangkaan':'Rarity'} values={rarities} selected={rarityFilters} onToggle={value=>setRarityFilters(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])} searchPlaceholder={id ? 'Cari kelangkaan' : 'Find a rarity'}/>
          <MultiFilter label={id ? 'Ilustrator' : 'Illustrator'} values={illustrators} selected={illustratorFilters} onToggle={value=>setIllustratorFilters(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])} searchPlaceholder={id ? 'Cari ilustrator' : 'Find an illustrator'}/>
          {hasFilters&&<button type="button" className="pokemon-clear-filters" onClick={clearFilters}>{id?'Hapus filter':'Clear filters'}</button>}
        </div>
        <div className="pokemon-library-language"><span>{id?'Bahasa kartu':'Card language'}</span><div className="language-switch" aria-label={id?'Bahasa kartu':'Card language'}>{languages.map(option => <button type="button" key={option} aria-pressed={language === option} onClick={() => { setLoading(true); setLanguage(option); }}>{option}</button>)}</div></div>
      </div>
    </section>
    <div className="pokemon-library-count" aria-live="polite">{loading ? ' ' : `${cards.length.toLocaleString(id?'id-ID':'en-US')} ${id?(cards.length===1?'kartu':'kartu'):(cards.length===1?'card':'cards')}${hasMore ? (id?' dimuat':' loaded') : ''}`}</div>
    {loading ? <div className="pokemon-card-grid" aria-label={id?'Memuat kartu Pokémon':'Loading Pokémon cards'}>{Array.from({ length: 12 }, (_, index) => <i key={index}/>)}</div> : loadError && !cards.length ? <section className="empty-state pokemon-empty"><h2>{id?'Kartu tidak dapat dimuat.':'Cards could not be loaded.'}</h2><p>{id?'Periksa koneksi Anda, lalu coba lagi.':'Check your connection and try again.'}</p><button type="button" className="button secondary" onClick={() => setRetryVersion(value => value + 1)}>{id?'Coba lagi':'Try again'}</button></section> : cards.length ? <div className="pokemon-card-grid">{cards.map(card => {
      const display = displayCard(card);
      return <button type="button" className="pokemon-card-tile" key={`${card.id}:${card.language}`} onClick={() => setSelected(card)}>
        <CardArt card={display}/>
        <span><strong>{display.name}</strong><small>{card.printing_code} <i/> {card.rarity}</small>{card.source_payload?.illustrator&&<small className="pokemon-card-illustrator">{card.source_payload.illustrator}</small>}</span>
      </button>;
    })}</div> : <section className="empty-state pokemon-empty"><h2>{searchQuery||hasFilters?(id?'Tidak ada kartu yang cocok dengan filter ini.':'No cards match these filters.'):(id?'Belum ada kartu Pokémon untuk bahasa ini.':'No Pokémon cards are available in this language yet.')}</h2>{(searchQuery||hasFilters)&&<p>{id?'Coba set, rarity, ilustrator, atau nama kartu lain.':'Try another set, rarity, illustrator, or card name.'}</p>}</section>}
    {!loading && loadError && cards.length > 0 && <p className="pokemon-load-error" role="status">{id?'Kartu lainnya gagal dimuat.':'More cards could not be loaded.'} <button type="button" onClick={() => setRetryVersion(value => value + 1)}>{id?'Coba lagi':'Try again'}</button></p>}
    {!loading && hasMore && <button type="button" className="pokemon-load-more" onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore}>{loadingMore ? ' ' : id?'Muat kartu lainnya':'Load more cards'}</button>}
    <nav className="pokemon-library-links" aria-label={id?'Bagian katalog Pokémon':'Pokémon catalog sections'}><Link href={localize('/pokemon/sets')}>{id?'Jelajahi set':'Browse sets'} <ArrowUpRightIcon size={15}/></Link><a href="https://github.com/tcgdex/cards-database" target="_blank" rel="noreferrer">{id?'Sumber data kartu: TCGdex':'Card data from TCGdex'} <ArrowUpRightIcon size={15}/></a></nav>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="pokemon-card-dialog">
        {selected && <div className="pokemon-card-dialog-layout"><CardArt card={displayCard(selected)} priority/><div><DialogHeader><p className="kicker">{selected.set_name}</p><DialogTitle>{selected.tcg_card_identities?.name ?? selected.printing_code}</DialogTitle><DialogDescription>{selected.printing_code} · {selected.language} · {selected.rarity}{selected.source_payload?.illustrator?` · ${selected.source_payload.illustrator}`:''}</DialogDescription></DialogHeader><PokemonCardText language={selected.language} source={selected.source_payload}/></div></div>}
      </DialogContent>
    </Dialog>
  </main>;
}
