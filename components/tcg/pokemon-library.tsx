'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MagnifyingGlassIcon as Search, ArrowUpRightIcon, CaretDownIcon as ChevronDown, SlidersHorizontalIcon as SlidersHorizontal } from '@phosphor-icons/react';
import { CardArt } from '@/components/tcg/card-art';
import { PokemonCardText } from '@/components/tcg/pokemon-card-text';
import { MultiFilter, Picker } from '@/components/tcg/catalog';
import { versionedCardCatalogUrl } from '@/lib/card-catalog-cache';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type GameCard = {
  id: string; rarity: string; variant: string; set_code: string; set_name: string; printing_code: string;
  language: string; attribute?: string; card_image_url?: string | null;
  source_payload?: { illustrator?: string; [key: string]: unknown };
  tcg_card_identities?: { code: string; name: string; color: string; card_type: string; cost: number; power: number; effect_text: string };
};
type SetRecord = { code: string; name: string };
type SortOrder = 'latest' | 'number' | 'name' | 'rarity' | 'hp';
type PokemonFacets = { rarities?: string[]; illustrators?: string[]; types?: string[]; categories?: string[]; stages?: string[] };
type DisplayCard = { id: string; code: string; name: string; color: string; type: 'Character'; cost: number; power: number; rarity: string; art: number; effect: string; imageUrl?: string; setCode?: string; language?: string; printingCode?: string; variant?: string };

const languages = ['ID', 'EN', 'JP'] as const;
type Language = typeof languages[number];

export function PokemonLibrary({ initialSet, initialQuery }: { initialSet?: string; initialQuery?: string }) {
  const pathname = usePathname();
  const id = pathname === '/id' || pathname.startsWith('/id/');
  const localize = (href: string) => id ? `/id${href}` : href;
  const [language, setLanguage] = useState<Language>(() => pathname === '/id' || pathname.startsWith('/id/') ? 'ID' : 'EN');
  const [cards, setCards] = useState<GameCard[]>([]);
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [rarities, setRarities] = useState<string[]>([]);
  const [illustrators, setIllustrators] = useState<string[]>([]);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [stageOptions, setStageOptions] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [stageFilters, setStageFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOrder>('latest');
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
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
    typeFilters.forEach(value => params.append('type', value));
    categoryFilters.forEach(value => params.append('category', value));
    stageFilters.forEach(value => params.append('stage', value));
    params.set('sort', sort);
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
    return () => controller.abort();
  }, [language, setFilters, searchQuery, rarityFilters, illustratorFilters, typeFilters, categoryFilters, stageFilters, sort, retryVersion]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(versionedCardCatalogUrl(`/api/cards/sets?game=pokemon&language=${language}`), { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<{ sets?: SetRecord[] }> : { sets: [] })
      .then(result => setSets(result.sets ?? []))
      .catch(error => { if (error.name !== 'AbortError') setSets([]); });
    fetch(versionedCardCatalogUrl(`/api/cards/catalog/facets?game=pokemon&language=${language}`), { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<PokemonFacets> : {} as PokemonFacets)
      .then(result => { setRarities(result.rarities ?? []); setIllustrators(result.illustrators ?? []); setTypeOptions(result.types ?? []); setCategoryOptions(result.categories ?? []); setStageOptions(result.stages ?? []); })
      .catch(error => { if (error.name !== 'AbortError') { setRarities([]); setIllustrators([]); setTypeOptions([]); setCategoryOptions([]); setStageOptions([]); } });
    return () => controller.abort();
  }, [language, retryVersion]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ game: 'pokemon', language, limit: '240', offset: String(cards.length) });
      setFilters.forEach(value => params.append('set', value));
      if (searchQuery) params.set('q', searchQuery);
      rarityFilters.forEach(value => params.append('rarity', value));
      illustratorFilters.forEach(value => params.append('illustrator', value));
      typeFilters.forEach(value => params.append('type', value));
      categoryFilters.forEach(value => params.append('category', value));
      stageFilters.forEach(value => params.append('stage', value));
      params.set('sort', sort);
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
    rarity: cleanRarity(card.rarity),
    art: 0,
    effect: card.tcg_card_identities?.effect_text ?? '',
    imageUrl: card.card_image_url ?? undefined,
    setCode: card.set_code,
    language: card.language,
    printingCode: card.printing_code,
    variant: card.variant,
  });
  const hasFilters = Boolean(query.trim() || setFilters.length || rarityFilters.length || illustratorFilters.length || typeFilters.length || categoryFilters.length || stageFilters.length || sort !== 'latest');
  const advancedFilterCount = illustratorFilters.length + stageFilters.length;
  const clearFilters = () => { setQuery(''); setSearchQuery(''); setSetFilters([]); setRarityFilters([]); setIllustratorFilters([]); setTypeFilters([]); setCategoryFilters([]); setStageFilters([]); setSort('latest'); };
  const toggle = (current: string[], setState: (value: string[] | ((previous: string[]) => string[])) => void, value: string) => setState(previous => previous.includes(value) ? previous.filter(item => item !== value) : [...previous, value]);

  return <main className="page catalog-page pokemon-catalog-page">
    <section className="library-intro pokemon-library-intro">
      <div className="library-intro-copy">
        <p className="kicker">POKÉMON TCG</p>
        <h1>{id ? 'Jelajahi katalog kartu.' : 'Explore the card library.'}</h1>
        <p>{id ? 'Telusuri set dan cetakan kartu dalam bahasa Indonesia, Inggris, dan Jepang.' : 'Browse sets and printings in Indonesian, English, and Japanese.'}</p>
      </div>
      <div className="pokemon-intro-mark"><img src="https://upload.wikimedia.org/wikipedia/commons/1/1a/Pok%C3%A9mon_Trading_Card_Game_logo.svg" alt="Pokémon Trading Card Game"/><Link href={localize('/pokemon/sets')}>{id?'Lihat semua set':'Browse sets'} <ArrowUpRightIcon size={15}/></Link></div>
    </section>
    <section className="library-controls pokemon-library-controls" aria-label={id ? 'Filter kartu Pokémon' : 'Pokémon card filters'}>
      <label className="search-box"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={id ? 'Nama, nomor kartu, rarity, atau set' : 'Name, card number, rarity, or set'}/></label>
      <div className="pokemon-library-filterbar">
        <div className="pokemon-library-filters">
          <MultiFilter label="Set" values={sets.map(set=>({value:set.code,label:`${set.name} (${set.code})`}))} selected={setFilters} onToggle={value=>setSetFilters(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])} searchPlaceholder={id ? 'Cari set' : 'Find a set'}/>
          <MultiFilter label={id?'Tipe':'Type'} values={typeOptions} selected={typeFilters} onToggle={value=>toggle(typeFilters,setTypeFilters,value)} searchPlaceholder={id?'Cari tipe Pokémon':'Find a Pokémon type'}/>
          <MultiFilter label={id?'Kelangkaan':'Rarity'} values={rarities} selected={rarityFilters} onToggle={value=>toggle(rarityFilters,setRarityFilters,value)} searchPlaceholder={id ? 'Cari rarity' : 'Find a rarity'}/>
          <MultiFilter label={id?'Jenis kartu':'Card type'} values={categoryOptions.map(value=>({value,label:categoryLabel(value,id)}))} selected={categoryFilters} onToggle={value=>toggle(categoryFilters,setCategoryFilters,value)}/>
          <Picker label={id?'Urutkan kartu':'Sort cards'} value={sort} onChange={value=>setSort(value as SortOrder)} leadingIcon={<SlidersHorizontal size={15}/>} options={[
            {value:'latest',label:id?'Rilisan terbaru':'Newest'},
            {value:'number',label:id?'Nomor kartu':'Set and number'},
            {value:'name',label:id?'Nama A–Z':'Name A–Z'},
            {value:'rarity',label:id?'Kelangkaan: tinggi ke rendah':'Rarity: high to low'},
            {value:'hp',label:'HP'},
          ]}/>
          <button type="button" className={`pokemon-more-filters-trigger ${moreFiltersOpen?'is-open':''}`} aria-expanded={moreFiltersOpen} onClick={()=>setMoreFiltersOpen(value=>!value)}><SlidersHorizontal size={15}/>{id?'Lainnya':'More'}{advancedFilterCount>0&&<b>{advancedFilterCount}</b>}<ChevronDown size={14}/></button>
          {hasFilters&&<button type="button" className="pokemon-clear-filters" onClick={clearFilters}>{id?'Hapus filter':'Clear filters'}</button>}
        </div>
        <div className="pokemon-library-language"><span>{id?'Bahasa':'Language'}</span><div className="language-switch" aria-label={id?'Bahasa kartu':'Card language'}>{languages.map(option => <button type="button" key={option} aria-pressed={language === option} onClick={() => { setLoading(true); setLanguage(option); }}>{option}</button>)}</div></div>
      </div>
      {moreFiltersOpen&&<div className="pokemon-library-more-filters">
        <MultiFilter label={id?'Ilustrator':'Illustrator'} values={illustrators} selected={illustratorFilters} onToggle={value=>toggle(illustratorFilters,setIllustratorFilters,value)} searchPlaceholder={id ? 'Cari ilustrator' : 'Find an illustrator'}/>
        <MultiFilter label={id?'Tahap':'Stage'} values={stageOptions} selected={stageFilters} onToggle={value=>toggle(stageFilters,setStageFilters,value)} searchPlaceholder={id?'Cari tahap':'Find a stage'}/>
      </div>}
    </section>
    <div className="pokemon-library-count" aria-live="polite">{loading ? ' ' : `${cards.length.toLocaleString(id?'id-ID':'en-US')} ${id?(cards.length===1?'kartu':'kartu'):(cards.length===1?'card':'cards')}${hasMore ? (id?' dimuat':' loaded') : ''}`}</div>
    {loading ? <div className="pokemon-card-grid" aria-label={id?'Memuat kartu Pokémon':'Loading Pokémon cards'}>{Array.from({ length: 12 }, (_, index) => <i key={index}/>)}</div> : loadError && !cards.length ? <section className="empty-state pokemon-empty"><h2>{id?'Kartu tidak dapat dimuat.':'Cards could not be loaded.'}</h2><p>{id?'Periksa koneksi Anda, lalu coba lagi.':'Check your connection and try again.'}</p><button type="button" className="button secondary" onClick={() => setRetryVersion(value => value + 1)}>{id?'Coba lagi':'Try again'}</button></section> : cards.length ? <div className="pokemon-card-grid">{cards.map(card => {
      const display = displayCard(card);
      const pokemonTypes = Array.isArray(card.source_payload?.types) ? card.source_payload.types.filter((value): value is string => typeof value === 'string') : [];
      const stage = typeof card.source_payload?.stage === 'string' ? card.source_payload.stage : '';
      const hp = typeof card.source_payload?.hp === 'string' || typeof card.source_payload?.hp === 'number' ? `${card.source_payload.hp} HP` : '';
      return <button type="button" className="pokemon-card-tile" key={`${card.id}:${card.language}`} onClick={() => setSelected(card)}>
        <CardArt card={display}/>
        <span><strong>{display.name}</strong><small>{card.printing_code}{display.rarity&&<> <i/> {display.rarity}</>}</small>{(pokemonTypes.length>0||hp||stage)&&<small className="pokemon-card-vitals">{[...pokemonTypes,stage,hp].filter(Boolean).join(' · ')}</small>}{typeof card.source_payload?.illustrator === 'string'&&card.source_payload.illustrator&&<small className="pokemon-card-illustrator">{card.source_payload.illustrator}</small>}</span>
      </button>;
    })}</div> : <section className="empty-state pokemon-empty"><h2>{searchQuery||hasFilters?(id?'Tidak ada kartu yang cocok dengan filter ini.':'No cards match these filters.'):(id?'Belum ada kartu Pokémon untuk bahasa ini.':'No Pokémon cards are available in this language yet.')}</h2>{(searchQuery||hasFilters)&&<p>{id?'Coba set, rarity, ilustrator, atau nama kartu lain.':'Try another set, rarity, illustrator, or card name.'}</p>}</section>}
    {!loading && loadError && cards.length > 0 && <p className="pokemon-load-error" role="status">{id?'Kartu lainnya gagal dimuat.':'More cards could not be loaded.'} <button type="button" onClick={() => setRetryVersion(value => value + 1)}>{id?'Coba lagi':'Try again'}</button></p>}
    {!loading && hasMore && <button type="button" className="pokemon-load-more" onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore}>{loadingMore ? ' ' : id?'Muat kartu lainnya':'Load more cards'}</button>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="pokemon-card-dialog">
        {selected && <div className="pokemon-card-dialog-layout"><CardArt card={displayCard(selected)} priority/><div><DialogHeader><p className="kicker">{selected.set_name}</p><DialogTitle>{selected.tcg_card_identities?.name ?? selected.printing_code}</DialogTitle><DialogDescription>{[selected.printing_code,selected.language,cleanRarity(selected.rarity),selected.source_payload?.illustrator].filter(Boolean).join(' · ')}</DialogDescription></DialogHeader><PokemonCardText language={selected.language} source={selected.source_payload}/></div></div>}
      </DialogContent>
    </Dialog>
  </main>;
}

function cleanRarity(value?: string | null) {
  const rarity = value?.trim();
  return rarity && !['unknown','none','null'].includes(rarity.toLowerCase()) ? rarity : '';
}

function categoryLabel(value: string, id: boolean) {
  if (value.toLowerCase() === 'pokemon') return id ? 'Pokémon' : 'Pokémon';
  if (value.toLowerCase() === 'trainer') return id ? 'Trainer' : 'Trainer';
  if (value.toLowerCase() === 'energy') return id ? 'Energi' : 'Energy';
  return value;
}
