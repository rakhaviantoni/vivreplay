'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MagnifyingGlassIcon as Search, ArrowUpRightIcon, CaretDownIcon as ChevronDown, CaretLeftIcon, CaretRightIcon, SlidersHorizontalIcon as SlidersHorizontal, SortAscendingIcon as SortAscending, ArrowSquareOutIcon, StorefrontIcon } from '@phosphor-icons/react';
import { CardArt } from '@/components/tcg/card-art';
import { PokemonCardText, PokemonCardVitals, PokemonMechanicText } from '@/components/tcg/pokemon-card-text';
import { pokemonExpansionArt } from '@/components/tcg/pokemon-expansion-art';
import { MultiFilter, Picker } from '@/components/tcg/catalog';
import { versionedCardCatalogUrl } from '@/lib/card-catalog-cache';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { WishlistButton } from '@/components/tcg/market-saved';
import { ShareButton } from '@/components/tcg/share';
import { MarketSellAction } from '@/components/tcg/market-sell-action';
import { CardMarketPanel } from '@/components/tcg/card-market-panel';

type GameCard = {
  id: string; rarity: string; variant: string; set_code: string; set_name: string; printing_code: string;
  language: string; attribute?: string; card_image_url?: string | null;
  source_payload?: { illustrator?: string; localId?: string; rarity?: string; pricing?: unknown; set?: { cardCount?: { official?: number; total?: number } }; [key: string]: unknown };
  tcg_card_identities?: { code: string; name: string; color: string; card_type: string; cost: number; power: number; effect_text: string };
};
type SetRecord = { code: string; name: string; productImageUrl?: string; series?: string; releaseYear?: number };
type SortOrder = 'latest' | 'number' | 'name' | 'rarity' | 'hp';
type PokemonFacets = { rarities?: string[]; illustrators?: string[]; types?: string[]; categories?: string[]; stages?: string[]; attackEnergies?: string[]; regulations?: string[]; retreats?: string[]; weaknesses?: string[]; resistances?: string[] };
type DisplayCard = { id: string; code: string; name: string; color: string; type: 'Character'; cost: number; power: number; rarity: string; art: number; effect: string; imageUrl?: string; setCode?: string; language?: string; printingCode?: string; variant?: string };

const languages = ['ID', 'EN', 'JP'] as const;
type Language = typeof languages[number];

export function PokemonLibrary({ initialSet, initialQuery, initialIllustrator }: { initialSet?: string; initialQuery?: string; initialIllustrator?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const id = pathname === '/id' || pathname.startsWith('/id/');
  const localize = (href: string) => id ? `/id${href}` : href;
  const [language, setLanguage] = useState<Language>(() => pathname === '/id' || pathname.startsWith('/id/') ? 'ID' : 'EN');
  const [cards, setCards] = useState<GameCard[]>([]);
  const [introCards, setIntroCards] = useState<GameCard[]>([]);
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [rarities, setRarities] = useState<string[]>([]);
  const [illustratorOptions, setIllustratorOptions] = useState<string[]>([]);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [stageOptions, setStageOptions] = useState<string[]>([]);
  const [energyOptions, setEnergyOptions] = useState<string[]>([]);
  const [regulationOptions, setRegulationOptions] = useState<string[]>([]);
  const [retreatOptions, setRetreatOptions] = useState<string[]>([]);
  const [weaknessOptions, setWeaknessOptions] = useState<string[]>([]);
  const [resistanceOptions, setResistanceOptions] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [stageFilters, setStageFilters] = useState<string[]>([]);
  const [energyFilters, setEnergyFilters] = useState<string[]>([]);
  const [regulationFilters, setRegulationFilters] = useState<string[]>([]);
  const [retreatFilters, setRetreatFilters] = useState<string[]>([]);
  const [weaknessFilters, setWeaknessFilters] = useState<string[]>([]);
  const [resistanceFilters, setResistanceFilters] = useState<string[]>([]);
  const [hpMin, setHpMin] = useState('');
  const [hpMax, setHpMax] = useState('');
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
  const [illustratorFilters, setIllustratorFilters] = useState<string[]>(() => initialIllustrator?.trim() ? [initialIllustrator.trim()] : []);
  const [selected, setSelected] = useState<GameCard | null>(null);
  const selectedIndex = selected ? cards.findIndex(card => card.id === selected.id) : -1;
  const navigateSelected = (step: number) => {
    if (cards.length < 2) return;
    const index = selectedIndex < 0 ? 0 : (selectedIndex + step + cards.length) % cards.length;
    setSelected(cards[index] ?? null);
  };
  const openEvolutionCard = async (code: string) => {
    const loadedCard = cards.find(card => card.tcg_card_identities?.code === code);
    if (loadedCard) { setSelected(loadedCard); return; }
    try {
      for (const cardLanguage of language === 'EN' ? ['EN'] : [language, 'EN']) {
        const params = new URLSearchParams({ game: 'pokemon', language: cardLanguage, codes: code });
        const response = await fetch(versionedCardCatalogUrl(`/api/cards/catalog?${params}`));
        if (!response.ok) continue;
        const result = await response.json() as { cards?: GameCard[] };
        const card = result.cards?.find(candidate => candidate.tcg_card_identities?.code === code);
        if (card) { setSelected(card); return; }
      }
    } catch { /* Keep the current detail open if the related card cannot load. */ }
  };

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if ((event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) || event.target instanceof HTMLElement && event.target.isContentEditable) return;
      event.preventDefault();
      if (cards.length < 2) return;
      const nextIndex = selectedIndex < 0 ? 0 : (selectedIndex + (event.key === 'ArrowLeft' ? -1 : 1) + cards.length) % cards.length;
      setSelected(cards[nextIndex] ?? null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, selectedIndex, cards]);

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
    energyFilters.forEach(value => params.append('attackEnergy', value));
    regulationFilters.forEach(value => params.append('regulation', value));
    retreatFilters.forEach(value => params.append('retreat', value));
    weaknessFilters.forEach(value => params.append('weakness', value));
    resistanceFilters.forEach(value => params.append('resistance', value));
    if(hpMin) params.set('minHp',hpMin);
    if(hpMax) params.set('maxHp',hpMax);
    params.set('sort', sort);
    setLoading(true);
    setLoadError(false);
    fetch(versionedCardCatalogUrl(`/api/cards/catalog?${params}`), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Catalog unavailable');
        const result = await response.json() as { cards?: GameCard[] };
        const nextCards = result.cards ?? [];
        setCards(nextCards);
        setIntroCards(current => current.length ? current : nextCards.filter(card => card.card_image_url).slice(0, 6));
        setHasMore((result.cards?.length ?? 0) === 240);
      })
      .catch(error => { if (error.name !== 'AbortError') { setCards([]); setLoadError(true); setHasMore(false); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [language, setFilters, searchQuery, rarityFilters, illustratorFilters, typeFilters, categoryFilters, stageFilters, energyFilters, regulationFilters, retreatFilters, weaknessFilters, resistanceFilters, hpMin, hpMax, sort, retryVersion]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(versionedCardCatalogUrl(`/api/cards/sets?game=pokemon&language=${language}`), { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<{ sets?: SetRecord[] }> : { sets: [] })
      .then(result => setSets(result.sets ?? []))
      .catch(error => { if (error.name !== 'AbortError') setSets([]); });
    fetch(versionedCardCatalogUrl(`/api/cards/catalog/facets?game=pokemon&language=${language}`), { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<PokemonFacets> : {} as PokemonFacets)
      .then(result => { setRarities(result.rarities ?? []); setIllustratorOptions(result.illustrators ?? []); setTypeOptions(result.types ?? []); setCategoryOptions(result.categories ?? []); setStageOptions(result.stages ?? []); setEnergyOptions(result.attackEnergies ?? []); setRegulationOptions(result.regulations ?? []); setRetreatOptions(result.retreats ?? []); setWeaknessOptions(result.weaknesses ?? []); setResistanceOptions(result.resistances ?? []); })
      .catch(error => { if (error.name !== 'AbortError') { setRarities([]); setIllustratorOptions([]); setTypeOptions([]); setCategoryOptions([]); setStageOptions([]); setEnergyOptions([]); setRegulationOptions([]); setRetreatOptions([]); setWeaknessOptions([]); setResistanceOptions([]); } });
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
      energyFilters.forEach(value => params.append('attackEnergy', value));
      regulationFilters.forEach(value => params.append('regulation', value));
      retreatFilters.forEach(value => params.append('retreat', value));
      weaknessFilters.forEach(value => params.append('weakness', value));
      resistanceFilters.forEach(value => params.append('resistance', value));
      if(hpMin) params.set('minHp',hpMin);
      if(hpMax) params.set('maxHp',hpMax);
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
  const hasFilters = Boolean(query.trim() || setFilters.length || rarityFilters.length || illustratorFilters.length || typeFilters.length || categoryFilters.length || stageFilters.length || energyFilters.length || regulationFilters.length || retreatFilters.length || weaknessFilters.length || resistanceFilters.length || hpMin || hpMax || sort !== 'latest');
  const advancedFilterCount = stageFilters.length + energyFilters.length + regulationFilters.length + retreatFilters.length + weaknessFilters.length + resistanceFilters.length + (hpMin||hpMax?1:0);
  const clearFilters = () => { setQuery(''); setSearchQuery(''); setSetFilters([]); setRarityFilters([]); setIllustratorFilters([]); setTypeFilters([]); setCategoryFilters([]); setStageFilters([]); setEnergyFilters([]); setRegulationFilters([]); setRetreatFilters([]); setWeaknessFilters([]); setResistanceFilters([]); setHpMin(''); setHpMax(''); setSort('latest'); router.replace(localize('/pokemon'), { scroll: false }); };
  const toggle = (current: string[], setState: (value: string[] | ((previous: string[]) => string[])) => void, value: string) => setState(previous => previous.includes(value) ? previous.filter(item => item !== value) : [...previous, value]);

  return <main className="page catalog-page pokemon-catalog-page">
    <section className="library-intro pokemon-library-intro">
      <div className="library-intro-copy">
        <p className="kicker">POKÉMON TCG</p>
        <h1>{id ? 'Jelajahi katalog kartu.' : 'Explore the card library.'}</h1>
        <p>{id ? 'Telusuri set dan cetakan kartu dalam bahasa Indonesia, Inggris, dan Jepang.' : 'Browse sets and printings in Indonesian, English, and Japanese.'}</p>
      </div>
      <div className="library-intro-rail library-intro-random-rail pokemon-intro-rail">
        <div className="library-intro-rail-cards" aria-hidden="true">
          {introCards.map((card,index)=><div className={`library-intro-rail-card rail-card-${index}`} key={card.id}><CardArt card={displayCard(card)}/></div>)}
          {!introCards.length&&Array.from({length:6},(_,index)=><i className={`library-intro-rail-skeleton rail-card-${index}`} key={index}/>)}
        </div>
        <Link className="library-intro-browse" href={localize('/pokemon/sets')}>{id?'Jelajahi set':'Browse sets'} <ArrowUpRightIcon size={15}/></Link>
      </div>
    </section>
    <section className="library-controls pokemon-library-controls" aria-label={id ? 'Filter kartu Pokémon' : 'Pokémon card filters'}>
      <div className="pokemon-library-searches"><label className="search-box"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={id ? 'Cari nama atau nomor kartu' : 'Search name or card number'}/></label></div>
      <div className="pokemon-library-filterbar">
        <div className="pokemon-library-filters">
          <div className="pokemon-primary-filters">
          <MultiFilter label="Set" values={sets.map(set=>({value:set.code,label:`${set.name} (${set.code})`,image:pokemonExpansionArt(set.name,set.code)??set.productImageUrl,group:set.series||(set.releaseYear?String(set.releaseYear):id?'Set lainnya':'Other sets')}))} selected={setFilters} onToggle={value=>setSetFilters(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])} searchPlaceholder={id ? 'Cari set' : 'Find a set'}/>
          <MultiFilter label={id?'Tipe':'Type'} values={typeOptions} selected={typeFilters} onToggle={value=>toggle(typeFilters,setTypeFilters,value)} searchPlaceholder={id?'Cari tipe Pokémon':'Find a Pokémon type'}/>
          <MultiFilter label={id?'Kelangkaan':'Rarity'} values={rarities} selected={rarityFilters} onToggle={value=>toggle(rarityFilters,setRarityFilters,value)} searchPlaceholder={id ? 'Cari rarity' : 'Find a rarity'}/>
          <MultiFilter label={id?'Jenis kartu':'Card type'} values={categoryOptions.map(value=>({value,label:categoryLabel(value,id)}))} selected={categoryFilters} onToggle={value=>toggle(categoryFilters,setCategoryFilters,value)}/>
          <MultiFilter label={id?'Ilustrator':'Illustrator'} values={illustratorOptions} selected={illustratorFilters} onToggle={value=>toggle(illustratorFilters,setIllustratorFilters,value)} searchPlaceholder={id?'Cari ilustrator':'Find an illustrator'}/>
          </div>
          <div className="pokemon-filter-actions">
          <button type="button" className={`pokemon-more-filters-trigger ${moreFiltersOpen?'is-open':''}`} aria-expanded={moreFiltersOpen} onClick={()=>setMoreFiltersOpen(value=>!value)}><SlidersHorizontal size={15}/>{id?'Lainnya':'More'}{advancedFilterCount>0&&<b>{advancedFilterCount}</b>}<ChevronDown size={14}/></button>
          <div className="pokemon-sort-picker"><Picker label={id?'Urutkan kartu':'Sort cards'} value={sort} onChange={value=>setSort(value as SortOrder)} leadingIcon={<SortAscending size={15}/>} options={[
            {value:'latest',label:id?'Rilisan terbaru':'Newest'},
            {value:'number',label:id?'Nomor kartu':'Set and number'},
            {value:'name',label:id?'Nama A–Z':'Name A–Z'},
            {value:'rarity',label:id?'Kelangkaan: tinggi ke rendah':'Rarity: high to low'},
            {value:'hp',label:'HP'},
          ]}/></div>
          <div className="pokemon-library-language"><div className="language-switch" aria-label={id?'Bahasa kartu':'Card language'}>{languages.map(option => <button type="button" key={option} aria-pressed={language === option} onClick={() => { setLoading(true); setLanguage(option); }}>{option}</button>)}</div></div>
          {hasFilters&&<button type="button" className="pokemon-clear-filters" onClick={clearFilters}>{id?'Hapus':'Clear'}</button>}
          </div>
        </div>
      </div>
      {moreFiltersOpen&&<div className="pokemon-library-more-filters" aria-label={id?'Filter kartu lainnya':'More card filters'}>
        <MultiFilter label={id?'Tahap':'Stage'} values={stageOptions} selected={stageFilters} onToggle={value=>toggle(stageFilters,setStageFilters,value)} searchPlaceholder={id?'Cari tahap':'Find a stage'}/>
        <MultiFilter label={id?'Energi serangan':'Attack energy'} values={energyOptions} selected={energyFilters} onToggle={value=>toggle(energyFilters,setEnergyFilters,value)} searchPlaceholder={id?'Cari energi':'Find an energy type'}/>
        <MultiFilter label="Regulation" values={regulationOptions} selected={regulationFilters} onToggle={value=>toggle(regulationFilters,setRegulationFilters,value)}/>
        <MultiFilter label={id?'Mundur':'Retreat'} values={retreatOptions} selected={retreatFilters} onToggle={value=>toggle(retreatFilters,setRetreatFilters,value)}/>
        <MultiFilter label={id?'Kelemahan':'Weakness'} values={weaknessOptions} selected={weaknessFilters} onToggle={value=>toggle(weaknessFilters,setWeaknessFilters,value)}/>
        <MultiFilter label={id?'Resistansi':'Resistance'} values={resistanceOptions} selected={resistanceFilters} onToggle={value=>toggle(resistanceFilters,setResistanceFilters,value)}/>
        <label className="pokemon-hp-range"><span>HP</span><input type="number" inputMode="numeric" min="0" max="999" value={hpMin} onChange={event=>setHpMin(event.target.value)} placeholder={id?'Min':'Min'}/><i>–</i><input type="number" inputMode="numeric" min="0" max="999" value={hpMax} onChange={event=>setHpMax(event.target.value)} placeholder={id?'Maks':'Max'}/></label>
      </div>}
    </section>
    <div className="pokemon-library-count" aria-live="polite">{loading ? cards.length ? (id?'Memperbarui kartu…':'Updating cards…') : (id?'Memuat kartu…':'Loading cards…') : `${cards.length.toLocaleString(id?'id-ID':'en-US')} ${id?(cards.length===1?'kartu':'kartu'):(cards.length===1?'card':'cards')}${hasMore ? (id?' dimuat':' loaded') : ''}`}</div>
    {loading && !cards.length ? <div className="pokemon-card-grid" aria-label={id?'Memuat kartu Pokémon':'Loading Pokémon cards'}>{Array.from({ length: 12 }, (_, index) => <i key={index}/>)}</div> : loadError && !cards.length ? <section className="empty-state pokemon-empty"><h2>{id?'Kartu tidak dapat dimuat.':'Cards could not be loaded.'}</h2><p>{id?'Periksa koneksi Anda, lalu coba lagi.':'Check your connection and try again.'}</p><button type="button" className="button secondary" onClick={() => setRetryVersion(value => value + 1)}>{id?'Coba lagi':'Try again'}</button></section> : cards.length ? <div className="pokemon-card-grid" aria-busy={loading}>{cards.map(card => {
      const display = displayCard(card);
      const metadata = pokemonCardMetadata(card);
      return <button type="button" className="pokemon-card-tile" key={`${card.id}:${card.language}`} onClick={() => setSelected(card)}>
        <CardArt card={display}/>
        <span className="pokemon-card-caption"><strong>{display.name}</strong><PokemonCardMetadata metadata={metadata}/></span>
      </button>;
    })}</div> : <section className="empty-state pokemon-empty"><h2>{searchQuery||hasFilters?(id?'Tidak ada kartu yang cocok dengan filter ini.':'No cards match these filters.'):(id?'Belum ada kartu Pokémon untuk bahasa ini.':'No Pokémon cards are available in this language yet.')}</h2>{(searchQuery||hasFilters)&&<p>{id?'Ubah pencarian atau hapus salah satu filter.':'Change your search or clear a filter.'}</p>}</section>}
    {!loading && loadError && cards.length > 0 && <p className="pokemon-load-error" role="status">{id?'Kartu lainnya gagal dimuat.':'More cards could not be loaded.'} <button type="button" onClick={() => setRetryVersion(value => value + 1)}>{id?'Coba lagi':'Try again'}</button></p>}
    {!loading && hasMore && <button type="button" className="pokemon-load-more" onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore}>{loadingMore ? ' ' : id?'Muat kartu lainnya':'Load more cards'}</button>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="pokemon-card-dialog">
        {selected && <>
          <div className="pokemon-card-dialog-layout"><div className="pokemon-card-dialog-art-column"><CardArt card={displayCard(selected)} priority/></div><div className="pokemon-card-dialog-details"><DialogHeader><p className="kicker">{selected.set_name}</p><div className="pokemon-dialog-title-row"><DialogTitle><PokemonMechanicText text={selected.tcg_card_identities?.name ?? selected.printing_code}/></DialogTitle><PokemonCardVitals source={selected.source_payload} language={selected.language}/></div><DialogDescription asChild><div className="pokemon-dialog-meta"><PokemonCardMetadata metadata={pokemonCardMetadata(selected)} illustrator={selected.source_payload?.illustrator} illustratorLabel="Illus."/></div></DialogDescription></DialogHeader><PokemonCardText code={selected.tcg_card_identities?.code} name={selected.tcg_card_identities?.name} language={selected.language} source={selected.source_payload} onEvolutionSelect={openEvolutionCard}/><div className="pokemon-dialog-actions"><WishlistButton printingId={selected.id} language={id ? 'ID' : 'EN'}/><ShareButton title={selected.tcg_card_identities?.name ?? selected.printing_code} path={localize(`/pokemon?q=${encodeURIComponent(selected.tcg_card_identities?.name ?? selected.printing_code)}`)} card={displayCard(selected)} entityType="card"/>{pathname !== '/pokemon' && pathname !== '/id/pokemon' && <Link className="button secondary" href={localize(`/pokemon?q=${encodeURIComponent(selected.tcg_card_identities?.name ?? selected.printing_code)}`)}><ArrowSquareOutIcon size={16}/>{id ? 'Buka di katalog' : 'Open in library'}</Link>}<div className="pokemon-dialog-market-actions"><Link className="button secondary" href={`/market?game=pokemon&printing=${encodeURIComponent(selected.id)}`}><StorefrontIcon size={16}/>{id ? 'Beli kartu' : 'Buy a copy'}</Link><MarketSellAction className="button secondary" printingId={selected.id}><StorefrontIcon size={16}/>{id ? 'Jual kartu ini' : 'Sell a copy'}</MarketSellAction></div></div></div><div className="pokemon-dialog-market-data"><PokemonPriceGuide source={selected.source_payload}/><CardMarketPanel game="pokemon" printingId={selected.id} printing={{language:'EN',setCode:selected.set_code,printingCode:selected.printing_code,variant:selected.variant}} disableExternalPrice/></div></div>
        </>}
      </DialogContent>
      {selected && cards.length > 1 && <DialogPortal><button type="button" className="pokemon-dialog-nav pokemon-dialog-prev" aria-label={id ? 'Kartu sebelumnya' : 'Previous card'} onClick={() => navigateSelected(-1)}><CaretLeftIcon size={22}/></button><button type="button" className="pokemon-dialog-nav pokemon-dialog-next" aria-label={id ? 'Kartu berikutnya' : 'Next card'} onClick={() => navigateSelected(1)}><CaretRightIcon size={22}/></button></DialogPortal>}
    </Dialog>
  </main>;
}

type PokemonPriceSource = { pricing?: unknown };
type PriceProvider = { updated?: unknown; unit?: unknown; [key:string]:unknown };
function PokemonPriceGuide({source}:{source?:PokemonPriceSource}) {
  const pricing=source?.pricing;
  const providers=[['TCGplayer','USD'],['Cardmarket','EUR']].flatMap(([name,defaultCurrency])=>{
    const provider=pricing&&typeof pricing==='object'?(pricing as Record<string,unknown>)[name==='TCGplayer'?'tcgplayer':'cardmarket']:undefined;
    if(!provider||typeof provider!=='object')return [];
    const record=provider as PriceProvider;
    const currency=typeof record.unit==='string'&&/^[A-Z]{3}$/.test(record.unit)?record.unit:defaultCurrency;
    const entries:{variant:string;metric:string;value:number}[]=[];
    if(name==='TCGplayer') {
      const metricKeys=[['Market',['marketPrice','market']],['Mid',['midPrice','mid']],['Low',['lowPrice','low']]] as const;
      for(const [variant,raw] of Object.entries(record)) {
        if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
        for(const [label,keys] of metricKeys){const values=raw as Record<string,unknown>;const value=keys.map(key=>values[key]).find(candidate=>typeof candidate==='number'&&Number.isFinite(candidate));if(typeof value==='number')entries.push({variant:variant.replaceAll('-',' '),metric:label,value});}
      }
    } else {
      const metricKeys=[['trend','Trend'],['avg','Average'],['low','Low'],['trend-holo','Holo trend'],['avg-holo','Holo average'],['low-holo','Holo low']] as const;
      for(const [key,label] of metricKeys){const value=record[key];if(typeof value==='number'&&Number.isFinite(value))entries.push({variant:'',metric:label,value});}
    }
    const updated=typeof record.updated==='string'?record.updated:typeof record.updated==='number'?new Date(record.updated<1_000_000_000_000?record.updated*1000:record.updated).toISOString():undefined;
    return entries.length?[{name,currency,updated,entries}]:[];
  });
  if(!providers.length)return null;
  return <section className="pokemon-price-guide" aria-label="Market price guide"><h3>Price guide</h3><div>{providers.map(provider=><article key={provider.name}><header><strong>{provider.name}</strong>{provider.updated&&<time dateTime={provider.updated}>{new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(new Date(provider.updated))}</time>}</header><ul>{provider.entries.map((entry,index)=><li key={`${entry.variant}-${entry.metric}-${index}`}><span>{[entry.variant,entry.metric].filter(Boolean).join(' · ')}</span><b>{new Intl.NumberFormat('en-US',{style:'currency',currency:provider.currency,maximumFractionDigits:2}).format(entry.value)}</b></li>)}</ul></article>)}</div></section>;
}

function cleanRarity(value?: string | null) {
  const rarity = value?.trim();
  return rarity && !['unknown','none','null'].includes(rarity.toLowerCase()) ? rarity : '';
}

function pokemonCardMetadata(card: GameCard) {
  const count = card.source_payload?.set?.cardCount;
  const officialCount = Number(count?.official);
  const setTotal = officialCount > 0 ? officialCount : count?.total;
  const rarity = pokemonRarityCode(cleanRarity(card.rarity) || card.source_payload?.rarity);
  return {
    set: card.set_code.trim().toLowerCase(),
    number: formatPokemonNumber(card.source_payload?.localId ?? card.printing_code, setTotal),
    rarity: rarity || (card.set_code.trim().toLowerCase() === '30th-c' ? 'CC' : ''),
    regulation: typeof card.source_payload?.regulationMark === 'string' ? card.source_payload.regulationMark.trim() : '',
  };
}

function pokemonRarityCode(value?: string | null) {
  const rarity = cleanRarity(value);
  if (!rarity) return '';
  const normalized = rarity.toLowerCase().replace(/[^a-z]/g, '');
  const codes: Record<string, string> = {
    classiccollection: 'CC',
    common: 'C', uncommon: 'U', rare: 'R', rareholo: 'R', rareholov: 'RR',
    rareholoex: 'RR', doublerare: 'RR', triplerare: 'RRR', ultrarare: 'UR',
    illustrationrare: 'AR', specialillustrationrare: 'SAR', hyperrare: 'UR',
    acespecrare: 'ACE', amazingrare: 'A', radiantrare: 'K',
    shinyrare: 'S', shinyultrarare: 'SSR',
  };
  return codes[normalized] ?? rarity;
}

function PokemonCardMetadata({ metadata, illustrator, illustratorLabel }: { metadata: ReturnType<typeof pokemonCardMetadata>; illustrator?: string; illustratorLabel?: string }) {
  const pathname = usePathname();
  const illustratorName = illustrator?.trim();
  const illustratorHref = illustratorName
    ? `${pathname === '/id' || pathname.startsWith('/id/') ? '/id' : ''}/pokemon?illustrator=${encodeURIComponent(illustratorName)}`
    : undefined;
  return <span className={`pokemon-card-meta-row${illustrator?.trim() ? ' has-illustrator' : ''}`} aria-label={[metadata.set, metadata.number, metadata.rarity, metadata.regulation && `Regulation ${metadata.regulation}`, illustrator?.trim() && `Illustrator ${illustrator.trim()}`].filter(Boolean).join(' ')}>
    {metadata.set && <small className="pokemon-card-set-badge">{metadata.set}</small>}
    {metadata.set && metadata.number && <span className="pokemon-card-meta-divider" aria-hidden="true"/>}
    {metadata.number && <small className="pokemon-card-number">{metadata.number}</small>}
    {metadata.rarity && <small className="pokemon-card-rarity">{metadata.rarity}</small>}
    {metadata.regulation && <small className="pokemon-card-regulation" aria-label={`Regulation mark ${metadata.regulation}`}>{metadata.regulation}</small>}
    {illustratorName && illustratorHref && <span className="pokemon-card-illustrator-inline"><small>{illustratorLabel ?? 'Illustrator'}</small><Link href={illustratorHref} aria-label={`Filter cards illustrated by ${illustratorName}`}><strong>{illustratorName}</strong></Link></span>}
  </span>;
}

function formatPokemonNumber(value: string | undefined, total: number | undefined) {
  const number = value?.trim() ?? '';
  if (!number) return '';
  if (number.includes('/')) return number;
  return /^\d+$/.test(number) && Number.isFinite(total) && Number(total) > 0 ? `${number}/${total}` : number;
}

function categoryLabel(value: string, id: boolean) {
  if (value.toLowerCase() === 'pokemon') return id ? 'Pokémon' : 'Pokémon';
  if (value.toLowerCase() === 'trainer') return id ? 'Trainer' : 'Trainer';
  if (value.toLowerCase() === 'energy') return id ? 'Energi' : 'Energy';
  return value;
}
