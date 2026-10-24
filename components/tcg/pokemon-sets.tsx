'use client';

import {useRouteLocale} from '@/components/locale-provider';
import {useEffect, useMemo, useState} from 'react';
import Link from '@/components/ui/localized-link';
import {useLocalizedRouter as useRouter} from '@/lib/use-localized-router';
import {ArrowUpRightIcon, MagnifyingGlassIcon, StackIcon} from '@phosphor-icons/react';
import {CardArt} from '@/components/tcg/card-art';
import {DepthCarousel} from '@/components/tcg/depth-carousel';
import type {Card} from '@/packages/card-data/catalog';

type FeaturedCardRecord={id:string;code:string;name:string;color:string;type:string;cost:number;power:number;rarity:string;effect:string;imageUrl:string;setCode:string;language:string;printingCode:string;localCardNumber:string;variant:string;gameSlug:'pokemon'};
type SetRecord={code:string;name:string;releaseYear:number;releaseDate?:string;mainSetTotal:number;parallelsTotal:number;productImageUrl?:string;featuredCards?:FeaturedCardRecord[]};

function displayCard(record:FeaturedCardRecord):Card&{gameSlug:'pokemon'}{
  return{id:record.id,code:record.code,name:record.name,color:record.color,type:'Character',cost:record.cost,power:record.power,rarity:record.rarity,art:0,effect:record.effect,imageUrl:record.imageUrl,setCode:record.setCode,language:record.language,printingCode:record.printingCode,localCardNumber:record.localCardNumber,variant:record.variant,gameSlug:'pokemon'};
}

export function PokemonSets(){
  const id=useRouteLocale()==='ID';
  const localize=(href:string)=>id?`/id${href}`:href;
  const router=useRouter();
  const [language,setLanguage]=useState<'ID'|'EN'|'JP'>('ID');
  const [sets,setSets]=useState<SetRecord[]>([]);
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);
    fetch(`/api/cards/sets?game=pokemon&language=${language}&includeCards=2`,{signal:controller.signal,cache:'no-store'})
      .then(async response=>{
        if(!response.ok)throw new Error('Sets unavailable');
        const result=await response.json() as {sets?:SetRecord[]};
        setSets(result.sets??[]);
      })
      .catch(error=>{if(error.name!=='AbortError')setSets([])})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[language]);

  const visibleSets=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase();
    return term?sets.filter(set=>`${set.name} ${set.code}`.toLocaleLowerCase().includes(term)):sets;
  },[sets,query]);

  return <main className="page sets-page pokemon-sets-page">
    <header className="directory-hero sets-hero page-intro-surface">
      <p className="eyebrow"><StackIcon size={15}/>{id?'Set Pokémon':'Pokémon sets'}</p>
      <h1>{id?'Set dan rilisan':'Sets and releases'}</h1>
      <p>{id?'Cari set berdasarkan nama atau kode, lalu jelajahi kartu unggulannya.':'Find a set by name or code, then browse its featured cards.'}</p>
      {!loading&&<b>{sets.length.toLocaleString(id?'id-ID':'en-US')} {id?'set tersedia':'sets available'}</b>}
    </header>
    <div className="pokemon-set-toolbar">
      <label className="pokemon-set-search"><MagnifyingGlassIcon size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={id?'Cari nama atau kode set':'Search set name or code'} /></label>
      <div className="language-switch" role="group" aria-label={id?'Bahasa kartu':'Card language'}>{(['ID','EN','JP'] as const).map(option=><button type="button" key={option} aria-pressed={language===option} onClick={()=>setLanguage(option)}>{option}</button>)}</div>
    </div>
    {loading?<div className="sets-skeleton" aria-label={id?'Memuat set Pokémon':'Loading Pokémon sets'}><i/><i/><i/></div>:visibleSets.length?<div className="set-release-grid">{visibleSets.map(set=>{
      const featured=(set.featuredCards??[]).map(displayCard);
      return <article className="set-release" key={set.code}>
        <header><div><span>{set.code}</span><h3>{set.name}</h3></div><small>{set.mainSetTotal.toLocaleString(id?'id-ID':'en-US')} {id?'kartu':set.mainSetTotal===1?'card':'cards'}</small></header>
        {featured.length?<DepthCarousel className="set-card-carousel" label={`${set.code} ${id?'kartu unggulan':'featured cards'}`} items={featured.map(card=>({id:card.id,label:`${id?'Buka':'Open'} ${card.name}`,onSelect:()=>router.push(localize(`/pokemon/cards?set=${encodeURIComponent(card.setCode??set.code)}&number=${encodeURIComponent(card.localCardNumber??card.printingCode??card.code)}&lang=${encodeURIComponent(card.language??language)}`)),content:<CardArt card={card}/> }))}/>:<div className="pokemon-set-cards-empty">{id?'Gambar kartu belum tersedia':'Card images are not available yet'}</div>}
        <Link href={localize(`/pokemon/cards?set=${encodeURIComponent(set.code)}`)} className="set-all-link">{id?`Lihat semua kartu ${set.code}`:`View all ${set.code} cards`}<ArrowUpRightIcon size={15}/></Link>
      </article>;
    })}</div>:<section className="sets-empty"><h2>{query?(id?'Tidak ada set yang cocok':'No sets match your search'):(id?'Belum ada set untuk bahasa ini':'No sets are listed for this language yet')}</h2>{query&&<button type="button" onClick={()=>setQuery('')}>{id?'Hapus pencarian':'Clear search'}</button>}</section>}
  </main>;
}
