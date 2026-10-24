'use client';

import {useRouteLocale} from '@/components/locale-provider';
import { useEffect, useState } from 'react';
import Link from '@/components/ui/localized-link';
import { pokemonExpansionArt } from '@/components/tcg/pokemon-expansion-art';
import { ArrowUpRightIcon } from '@phosphor-icons/react';
import { CardArt } from '@/components/tcg/card-art';

type SetRecord = { code: string; name: string; releaseYear: number; releaseDate?: string; mainSetTotal: number; productImageUrl?: string };
type IntroCardRecord = { id: string; set_code: string; language: string; printing_code: string; variant: string; card_image_url?: string | null; tcg_card_identities?: { code?: string; name?: string; power?: number; effect_text?: string } };

export function PokemonSets() {
  const id = useRouteLocale() === 'ID';
  const localize = (href: string) => id ? `/id${href}` : href;
  const [language, setLanguage] = useState<'ID' | 'EN' | 'JP'>('ID');
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [introCards, setIntroCards] = useState<IntroCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/cards/sets?game=pokemon&language=${language}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Sets unavailable');
        const result = await response.json() as { sets?: SetRecord[] };
        setSets(result.sets ?? []);
      })
      .catch(error => { if (error.name !== 'AbortError') setSets([]); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    fetch(`/api/cards/catalog?game=pokemon&language=${language}&limit=240&offset=0`, { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<{ cards?: IntroCardRecord[] }> : { cards: [] })
      .then(result => setIntroCards((result.cards ?? []).filter(card => card.card_image_url).slice(0, 6)))
      .catch(error => { if (error.name !== 'AbortError') setIntroCards([]); });
    return () => controller.abort();
  }, [language]);

  return <main className="page catalog-page pokemon-catalog-page">
    <section className="library-intro pokemon-library-intro pokemon-sets-intro">
      <div className="library-intro-copy"><Link className="set-library-back" href={localize('/pokemon/cards')}>{id?'Katalog Pokémon':'Pokémon library'}</Link><p className="kicker">POKÉMON TCG</p><h1>{id?'Set dan rilisan.':'Sets and releases.'}</h1><p>{id?'Telusuri setiap rilisan berdasarkan kartu dan bahasa.':'Browse each release by its cards and language.'}</p></div>
      <div className="library-intro-rail pokemon-intro-rail" aria-hidden="true">
        <div className="library-intro-rail-cards" aria-hidden="true">{introCards.map((card,index)=><div className={`library-intro-rail-card rail-card-${index}`} key={card.id}><CardArt card={{id:card.id,code:card.tcg_card_identities?.code??card.printing_code,name:card.tcg_card_identities?.name??card.printing_code,color:'Yellow',type:'Character',cost:0,power:card.tcg_card_identities?.power??0,rarity:'',art:0,effect:card.tcg_card_identities?.effect_text??'',imageUrl:card.card_image_url??undefined,setCode:card.set_code,language:card.language,printingCode:card.printing_code,variant:card.variant}}/></div>)}{!introCards.length&&Array.from({length:6},(_,index)=><i className={`library-intro-rail-skeleton rail-card-${index}`} key={index}/>)}</div>
      </div>
    </section>
    <div className="pokemon-set-toolbar"><p>{loading ? ' ' : `${sets.length.toLocaleString(id?'id-ID':'en-US')} ${id?'set':sets.length===1?'set':'sets'}`}</p><div className="language-switch" aria-label={id?'Bahasa set':'Set language'}>{(['ID', 'EN', 'JP'] as const).map(option => <button type="button" key={option} aria-pressed={language === option} onClick={() => { setLoading(true); setLanguage(option); }}>{option}</button>)}</div></div>
    {loading ? <div className="pokemon-set-grid" aria-label={id?'Memuat set Pokémon':'Loading Pokémon sets'}>{Array.from({ length: 8 }, (_, index) => <i key={index}/>)}</div> : sets.length ? <div className="pokemon-set-grid">{sets.map(set => <Link key={set.code} href={localize(`/pokemon/cards?set=${encodeURIComponent(set.code)}`)} className="pokemon-set-card">{(pokemonExpansionArt(set.name,set.code)||set.productImageUrl)&&<img src={pokemonExpansionArt(set.name,set.code)||set.productImageUrl} alt="" loading="lazy" onError={event=>{event.currentTarget.hidden=true}}/>}<span>{set.releaseDate ? new Intl.DateTimeFormat(language === 'ID' ? 'id-ID' : language === 'JP' ? 'ja-JP' : 'en', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${set.releaseDate}T00:00:00`)) : set.releaseYear || 'Pokémon TCG'}</span><strong>{set.name}</strong><small>{set.code} <i/> {set.mainSetTotal.toLocaleString(id?'id-ID':'en-US')} {id?'kartu':set.mainSetTotal===1?'card':'cards'}</small><ArrowUpRightIcon size={17}/></Link>)}</div> : <section className="empty-state pokemon-empty"><h2>{id?'Belum ada set untuk bahasa ini':'No sets are listed for this language yet'}</h2></section>}
  </main>;
}
