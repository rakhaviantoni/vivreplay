'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MagnifyingGlassIcon as Search, ArrowUpRightIcon, CaretDownIcon as ChevronDown, CaretLeftIcon, CaretRightIcon, SlidersHorizontalIcon as SlidersHorizontal, SortAscendingIcon as SortAscending, ArrowSquareOutIcon, StorefrontIcon, PlusIcon } from '@phosphor-icons/react';
import { CardArt } from '@/components/tcg/card-art';
import { FeedbackLaunchButton } from '@/components/tcg/feedback-launch';
import { PokemonCardText, PokemonCardVitals, PokemonMechanicText, pokemonRuleAbilities, trainerEffectText } from '@/components/tcg/pokemon-card-text';
import { pokemonExpansionArt } from '@/components/tcg/pokemon-expansion-art';
import { MultiFilter, Picker } from '@/components/tcg/catalog';
import { versionedCardCatalogUrl } from '@/lib/card-catalog-cache';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { WishlistButton } from '@/components/tcg/market-saved';
import { ShareButton, type ShareCardDetails } from '@/components/tcg/share';
import { MarketSellAction } from '@/components/tcg/market-sell-action';
import { CollectionForm } from '@/components/tcg/collection-form';
import { useAccount } from '@/lib/client';
import { CardMarketPanel } from '@/components/tcg/card-market-panel';
import { pokemonRarityLabel } from '@/lib/pokemon-rarity';

type GameCard = {
  id: string; rarity: string; variant: string; set_code: string; set_name: string; printing_code: string;
  language: string; attribute?: string; card_image_url?: string | null;
  source_payload?: { illustrator?: string; localId?: string; rarity?: string; pricing?: unknown; set?: { cardCount?: { official?: number; total?: number } }; [key: string]: unknown };
  tcg_card_identities?: { code: string; name: string; color: string; card_type: string; cost: number; power: number; effect_text: string };
};
type SetRecord = { code: string; name: string; productImageUrl?: string; series?: string; releaseYear?: number };
type SortOrder = 'latest' | 'number' | 'name' | 'rarity' | 'hp';
type PokemonFacets = { rarities?: string[]; illustrators?: string[]; types?: string[]; categories?: string[]; stages?: string[]; attackEnergies?: string[]; regulations?: string[]; retreats?: string[]; weaknesses?: string[]; resistances?: string[] };
type DisplayCard = { id: string; code: string; name: string; color: string; type: 'Character'; cost: number; power: number; rarity: string; art: number; effect: string; imageUrl?: string; setCode?: string; language?: string; printingCode?: string; variant?: string; gameSlug: 'pokemon' };

const languages = ['ID', 'EN', 'JP'] as const;
type Language = typeof languages[number];

export function PokemonLibrary({ initialSet, initialQuery, initialIllustrator, initialCard, initialPrinting }: { initialSet?: string; initialQuery?: string; initialIllustrator?: string; initialCard?: string; initialPrinting?: string }) {
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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
  const openedPrintingQuery = useRef('');
  const [vaultFormOpen, setVaultFormOpen] = useState(false);
  const { data: account, refresh: refreshAccount, loading: accountLoading } = useAccount();
  const [relatedPrintings, setRelatedPrintings] = useState<GameCard[]>([]);
  const [relatedPrintingsLoading, setRelatedPrintingsLoading] = useState(false);
  const relatedPrintingsTrack = useRef<HTMLDivElement>(null);
  const relatedDrag = useRef({ pointerId: -1, startX: 0, startScrollLeft: 0, moved: false });
  const [relatedDragging, setRelatedDragging] = useState(false);
  const [relatedScrollState, setRelatedScrollState] = useState({ left: false, right: false });
  const [missingImageIds, setMissingImageIds] = useState<Record<string, boolean>>({});
  const markImageMissing = useCallback((printingId: string) => {
    setMissingImageIds(current => current[printingId] ? current : { ...current, [printingId]: true });
  }, []);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailTransitionId = useRef(0);
  const detailLoadingTimer = useRef<number | null>(null);
  const evolutionCardRequest = useRef<AbortController | null>(null);
  const beginDetailTransition = () => {
    evolutionCardRequest.current?.abort();
    if (detailLoadingTimer.current !== null) window.clearTimeout(detailLoadingTimer.current);
    detailLoadingTimer.current = null;
    detailTransitionId.current += 1;
    setDetailLoading(true);
    return { id: detailTransitionId.current, startedAt: Date.now() };
  };
  const finishDetailTransition = (transition: { id: number; startedAt: number }) => {
    if (transition.id !== detailTransitionId.current) return;
    const delay = Math.max(0, 150 - (Date.now() - transition.startedAt));
    detailLoadingTimer.current = window.setTimeout(() => {
      if (transition.id === detailTransitionId.current) setDetailLoading(false);
      detailLoadingTimer.current = null;
    }, delay);
  };
  const selectDetailCard = (card: GameCard) => {
    const transition = beginDetailTransition();
    setSelected(card);
    finishDetailTransition(transition);
  };
  const selectedIndex = selected ? cards.findIndex(card => card.id === selected.id) : -1;
  const navigateSelected = (step: number) => {
    if (cards.length < 2) return;
    const index = selectedIndex < 0 ? 0 : (selectedIndex + step + cards.length) % cards.length;
    const card = cards[index];
    if (card) selectDetailCard(card);
  };
  const startRelatedDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) {
      relatedDrag.current = { pointerId: -1, startX: 0, startScrollLeft: 0, moved: false };
      return;
    }
    relatedDrag.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: event.currentTarget.scrollLeft, moved: false };
  };
  const moveRelatedDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = relatedDrag.current;
    if (drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 5) {
      drag.moved = true;
      setRelatedDragging(true);
      event.currentTarget.scrollLeft = drag.startScrollLeft - delta;
    }
  };
  const finishRelatedDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (relatedDrag.current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    relatedDrag.current.pointerId = -1;
    if (event.type !== 'pointerup') relatedDrag.current.moved = false;
    setRelatedDragging(false);
  };
  const updateRelatedScrollState = () => {
    const track = relatedPrintingsTrack.current;
    if (!track) return;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const scrollLeft = Math.max(0, Math.min(track.scrollLeft, maxScroll));
    setRelatedScrollState({ left: scrollLeft > 3, right: maxScroll - scrollLeft > 3 });
  };
  useEffect(() => {
    const frame = window.requestAnimationFrame(updateRelatedScrollState);
    window.addEventListener('resize', updateRelatedScrollState);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateRelatedScrollState);
    };
  }, [relatedPrintings, relatedPrintingsLoading]);
  useEffect(() => {
    const stopDrag = (event: PointerEvent) => {
      if (relatedDrag.current.pointerId !== event.pointerId) return;
      relatedDrag.current.pointerId = -1;
      if (event.type !== 'pointerup') relatedDrag.current.moved = false;
      setRelatedDragging(false);
    };
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
    return () => {
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
  }, []);
  useEffect(() => {
    const track = relatedPrintingsTrack.current;
    if (track) track.scrollLeft = 0;
    setRelatedScrollState({ left: false, right: false });
    const frame = window.requestAnimationFrame(updateRelatedScrollState);
    return () => window.cancelAnimationFrame(frame);
  }, [selected?.id]);
  const openEvolutionCard = async (code: string) => {
    const transition = beginDetailTransition();
    const loadedCard = cards.find(card => card.tcg_card_identities?.code === code);
    if (loadedCard) { setSelected(loadedCard); finishDetailTransition(transition); return; }
    const controller = new AbortController();
    evolutionCardRequest.current = controller;
    try {
      for (const cardLanguage of language === 'EN' ? ['EN'] : [language, 'EN']) {
        const params = new URLSearchParams({ game: 'pokemon', language: cardLanguage, codes: code });
        const response = await fetch(versionedCardCatalogUrl(`/api/cards/catalog?${params}`), { signal: controller.signal });
        if (!response.ok) continue;
        const result = await response.json() as { cards?: GameCard[] };
        const card = result.cards?.find(candidate => candidate.tcg_card_identities?.code === code);
        if (card && transition.id === detailTransitionId.current) { setSelected(card); break; }
      }
    } catch { /* Keep the current detail open if the related card cannot load. */ }
    finally { finishDetailTransition(transition); }
  };

  useEffect(() => () => {
    if (detailLoadingTimer.current !== null) window.clearTimeout(detailLoadingTimer.current);
    evolutionCardRequest.current?.abort();
  }, []);

  const selectedCardName = selected?.tcg_card_identities?.name;
  const selectedLanguage = selected?.language;
  useEffect(() => {
    if (!selectedCardName || !selectedLanguage) {
      setRelatedPrintings([]);
      setRelatedPrintingsLoading(false);
      return;
    }
    const controller = new AbortController();
    setRelatedPrintings([]);
    setRelatedPrintingsLoading(true);
    // Pokémon reprints can be stored under different identity codes. Search by
    // card name, then keep exact name matches so every set printing is included.
    const normalizeCardName = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const normalizedName = normalizeCardName(selectedCardName);
    const params = new URLSearchParams({ game: 'pokemon', language: selectedLanguage, q: selectedCardName, limit: '500' });
    fetch(versionedCardCatalogUrl(`/api/cards/catalog?${params}`), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Related printings unavailable');
        const result = await response.json() as { cards?: GameCard[] };
        if (!controller.signal.aborted) setRelatedPrintings((result.cards ?? []).filter(card => normalizeCardName(card.tcg_card_identities?.name ?? '') === normalizedName));
      })
      .catch(() => { if (!controller.signal.aborted) setRelatedPrintings([]); })
      .finally(() => { if (!controller.signal.aborted) setRelatedPrintingsLoading(false); });
    return () => controller.abort();
  }, [selectedCardName, selectedLanguage]);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if ((event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) || event.target instanceof HTMLElement && event.target.isContentEditable) return;
      event.preventDefault();
      if (cards.length < 2) return;
      const nextIndex = selectedIndex < 0 ? 0 : (selectedIndex + (event.key === 'ArrowLeft' ? -1 : 1) + cards.length) % cards.length;
      const nextCard = cards[nextIndex];
      if (nextCard) selectDetailCard(nextCard);
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
    if ((!initialPrinting && !initialCard) || loading) return;
    const queryKey = `${initialPrinting ?? ''}:${initialCard ?? ''}`;
    if (openedPrintingQuery.current === queryKey) return;
    openedPrintingQuery.current = queryKey;
    const existing = cards.find(card => initialPrinting ? card.id === initialPrinting : card.tcg_card_identities?.code.toUpperCase() === initialCard?.toUpperCase());
    if (existing) { setSelected(existing); return; }
    const controller = new AbortController();
    const params = new URLSearchParams({ game: 'pokemon', language });
    if (initialPrinting) params.set('ids', initialPrinting);
    else if (initialCard) params.set('code', initialCard);
    fetch(versionedCardCatalogUrl(`/api/cards/catalog?${params}`), { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<{ cards?: GameCard[] }> : { cards: [] })
      .then(result => { const match = result.cards?.find(card => initialPrinting ? card.id === initialPrinting : card.tcg_card_identities?.code.toUpperCase() === initialCard?.toUpperCase()); if (match && !controller.signal.aborted) setSelected(match); })
      .catch(() => { openedPrintingQuery.current = ''; });
    return () => controller.abort();
  }, [initialCard, initialPrinting, language, loading, cards]);

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
    rarity: pokemonRarityLabel(cleanRarity(card.rarity) || card.source_payload?.rarity, card.language),
    art: 0,
    effect: card.tcg_card_identities?.effect_text ?? '',
    imageUrl: card.card_image_url ?? undefined,
    setCode: card.set_code,
    language: card.language,
    printingCode: card.printing_code,
    variant: card.variant,
    gameSlug: 'pokemon',
  });
  const hasFilters = Boolean(query.trim() || setFilters.length || rarityFilters.length || illustratorFilters.length || typeFilters.length || categoryFilters.length || stageFilters.length || energyFilters.length || regulationFilters.length || retreatFilters.length || weaknessFilters.length || resistanceFilters.length || hpMin || hpMax || sort !== 'latest');
  const advancedFilterCount = stageFilters.length + energyFilters.length + regulationFilters.length + retreatFilters.length + weaknessFilters.length + resistanceFilters.length + (hpMin||hpMax?1:0);
  const activeFilterCount = setFilters.length + rarityFilters.length + illustratorFilters.length + typeFilters.length + categoryFilters.length + advancedFilterCount;
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
    <section className={`library-controls pokemon-library-controls${mobileFiltersOpen?' mobile-filters-open':''}`} aria-label={id ? 'Filter kartu Pokémon' : 'Pokémon card filters'}>
      <div className="pokemon-library-searches"><label className="search-box"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={id ? 'Cari nama atau nomor kartu' : 'Search name or card number'}/></label></div>
      <button type="button" className={`library-mobile-filter-toggle${mobileFiltersOpen?' is-open':''}`} aria-expanded={mobileFiltersOpen} aria-controls="pokemon-library-facets" onClick={()=>setMobileFiltersOpen(value=>!value)}><SlidersHorizontal size={15}/><span>{id?'Filter':'Filters'}</span>{activeFilterCount>0&&<b>{activeFilterCount}</b>}<ChevronDown size={14}/></button>
      <div className={`pokemon-library-filter-content${mobileFiltersOpen?' is-open':''}`} id="pokemon-library-facets">
      <div className="pokemon-library-filterbar">
        <div className="pokemon-library-filters">
          <div className="pokemon-primary-filters">
          <MultiFilter label="Set" values={sets.map(set=>({value:set.code,label:`${set.name} (${set.code})`,image:pokemonExpansionArt(set.name,set.code)??set.productImageUrl,group:set.series||(set.releaseYear?String(set.releaseYear):id?'Set lainnya':'Other sets')}))} selected={setFilters} onToggle={value=>setSetFilters(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])} searchPlaceholder={id ? 'Cari set' : 'Find a set'}/>
          <MultiFilter label={id?'Tipe':'Type'} values={typeOptions} selected={typeFilters} onToggle={value=>toggle(typeFilters,setTypeFilters,value)} searchPlaceholder={id?'Cari tipe Pokémon':'Find a Pokémon type'}/>
          <MultiFilter label={id?'Kelangkaan':'Rarity'} values={rarities.map(value=>({value,label:pokemonRarityLabel(value,language)}))} selected={rarityFilters} onToggle={value=>toggle(rarityFilters,setRarityFilters,value)} searchPlaceholder={id ? 'Cari rarity' : 'Find a rarity'}/>
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
      </div>
    </section>
    <div className="pokemon-library-count" aria-live="polite">{loading ? cards.length ? (id?'Memperbarui kartu…':'Updating cards…') : (id?'Memuat kartu…':'Loading cards…') : `${cards.length.toLocaleString(id?'id-ID':'en-US')} ${id?(cards.length===1?'kartu':'kartu'):(cards.length===1?'card':'cards')}${hasMore ? (id?' dimuat':' loaded') : ''}`}</div>
    {loading && !cards.length ? <div className="pokemon-card-grid" aria-label={id?'Memuat kartu Pokémon':'Loading Pokémon cards'}>{Array.from({ length: 12 }, (_, index) => <i key={index}/>)}</div> : loadError && !cards.length ? <section className="empty-state pokemon-empty"><h2>{id?'Kartu tidak dapat dimuat.':'Cards could not be loaded.'}</h2><p>{id?'Periksa koneksi Anda, lalu coba lagi.':'Check your connection and try again.'}</p><button type="button" className="button secondary" onClick={() => setRetryVersion(value => value + 1)}>{id?'Coba lagi':'Try again'}</button></section> : cards.length ? <div className="pokemon-card-grid" aria-busy={loading}>{cards.map(card => {
      const display = displayCard(card);
      const metadata = pokemonCardMetadata(card);
      return <div className="pokemon-card-tile-wrap" key={`${card.id}:${card.language}`}>
        <button type="button" className="pokemon-card-tile" onClick={() => selectDetailCard(card)}>
          <CardArt card={display} onImageMissing={() => markImageMissing(card.id)}/>
          <span className="pokemon-card-caption"><strong>{display.name}</strong><PokemonCardMetadata metadata={metadata}/></span>
        </button>
        {missingImageIds[card.id] && <div className="pokemon-missing-image-report-overlay"><FeedbackLaunchButton className="pokemon-missing-image-report" request={{initialCategory:'missing-printing',cardCode:card.tcg_card_identities?.code,printingId:card.id}}>{id?'Laporkan gambar hilang':'Report missing image'}</FeedbackLaunchButton></div>}
      </div>;
    })}</div> : <section className="empty-state pokemon-empty"><h2>{searchQuery||hasFilters?(id?'Tidak ada kartu yang cocok dengan filter ini.':'No cards match these filters.'):(id?'Belum ada kartu Pokémon untuk bahasa ini.':'No Pokémon cards are available in this language yet.')}</h2>{(searchQuery||hasFilters)&&<p>{id?'Ubah pencarian atau hapus salah satu filter.':'Change your search or clear a filter.'}</p>}</section>}
    {!loading && loadError && cards.length > 0 && <p className="pokemon-load-error" role="status">{id?'Kartu lainnya gagal dimuat.':'More cards could not be loaded.'} <button type="button" onClick={() => setRetryVersion(value => value + 1)}>{id?'Coba lagi':'Try again'}</button></p>}
    {!loading && hasMore && <button type="button" className="pokemon-load-more" onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore}>{loadingMore ? ' ' : id?'Muat kartu lainnya':'Load more cards'}</button>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) { detailTransitionId.current += 1; if (detailLoadingTimer.current !== null) window.clearTimeout(detailLoadingTimer.current); evolutionCardRequest.current?.abort(); setDetailLoading(false); setSelected(null); } }}>
      <DialogContent className="pokemon-card-dialog" aria-busy={detailLoading}>
        {selected && detailLoading ? <PokemonDetailSkeleton id={id}/> : selected && <>
          <div className="pokemon-card-dialog-layout"><div className="pokemon-card-dialog-art-column"><div className="pokemon-dialog-art-wrap">{cards.length > 1 && <button type="button" className="pokemon-dialog-nav pokemon-dialog-mobile-nav pokemon-dialog-prev" aria-label={id ? 'Kartu sebelumnya' : 'Previous card'} onClick={() => navigateSelected(-1)}><CaretLeftIcon size={22}/></button>}<CardArt card={displayCard(selected)} priority onImageMissing={() => markImageMissing(selected.id)} missingImageAction={missingImageIds[selected.id]&&<FeedbackLaunchButton className="pokemon-missing-image-report" request={{initialCategory:'missing-printing',cardCode:selected.tcg_card_identities?.code,printingId:selected.id}}>{id?'Laporkan gambar hilang':'Report missing image'}</FeedbackLaunchButton>}/>{cards.length > 1 && <button type="button" className="pokemon-dialog-nav pokemon-dialog-mobile-nav pokemon-dialog-next" aria-label={id ? 'Kartu berikutnya' : 'Next card'} onClick={() => navigateSelected(1)}><CaretRightIcon size={22}/></button>}</div></div><div className="pokemon-card-dialog-details"><DialogHeader><div className="pokemon-dialog-title-row"><DialogTitle><PokemonMechanicText text={selected.tcg_card_identities?.name ?? selected.printing_code}/></DialogTitle><PokemonCardVitals source={selected.source_payload} language={selected.language}/></div><DialogDescription asChild><div className="pokemon-dialog-meta"><PokemonCardMetadata metadata={pokemonCardMetadata(selected)} setName={selected.set_name} illustrator={selected.source_payload?.illustrator} illustratorLabel="Illus."/></div></DialogDescription></DialogHeader><PokemonCardText code={selected.tcg_card_identities?.code} name={selected.tcg_card_identities?.name} language={selected.language} source={selected.source_payload} onEvolutionSelect={openEvolutionCard}/><div className="pokemon-dialog-actions"><button type="button" className="button secondary" disabled={accountLoading} onClick={()=>{if(!account){window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));return;}setVaultFormOpen(true)}}><PlusIcon size={16}/>{id?'Tambahkan ke Vault':'Add to Vault'}</button><WishlistButton printingId={selected.id} language={id ? 'ID' : 'EN'}/><ShareButton title={selected.tcg_card_identities?.name ?? selected.printing_code} path={localize(`/pokemon?printing=${encodeURIComponent(selected.id)}&card=${encodeURIComponent(selected.tcg_card_identities?.code ?? selected.printing_code)}&lang=${selected.language}`)} card={displayCard(selected)} cardDetails={pokemonShareDetails(selected, id)} entityType="card"/>{pathname !== '/pokemon' && pathname !== '/id/pokemon' && <Link className="button secondary" href={localize(`/pokemon?q=${encodeURIComponent(selected.tcg_card_identities?.name ?? selected.printing_code)}`)}><ArrowSquareOutIcon size={16}/>{id ? 'Buka di katalog' : 'Open in library'}</Link>}<div className="pokemon-dialog-market-actions"><Link className="button secondary" href={`/market?game=pokemon&printing=${encodeURIComponent(selected.id)}`}><StorefrontIcon size={16}/>{id ? 'Beli kartu' : 'Buy a copy'}</Link><MarketSellAction className="button secondary" printingId={selected.id}><StorefrontIcon size={16}/>{id ? 'Jual kartu ini' : 'Sell a copy'}</MarketSellAction></div></div></div><div className="pokemon-dialog-market-data"><PokemonPriceGuide source={selected.source_payload} cardName={selected.tcg_card_identities?.name??selected.printing_code} preferredCurrency={account?.profile.currency} id={id}/><CardMarketPanel game="pokemon" printingId={selected.id} printing={{language:'EN',setCode:selected.set_code,printingCode:selected.printing_code,variant:selected.variant}} disableExternalPrice/></div></div>
          {(relatedPrintingsLoading || relatedPrintings.some(printing => printing.id !== selected.id)) && <section className={`pokemon-related-printings${relatedScrollState.left?' has-left-overflow':''}${relatedScrollState.right?' has-right-overflow':''}`} aria-label={id ? 'Kartu terkait' : 'Related cards'}>
            <header><h3>{id ? 'Kartu terkait' : 'Related cards'}</h3><div className="pokemon-related-printings-controls"><button type="button" aria-label={id ? 'Gulir ke kiri' : 'Scroll left'} disabled={!relatedScrollState.left} onClick={() => relatedPrintingsTrack.current?.scrollBy({ left: -360, behavior: 'smooth' })}><CaretLeftIcon size={18}/></button><button type="button" aria-label={id ? 'Gulir ke kanan' : 'Scroll right'} disabled={!relatedScrollState.right} onClick={() => relatedPrintingsTrack.current?.scrollBy({ left: 360, behavior: 'smooth' })}><CaretRightIcon size={18}/></button></div></header>
            <div className={`pokemon-related-printings-track${relatedDragging ? ' is-dragging' : ''}`} ref={relatedPrintingsTrack} aria-busy={relatedPrintingsLoading} onScroll={updateRelatedScrollState} onLoad={updateRelatedScrollState} onPointerDown={startRelatedDrag} onPointerMove={moveRelatedDrag} onPointerUp={finishRelatedDrag} onPointerCancel={finishRelatedDrag} onClickCapture={event => { if (relatedDrag.current.moved) { event.preventDefault(); event.stopPropagation(); relatedDrag.current.moved = false; } }}>
              {relatedPrintingsLoading ? Array.from({ length: 4 }, (_, index) => <i className="pokemon-related-printing-skeleton" key={index}/>) : relatedPrintings.filter((printing, index, all) => printing.id !== selected.id && all.findIndex(item => item.id === printing.id) === index).map(printing => <div className="pokemon-related-printing-wrap" key={printing.id}><button type="button" className="pokemon-related-printing" onClick={() => selectDetailCard(printing)}><CardArt card={displayCard(printing)} imageWidth={220} onImageMissing={() => markImageMissing(printing.id)}/><span className="pokemon-card-caption"><strong>{printing.tcg_card_identities?.name ?? printing.printing_code}</strong><PokemonCardMetadata metadata={pokemonCardMetadata(printing)}/></span></button>{missingImageIds[printing.id]&&<div className="pokemon-missing-image-report-overlay"><FeedbackLaunchButton className="pokemon-missing-image-report" request={{initialCategory:'missing-printing',cardCode:printing.tcg_card_identities?.code,printingId:printing.id}}>{id?'Laporkan gambar hilang':'Report missing image'}</FeedbackLaunchButton></div>}</div>)}
            </div>
          </section>}
        </>}
      </DialogContent>
      {selected && cards.length > 1 && <DialogPortal><button type="button" className="pokemon-dialog-nav pokemon-dialog-desktop-nav pokemon-dialog-prev" aria-label={id ? 'Kartu sebelumnya' : 'Previous card'} onClick={() => navigateSelected(-1)}><CaretLeftIcon size={22}/></button><button type="button" className="pokemon-dialog-nav pokemon-dialog-desktop-nav pokemon-dialog-next" aria-label={id ? 'Kartu berikutnya' : 'Next card'} onClick={() => navigateSelected(1)}><CaretRightIcon size={22}/></button></DialogPortal>}
    </Dialog>
    {selected&&<CollectionForm printingId={selected.id} open={vaultFormOpen} onClose={()=>setVaultFormOpen(false)} onSaved={refreshAccount} name={selected.tcg_card_identities?.name??selected.printing_code} previewCard={displayCard(selected)} language={id?'ID':'EN'} gameSlug="pokemon"/>}
  </main>;
}

function PokemonDetailSkeleton({ id }: { id: boolean }) {
  const loadingLabel = id ? 'Memuat detail kartu Pokémon' : 'Loading Pokémon card details';
  return <>
    <div className="pokemon-card-dialog-layout pokemon-dialog-skeleton-layout" role="status" aria-label={loadingLabel}>
      <div className="pokemon-card-dialog-art-column"><div className="pokemon-dialog-skeleton-art"/></div>
      <div className="pokemon-card-dialog-details pokemon-dialog-skeleton-details">
        <i className="pokemon-dialog-skeleton-title"/><i className="pokemon-dialog-skeleton-meta"/>
        <i className="pokemon-dialog-skeleton-heading"/><i className="pokemon-dialog-skeleton-copy"/><i className="pokemon-dialog-skeleton-copy is-short"/>
        <i className="pokemon-dialog-skeleton-heading"/><i className="pokemon-dialog-skeleton-copy"/><i className="pokemon-dialog-skeleton-copy is-medium"/>
        <div className="pokemon-dialog-skeleton-evolution"><i/><div><i/><b/><i/><span/><i/><b/><i/></div></div>
        <i className="pokemon-dialog-skeleton-facts"/>
      </div>
      <div className="pokemon-dialog-market-data pokemon-dialog-skeleton-market"><i/><i/></div>
    </div>
    <span className="sr-only" aria-live="polite">{loadingLabel}</span>
  </>;
}

type PokemonPriceSource = { pricing?: unknown };
type PriceProvider = { updated?: unknown; unit?: unknown; [key:string]:unknown };
type PriceGuideRate = {date:string;rate:number};
const priceGuideRateCache=new Map<string,Promise<PriceGuideRate|null>>();
function getPriceGuideRate(from:string,to:string){
  const key=`${from}:${to}`;
  const cached=priceGuideRateCache.get(key);
  if(cached)return cached;
  const request=fetch(`https://api.frankfurter.dev/v2/providers/ecb/rate/${from.toLowerCase()}/${to.toLowerCase()}`,{cache:'force-cache'})
    .then(async response=>{
      if(!response.ok)return null;
      const rate=await response.json() as {date?:string;rate?:number};
      return rate.date&&typeof rate.rate==='number'&&Number.isFinite(rate.rate)?{date:rate.date,rate:rate.rate}:null;
    }).catch(()=>null);
  priceGuideRateCache.set(key,request);
  return request;
}
function PokemonPriceGuide({source,cardName,preferredCurrency,id}:{source?:PokemonPriceSource;cardName:string;preferredCurrency?:string;id:boolean}) {
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
    const rawUpdated=typeof record.updated==='string'?record.updated:typeof record.updated==='number'?new Date(record.updated<1_000_000_000_000?record.updated*1000:record.updated).toISOString():undefined;
    const parsedUpdated=rawUpdated?new Date(rawUpdated):undefined;
    const updated=parsedUpdated&&!Number.isNaN(parsedUpdated.valueOf())?parsedUpdated.toISOString():undefined;
    const suppliedUrl=typeof record.url==='string'?record.url:'';
    const searchUrl=name==='Cardmarket'
      ?`https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(cardName)}`
      :`https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(cardName)}`;
    let href=searchUrl;
    try{if(/^https:\/\//i.test(suppliedUrl))href=new URL(suppliedUrl).href}catch{/* Use the provider search when no valid card URL is supplied. */}
    return entries.length?[{name,currency,updated,entries,href}]:[];
  });
  const rateKey=preferredCurrency&&/^(IDR|USD|JPY)$/.test(preferredCurrency)
    ?[...new Set(providers.map(provider=>provider.currency).filter(currency=>currency!==preferredCurrency))].map(currency=>`${currency}:${preferredCurrency}`).sort().join('|')
    :'';
  const [rates,setRates]=useState<{key:string;values:Record<string,PriceGuideRate>}>();
  useEffect(()=>{
    if(!rateKey)return;
    let active=true;
    const pairs=rateKey.split('|');
    void Promise.all(pairs.map(async pair=>[pair,await getPriceGuideRate(...pair.split(':') as [string,string])] as const))
      .then(results=>{if(active)setRates({key:rateKey,values:Object.fromEntries(results.filter((result):result is readonly [string,PriceGuideRate]=>Boolean(result[1])).map(([key,value])=>[key,value!]))})});
    return()=>{active=false};
  },[rateKey]);
  const exchangeRates=rates?.key===rateKey?rates.values:{};
  const hasConversion=providers.some(provider=>provider.currency!==preferredCurrency&&exchangeRates[`${provider.currency}:${preferredCurrency}`]);
  if(!providers.length)return null;
  const locale=id?'id-ID':'en-US';
  const formatPrice=(value:number,currency:string)=>new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:['IDR','JPY'].includes(currency)?0:2}).format(value);
  const rateDate=Object.values(exchangeRates).map(rate=>rate.date).sort().at(-1);
  const formattedRateDate=rateDate?new Intl.DateTimeFormat(locale,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${rateDate}T00:00:00Z`)):'';
  return <section className="pokemon-price-guide" aria-label="Market price guide">
    <h3>Price guide</h3>
    <div>{providers.map(provider=>{
      const rate=preferredCurrency&&provider.currency!==preferredCurrency?exchangeRates[`${provider.currency}:${preferredCurrency}`]:undefined;
      return <article key={provider.name}>
        <header>
          <a href={provider.href} target="_blank" rel="noreferrer" aria-label={`Search ${cardName} on ${provider.name}`}><strong>{provider.name}</strong><ArrowSquareOutIcon size={12} aria-hidden="true"/></a>
          <span className="pokemon-price-guide-source-currency">{provider.currency}</span>
          {provider.updated&&<time dateTime={provider.updated}>{new Intl.DateTimeFormat(locale,{month:'short',day:'numeric',year:'numeric'}).format(new Date(provider.updated))}</time>}
        </header>
        <ul>{provider.entries.map((entry,index)=><li key={`${entry.variant}-${entry.metric}-${index}`}>
          <span>{[entry.variant,entry.metric].filter(Boolean).join(' ')}</span>
          <b>{rate&&preferredCurrency?<><strong>≈ {formatPrice(entry.value*rate.rate,preferredCurrency)}</strong><small>{formatPrice(entry.value,provider.currency)}</small></>:formatPrice(entry.value,provider.currency)}</b>
        </li>)}</ul>
      </article>;
    })}</div>
    {hasConversion&&<p className="pokemon-price-guide-rate-note">{id?`Perkiraan konversi memakai kurs acuan ECB per ${formattedRateDate}.`:`Approximate conversion using ECB reference rates from ${formattedRateDate}.`}</p>}
  </section>;
}

function cleanRarity(value?: string | null) {
  const rarity = value?.trim();
  return rarity && !['unknown','none','null'].includes(rarity.toLowerCase()) ? rarity : '';
}

function pokemonCardMetadata(card: GameCard) {
  const count = card.source_payload?.set?.cardCount;
  const officialCount = Number(count?.official);
  const setTotal = officialCount > 0 ? officialCount : count?.total;
  const rarity = pokemonRarityLabel(cleanRarity(card.rarity) || card.source_payload?.rarity, card.language);
  return {
    set: card.set_code.trim().toLowerCase(),
    number: formatPokemonNumber(card.source_payload?.localId ?? card.printing_code, setTotal),
    rarity: rarity || (card.set_code.trim().toLowerCase() === '30th-c' ? 'CC' : ''),
    regulation: typeof card.source_payload?.regulationMark === 'string' ? card.source_payload.regulationMark.trim() : '',
  };
}

function pokemonShareDetails(card: GameCard, id: boolean): ShareCardDetails {
  const source = card.source_payload ?? {};
  const metadata = pokemonCardMetadata(card);
  const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : '';
  const facts: ShareCardDetails['facts'] = [];
  const evolvesFrom = text(source.evolvesFrom ?? source.evolveFrom);
  const weaknesses = Array.isArray(source.weaknesses) ? source.weaknesses.map((entry) => entry && typeof entry === 'object' ? {type:text((entry as Record<string,unknown>).type),value:text((entry as Record<string,unknown>).value)} : null).filter((entry):entry is {type:string;value:string}=>Boolean(entry)) : [];
  if (weaknesses.length) facts.push({label:id?'Kelemahan':'Weakness',value:weaknesses.map(entry=>entry.value).filter(Boolean).join(', '),energyTypes:weaknesses.map(entry=>entry.type).filter(Boolean)});
  const resistances = Array.isArray(source.resistances) ? source.resistances.map((entry) => entry && typeof entry === 'object' ? {type:text((entry as Record<string,unknown>).type),value:text((entry as Record<string,unknown>).value)} : null).filter((entry):entry is {type:string;value:string}=>Boolean(entry)) : [];
  if (resistances.length) facts.push({label:id?'Resistansi':'Resistance',value:resistances.map(entry=>entry.value).filter(Boolean).join(', '),energyTypes:resistances.map(entry=>entry.type).filter(Boolean)});
  if (source.retreat !== undefined && source.retreat !== null) facts.push({label:id?'Mundur':'Retreat',value:'',energyTypes:Array.from({length:Math.min(Number(source.retreat)||0,10)},()=> 'Colorless')});

  const sections: ShareCardDetails['sections'] = [];
  const parsedSource = source as Parameters<typeof pokemonRuleAbilities>[0];
  const abilities = pokemonRuleAbilities(parsedSource);
  for (const ability of abilities) {
    const name = text(ability.name);
    const effect = text(ability.effect);
    if (name || effect) sections.push({badge:text(ability.type)||'Ability',title:name,text:effect});
  }
  const attacks = Array.isArray(source.attacks) ? source.attacks : [];
  for (const entry of attacks) {
    if (!entry || typeof entry !== 'object') continue;
    const attack = entry as Record<string,unknown>;
    const name = text(attack.name);
    const damage = text(attack.damage);
    const cost = Array.isArray(attack.cost) ? attack.cost.map(String) : [];
    const effect = text(attack.effect ?? attack.text ?? attack.description);
    if (name || effect) sections.push({title:name,text:effect,damage,energyTypes:cost});
  }
  const description = text(source.description);
  if (description) sections.push({title:id?'Deskripsi':'Description',text:description});
  const trainerEffect = text(trainerEffectText(parsedSource));
  if (trainerEffect && !sections.some(section => section.text === trainerEffect)) sections.push({title:id?'Efek kartu':'Card effect',text:trainerEffect});
  return {
    gameLabel:'Pokémon TCG', language:card.language, setName:card.set_name,
    setCode:metadata.set, number:metadata.number, rarity:metadata.rarity, regulation:metadata.regulation,
    illustrator:text(source.illustrator), facts, sections,
    evolutionCode:card.tcg_card_identities?.code,evolvesFrom:text(source.evolvesFrom ?? source.evolveFrom),
    vitals:{hp:typeof source.hp==='number'?source.hp:undefined,types:Array.isArray(source.types)?source.types.map(String):[]},
  };
}

function PokemonCardMetadata({ metadata, setName, illustrator, illustratorLabel }: { metadata: ReturnType<typeof pokemonCardMetadata>; setName?: string; illustrator?: string; illustratorLabel?: string }) {
  const pathname = usePathname();
  const illustratorName = illustrator?.trim();
  const illustratorHref = illustratorName
    ? `${pathname === '/id' || pathname.startsWith('/id/') ? '/id' : ''}/pokemon?illustrator=${encodeURIComponent(illustratorName)}`
    : undefined;
  return <span className={`pokemon-card-meta-row${illustrator?.trim() ? ' has-illustrator' : ''}`} aria-label={[setName, metadata.set, metadata.number, metadata.rarity, metadata.regulation && `Regulation ${metadata.regulation}`, illustrator?.trim() && `Illustrator ${illustrator.trim()}`].filter(Boolean).join(' ')}>
    {setName?.trim() && <small className="pokemon-card-set-name" title={setName.trim()}>{setName.trim()}</small>}
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
