'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRightIcon } from '@phosphor-icons/react';

type SetRecord = { code: string; name: string; releaseYear: number; releaseDate?: string; mainSetTotal: number };

export function PokemonSets() {
  const [language, setLanguage] = useState<'ID' | 'EN' | 'JP'>('ID');
  const [sets, setSets] = useState<SetRecord[]>([]);
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
    return () => controller.abort();
  }, [language]);

  return <main className="page catalog-page pokemon-catalog-page">
    <section className="library-intro"><div className="library-intro-copy"><Link className="set-library-back" href="/pokemon">Pokémon library</Link><p className="kicker">POKÉMON TCG</p><h1>Sets and releases.</h1><p>Browse each release by its cards and language.</p></div><div className="pokemon-intro-mark" aria-hidden="true"><span>Pokémon</span><b>TCG</b></div></section>
    <div className="pokemon-set-toolbar"><p>{loading ? ' ' : `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`}</p><div className="language-switch" aria-label="Set language">{(['ID', 'EN', 'JP'] as const).map(option => <button type="button" key={option} aria-pressed={language === option} onClick={() => { setLoading(true); setLanguage(option); }}>{option}</button>)}</div></div>
    {loading ? <div className="pokemon-set-grid" aria-label="Loading Pokémon sets">{Array.from({ length: 8 }, (_, index) => <i key={index}/>)}</div> : sets.length ? <div className="pokemon-set-grid">{sets.map(set => <Link key={set.code} href={`/pokemon?set=${encodeURIComponent(set.code)}`} className="pokemon-set-card"><span>{set.releaseDate ? new Intl.DateTimeFormat(language === 'ID' ? 'id-ID' : language === 'JP' ? 'ja-JP' : 'en', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${set.releaseDate}T00:00:00`)) : set.releaseYear || 'Pokémon TCG'}</span><strong>{set.name}</strong><small>{set.code} <i/> {set.mainSetTotal} cards</small><ArrowUpRightIcon size={17}/></Link>)}</div> : <section className="empty-state pokemon-empty"><h2>No sets are listed for this language yet.</h2></section>}
  </main>;
}
