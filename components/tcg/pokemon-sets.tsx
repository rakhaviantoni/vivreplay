'use client';

import {useRouteLocale} from '@/components/locale-provider';
import {useEffect, useMemo, useState} from 'react';
import Link from '@/components/ui/localized-link';
import {useLocalizedRouter as useRouter} from '@/lib/use-localized-router';
import {ArrowUpRightIcon, MagnifyingGlassIcon, StackIcon} from '@phosphor-icons/react';
import {CardArt} from '@/components/tcg/card-art';
import {DepthCarousel} from '@/components/tcg/depth-carousel';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import type {Card} from '@/packages/card-data/catalog';

type FeaturedCardRecord={id:string;code:string;name:string;color:string;type:string;cost:number;power:number;rarity:string;effect:string;imageUrl:string;setCode:string;language:string;printingCode:string;localCardNumber:string;variant:string;gameSlug:'pokemon'};
type SetRecord={code:string;name:string;releaseYear:number;releaseDate?:string;mainSetTotal:number;parallelsTotal:number;productImageUrl?:string;series?:string;featuredCards?:FeaturedCardRecord[]};

function displayCard(record:FeaturedCardRecord):Card&{gameSlug:'pokemon'}{
  return{id:record.id,code:record.code,name:record.name,color:record.color,type:'Character',cost:record.cost,power:record.power,rarity:record.rarity,art:0,effect:record.effect,imageUrl:record.imageUrl,setCode:record.setCode,language:record.language,printingCode:record.printingCode,localCardNumber:record.localCardNumber,variant:record.variant,gameSlug:'pokemon'};
}

export function PokemonSets(){
  const id=useRouteLocale()==='ID';
  const localize=(href:string)=>id?`/id${href}`:href;
  const router=useRouter();
  const [language,setLanguage]=useState<'ID'|'EN'|'JP'>(id?'ID':'EN');
  const [sets,setSets]=useState<SetRecord[]>([]);
  const [query,setQuery]=useState('');
  const [year,setYear]=useState('all');
  const [series,setSeries]=useState('all');
  const [sort,setSort]=useState<'newest'|'oldest'|'name'>('newest');
  const [loading,setLoading]=useState(true);

  useEffect(()=>setLanguage(id?'ID':'EN'),[id]);

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);
    fetch(`/api/cards/sets?game=pokemon&language=${language}&includeCards=5`,{signal:controller.signal,cache:'no-store'})
      .then(async response=>{
        if(!response.ok)throw new Error('Sets unavailable');
        const result=await response.json() as {sets?:SetRecord[]};
        setSets(result.sets??[]);
      })
      .catch(error=>{if(error.name!=='AbortError')setSets([])})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[language]);

  const years=useMemo(()=>[...new Set(sets.map(set=>set.releaseYear).filter(value=>value>0))].sort((a,b)=>b-a),[sets]);
  const seriesOptions=useMemo(()=>[...new Set(sets.map(set=>set.series?.trim()).filter((value):value is string=>Boolean(value)))].sort((a,b)=>a.localeCompare(b)),[sets]);
  const visibleSets=useMemo(()=>{
    const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    const terms=normalize(query).split(/\s+/).filter(Boolean);
    return sets.filter(set=>{
      const searchable=normalize(`${set.name} ${set.code} ${set.series??''}`);
      const matchesTerm=terms.every(term=>searchable.includes(term));
      return matchesTerm&&(year==='all'||String(set.releaseYear)===year)&&(series==='all'||set.series===series);
    }).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='oldest'?(a.releaseDate??'').localeCompare(b.releaseDate??''):(b.releaseDate??'').localeCompare(a.releaseDate??''));
  },[sets,query,year,series,sort]);
  const hasFilters=Boolean(query||year!=='all'||series!=='all');
  const clearFilters=()=>{setQuery('');setYear('all');setSeries('all')};

  return <main className="page sets-page pokemon-sets-page">
    <header className="directory-hero sets-hero page-intro-surface">
      <p className="eyebrow"><StackIcon size={15}/>{id?'Set Pokémon':'Pokémon sets'}</p>
      <h1>{id?'Set dan rilisan':'Sets and releases'}</h1>
      <p>{id?'Cari set berdasarkan nama atau kode, lalu jelajahi kartu unggulannya.':'Find a set by name or code, then browse its featured cards.'}</p>
      {!loading&&<b>{sets.length.toLocaleString(id?'id-ID':'en-US')} {id?'set tersedia':'sets available'}</b>}
    </header>
    <div className="pokemon-set-toolbar">
      <label className="pokemon-set-search"><MagnifyingGlassIcon size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={id?'Cari nama atau kode set':'Search set name or code'} /></label>
      <div className="pokemon-set-filters">
        <Select value={year} onValueChange={setYear}><SelectTrigger aria-label={id?'Tahun rilis':'Release year'}><SelectValue placeholder={id?'Tahun':'Year'}/></SelectTrigger><SelectContent><SelectItem value="all">{id?'Semua tahun':'All years'}</SelectItem>{years.map(value=><SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select>
        {seriesOptions.length>0&&<Select value={series} onValueChange={setSeries}><SelectTrigger aria-label={id?'Seri Pokémon':'Pokémon series'}><SelectValue placeholder={id?'Semua seri':'All series'}/></SelectTrigger><SelectContent><SelectItem value="all">{id?'Semua seri':'All series'}</SelectItem>{seriesOptions.map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>}
        <Select value={sort} onValueChange={value=>setSort(value as typeof sort)}><SelectTrigger aria-label={id?'Urutkan set':'Sort sets'}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="newest">{id?'Terbaru':'Newest'}</SelectItem><SelectItem value="oldest">{id?'Terlama':'Oldest'}</SelectItem><SelectItem value="name">{id?'Nama A–Z':'Name A–Z'}</SelectItem></SelectContent></Select>
      </div>
      <div className="language-switch" role="group" aria-label={id?'Bahasa kartu':'Card language'}>{(['ID','EN','JP'] as const).map(option=><button type="button" key={option} aria-pressed={language===option} onClick={()=>setLanguage(option)}>{option}</button>)}</div>
    </div>
    {!loading&&<div className="pokemon-set-results"><span>{visibleSets.length.toLocaleString(id?'id-ID':'en-US')} {id?'set':'sets'}</span>{hasFilters&&<button type="button" onClick={clearFilters}>{id?'Hapus filter':'Clear filters'}</button>}</div>}
    {loading?<div className="sets-skeleton" aria-label={id?'Memuat set Pokémon':'Loading Pokémon sets'}><i/><i/><i/></div>:visibleSets.length?<div className="set-release-grid">{visibleSets.map(set=>{
      const featured=(set.featuredCards??[]).map(displayCard);
      return <article className="set-release" key={set.code}>
        <header><div><span>{set.code}</span><h3>{set.name}</h3></div><small>{set.mainSetTotal.toLocaleString(id?'id-ID':'en-US')} {id?'kartu':set.mainSetTotal===1?'card':'cards'}</small></header>
        {featured.length?<DepthCarousel className="set-card-carousel" label={`${set.code} ${id?'kartu unggulan':'featured cards'}`} items={featured.map(card=>({id:card.id,label:`${id?'Buka':'Open'} ${card.name}`,onSelect:()=>router.push(localize(`/pokemon/cards?set=${encodeURIComponent(card.setCode??set.code)}&number=${encodeURIComponent(card.localCardNumber??card.printingCode??card.code)}&lang=${encodeURIComponent(card.language??language)}`)),content:<CardArt card={card}/> }))}/>:<div className="pokemon-set-cards-empty">{id?'Gambar kartu belum tersedia':'Card images are not available yet'}</div>}
        <Link href={localize(`/pokemon/cards?set=${encodeURIComponent(set.code)}`)} className="set-all-link">{id?`Lihat semua kartu ${set.code}`:`View all ${set.code} cards`}<ArrowUpRightIcon size={15}/></Link>
      </article>;
    })}</div>:<section className="sets-empty"><h2>{hasFilters?(id?'Tidak ada set yang cocok':'No sets match these filters'):(id?'Belum ada set untuk bahasa ini':'No sets are listed for this language yet')}</h2>{hasFilters&&<button type="button" onClick={clearFilters}>{id?'Hapus filter':'Clear filters'}</button>}</section>}
  </main>;
}
