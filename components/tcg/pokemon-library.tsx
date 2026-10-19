'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MagnifyingGlassIcon as Search, PencilSimpleIcon as Pencil, ArrowUpRightIcon, CaretDownIcon as ChevronDown, SlidersHorizontalIcon as SlidersHorizontal } from '@phosphor-icons/react';
import { CardArt } from '@/components/tcg/card-art';
import { PokemonCardText } from '@/components/tcg/pokemon-card-text';
import { pokemonExpansionArt } from '@/components/tcg/pokemon-expansion-art';
import { MultiFilter, Picker } from '@/components/tcg/catalog';
import { versionedCardCatalogUrl } from '@/lib/card-catalog-cache';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type GameCard = {
  id: string; rarity: string; variant: string; set_code: string; set_name: string; printing_code: string;
  language: string; attribute?: string; card_image_url?: string | null;
  source_payload?: { illustrator?: string; localId?: string; set?: { cardCount?: { total?: number } }; [key: string]: unknown };
  tcg_card_identities?: { code: string; name: string; color: string; card_type: string; cost: number; power: number; effect_text: string };
};
type SetRecord = { code: string; name: string; productImageUrl?: string; series?: string; releaseYear?: number };
type SortOrder = 'latest' | 'number' | 'name' | 'rarity' | 'hp';
type PokemonFacets = { rarities?: string[]; illustrators?: string[]; types?: string[]; categories?: string[]; stages?: string[]; attackEnergies?: string[]; regulations?: string[]; retreats?: string[]; weaknesses?: string[]; resistances?: string[] };
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
  const [illustratorSearch, setIllustratorSearch] = useState('');
  const illustratorQuery = useDeferredValue(illustratorSearch).trim();
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
    if(illustratorQuery) params.set('illustratorQ',illustratorQuery);
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
        setCards(result.cards ?? []);
        setHasMore((result.cards?.length ?? 0) === 240);
      })
      .catch(error => { if (error.name !== 'AbortError') { setCards([]); setLoadError(true); setHasMore(false); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [language, setFilters, searchQuery, illustratorQuery, rarityFilters, typeFilters, categoryFilters, stageFilters, energyFilters, regulationFilters, retreatFilters, weaknessFilters, resistanceFilters, hpMin, hpMax, sort, retryVersion]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(versionedCardCatalogUrl(`/api/cards/sets?game=pokemon&language=${language}`), { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<{ sets?: SetRecord[] }> : { sets: [] })
      .then(result => setSets(result.sets ?? []))
      .catch(error => { if (error.name !== 'AbortError') setSets([]); });
    fetch(versionedCardCatalogUrl(`/api/cards/catalog/facets?game=pokemon&language=${language}`), { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<PokemonFacets> : {} as PokemonFacets)
      .then(result => { setRarities(result.rarities ?? []); setTypeOptions(result.types ?? []); setCategoryOptions(result.categories ?? []); setStageOptions(result.stages ?? []); setEnergyOptions(result.attackEnergies ?? []); setRegulationOptions(result.regulations ?? []); setRetreatOptions(result.retreats ?? []); setWeaknessOptions(result.weaknesses ?? []); setResistanceOptions(result.resistances ?? []); })
      .catch(error => { if (error.name !== 'AbortError') { setRarities([]); setTypeOptions([]); setCategoryOptions([]); setStageOptions([]); setEnergyOptions([]); setRegulationOptions([]); setRetreatOptions([]); setWeaknessOptions([]); setResistanceOptions([]); } });
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
      if(illustratorQuery) params.set('illustratorQ',illustratorQuery);
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
  const hasFilters = Boolean(query.trim() || illustratorSearch.trim() || setFilters.length || rarityFilters.length || typeFilters.length || categoryFilters.length || stageFilters.length || energyFilters.length || regulationFilters.length || retreatFilters.length || weaknessFilters.length || resistanceFilters.length || hpMin || hpMax || sort !== 'latest');
  const advancedFilterCount = stageFilters.length + energyFilters.length + regulationFilters.length + retreatFilters.length + weaknessFilters.length + resistanceFilters.length + (hpMin||hpMax?1:0) + (illustratorSearch.trim()?1:0);
  const clearFilters = () => { setQuery(''); setSearchQuery(''); setIllustratorSearch(''); setSetFilters([]); setRarityFilters([]); setTypeFilters([]); setCategoryFilters([]); setStageFilters([]); setEnergyFilters([]); setRegulationFilters([]); setRetreatFilters([]); setWeaknessFilters([]); setResistanceFilters([]); setHpMin(''); setHpMax(''); setSort('latest'); };
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
      <div className="pokemon-library-searches"><label className="search-box"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={id ? 'Cari nama atau nomor kartu' : 'Search name or card number'}/></label></div>
      <div className="pokemon-library-filterbar">
        <div className="pokemon-library-filters">
          <MultiFilter label="Set" values={sets.map(set=>({value:set.code,label:`${set.name} (${set.code})`,image:pokemonExpansionArt(set.name,set.code)??set.productImageUrl,group:set.series||(set.releaseYear?String(set.releaseYear):id?'Set lainnya':'Other sets')}))} selected={setFilters} onToggle={value=>setSetFilters(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])} searchPlaceholder={id ? 'Cari set' : 'Find a set'}/>
          <MultiFilter label={id?'Tipe':'Type'} values={typeOptions} selected={typeFilters} onToggle={value=>toggle(typeFilters,setTypeFilters,value)} searchPlaceholder={id?'Cari tipe Pokémon':'Find a Pokémon type'}/>
          <MultiFilter label={id?'Kelangkaan':'Rarity'} values={rarities} selected={rarityFilters} onToggle={value=>toggle(rarityFilters,setRarityFilters,value)} searchPlaceholder={id ? 'Cari rarity' : 'Find a rarity'}/>
          <MultiFilter label={id?'Jenis kartu':'Card type'} values={categoryOptions.map(value=>({value,label:categoryLabel(value,id)}))} selected={categoryFilters} onToggle={value=>toggle(categoryFilters,setCategoryFilters,value)}/>
          <button type="button" className={`pokemon-more-filters-trigger ${moreFiltersOpen?'is-open':''}`} aria-expanded={moreFiltersOpen} onClick={()=>setMoreFiltersOpen(value=>!value)}><SlidersHorizontal size={15}/>{id?'Lainnya':'More'}{advancedFilterCount>0&&<b>{advancedFilterCount}</b>}<ChevronDown size={14}/></button>
          <div className="pokemon-sort-picker"><Picker label={id?'Urutkan kartu':'Sort cards'} value={sort} onChange={value=>setSort(value as SortOrder)} leadingIcon={<SlidersHorizontal size={15}/>} options={[
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
      {moreFiltersOpen&&<div className="pokemon-library-more-filters">
        <label className="search-box pokemon-illustrator-search"><Pencil size={16}/><input value={illustratorSearch} onChange={event=>setIllustratorSearch(event.target.value)} placeholder={id?'Cari ilustrator':'Search illustrator'}/></label>
        <MultiFilter label={id?'Tahap':'Stage'} values={stageOptions} selected={stageFilters} onToggle={value=>toggle(stageFilters,setStageFilters,value)} searchPlaceholder={id?'Cari tahap':'Find a stage'}/>
        <MultiFilter label={id?'Energi serangan':'Attack energy'} values={energyOptions} selected={energyFilters} onToggle={value=>toggle(energyFilters,setEnergyFilters,value)} searchPlaceholder={id?'Cari energi':'Find an energy type'}/>
        <MultiFilter label="Regulation" values={regulationOptions} selected={regulationFilters} onToggle={value=>toggle(regulationFilters,setRegulationFilters,value)}/>
        <MultiFilter label={id?'Mundur':'Retreat'} values={retreatOptions} selected={retreatFilters} onToggle={value=>toggle(retreatFilters,setRetreatFilters,value)}/>
        <MultiFilter label={id?'Kelemahan':'Weakness'} values={weaknessOptions} selected={weaknessFilters} onToggle={value=>toggle(weaknessFilters,setWeaknessFilters,value)}/>
        <MultiFilter label={id?'Resistansi':'Resistance'} values={resistanceOptions} selected={resistanceFilters} onToggle={value=>toggle(resistanceFilters,setResistanceFilters,value)}/>
        <label className="pokemon-hp-range"><span>HP</span><input type="number" inputMode="numeric" min="0" max="999" value={hpMin} onChange={event=>setHpMin(event.target.value)} placeholder={id?'Min':'Min'}/><i>–</i><input type="number" inputMode="numeric" min="0" max="999" value={hpMax} onChange={event=>setHpMax(event.target.value)} placeholder={id?'Maks':'Max'}/></label>
      </div>}
    </section>
    <div className="pokemon-library-count" aria-live="polite">{loading ? ' ' : `${cards.length.toLocaleString(id?'id-ID':'en-US')} ${id?(cards.length===1?'kartu':'kartu'):(cards.length===1?'card':'cards')}${hasMore ? (id?' dimuat':' loaded') : ''}`}</div>
    {loading ? <div className="pokemon-card-grid" aria-label={id?'Memuat kartu Pokémon':'Loading Pokémon cards'}>{Array.from({ length: 12 }, (_, index) => <i key={index}/>)}</div> : loadError && !cards.length ? <section className="empty-state pokemon-empty"><h2>{id?'Kartu tidak dapat dimuat.':'Cards could not be loaded.'}</h2><p>{id?'Periksa koneksi Anda, lalu coba lagi.':'Check your connection and try again.'}</p><button type="button" className="button secondary" onClick={() => setRetryVersion(value => value + 1)}>{id?'Coba lagi':'Try again'}</button></section> : cards.length ? <div className="pokemon-card-grid">{cards.map(card => {
      const display = displayCard(card);
      const localNumber = card.source_payload?.localId ?? card.printing_code;
      const setTotal = card.source_payload?.set?.cardCount?.total;
      const cardNumber = formatPokemonNumber(localNumber, setTotal);
      return <button type="button" className="pokemon-card-tile" key={`${card.id}:${card.language}`} onClick={() => setSelected(card)}>
        <CardArt card={display}/>
        <span><span className="pokemon-card-name-row"><strong>{display.name}</strong>{cardNumber&&<small>{cardNumber}</small>}</span><small className="pokemon-card-set-code">{card.set_code}</small></span>
      </button>;
    })}</div> : <section className="empty-state pokemon-empty"><h2>{searchQuery||hasFilters?(id?'Tidak ada kartu yang cocok dengan filter ini.':'No cards match these filters.'):(id?'Belum ada kartu Pokémon untuk bahasa ini.':'No Pokémon cards are available in this language yet.')}</h2>{(searchQuery||hasFilters)&&<p>{id?'Coba set, rarity, ilustrator, atau nama kartu lain.':'Try another set, rarity, illustrator, or card name.'}</p>}</section>}
    {!loading && loadError && cards.length > 0 && <p className="pokemon-load-error" role="status">{id?'Kartu lainnya gagal dimuat.':'More cards could not be loaded.'} <button type="button" onClick={() => setRetryVersion(value => value + 1)}>{id?'Coba lagi':'Try again'}</button></p>}
    {!loading && hasMore && <button type="button" className="pokemon-load-more" onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore}>{loadingMore ? ' ' : id?'Muat kartu lainnya':'Load more cards'}</button>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="pokemon-card-dialog">
        {selected && <div className="pokemon-card-dialog-layout"><CardArt card={displayCard(selected)} priority/><div><DialogHeader><p className="kicker">{selected.set_name}</p><DialogTitle>{selected.tcg_card_identities?.name ?? selected.printing_code}</DialogTitle><DialogDescription className="pokemon-dialog-meta">{[selected.printing_code,selected.language,cleanRarity(selected.rarity),typeof selected.source_payload?.illustrator==='string'?selected.source_payload.illustrator:''].filter(Boolean).map((value,index)=><span key={`${index}-${value}`}>{value}</span>)}</DialogDescription></DialogHeader><PokemonCardText language={selected.language} source={selected.source_payload}/></div></div>}
      </DialogContent>
    </Dialog>
  </main>;
}

function cleanRarity(value?: string | null) {
  const rarity = value?.trim();
  return rarity && !['unknown','none','null'].includes(rarity.toLowerCase()) ? rarity : '';
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
