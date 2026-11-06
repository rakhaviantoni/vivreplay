'use client';

import {useRouteLocale} from '@/components/locale-provider';
import {useEffect, useState, type ReactNode} from 'react';
import {BlockValue} from './block-value';
import {SetInformation} from './set-information';
import {colors} from '@/packages/card-data/catalog';
import {displayCardName} from './card-name';
import Link from '@/components/ui/localized-link';
import {PokemonCardText,PokemonCardVitals,PokemonMechanicText} from './pokemon-card-text';

export function cardIdentityBackground(color?: string | null): string {
  if (!color) return '#657180';
  const cardColours = color.split(/\s*(?:\/|&|,|·)\s*|\s+/).map(c => c.trim()).filter(c => Boolean(colors[c]));
  const identityColours = cardColours.map(c => colors[c]);
  if (identityColours.length > 1) {
    return `linear-gradient(135deg,${identityColours.map((c, i) => `${c} ${(i / identityColours.length) * 100}% ${((i + 1) / identityColours.length) * 100}%`).join(',')})`;
  }
  return identityColours[0] ?? '#657180';
}

type CardDetailContentProps={
  code:string;
  color?:string|null;
  title:string;
  titleId?:string;
  heading:'h1'|'h2';
  type:string;
  rarity?:string|null;
  attribute?:string|null;
  cost:number;
  power:number|null;
  life?:number|null;
  block:string;
  setCode?:string|null;
  setName?:string|null;
  subTypes?:string[]|string|null;
  effect?:ReactNode;
  hasEffect?:boolean;
  afterEffect?:ReactNode;
  pokemonSource?:Parameters<typeof PokemonCardText>[0]['source'];
  language?:string;
};

export function CardDetailContent({code,color,title,titleId,heading,type,rarity,attribute,cost,power,life,block,setCode,setName,subTypes,effect,hasEffect=true,afterEffect,pokemonSource,language='EN'}:CardDetailContentProps) {
  const [locale,setLocale]=useState<'EN'|'ID'>(useRouteLocale());
  useEffect(()=>{
    const syncLocale=()=>setLocale(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail);
    syncLocale();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);
  const id=locale==='ID';
  const Heading=heading;
  const identityBackground = cardIdentityBackground(color);
  const displayType = id && type === 'Character' ? 'Karakter' : type;
  let archetypes:string[]=[];
  if(Array.isArray(subTypes))archetypes=subTypes.map(value=>String(value).trim()).filter(Boolean);
  else if(typeof subTypes==='string'&&subTypes.trim()){
    try{const parsed=JSON.parse(subTypes) as unknown;if(Array.isArray(parsed))archetypes=parsed.map(value=>String(value).trim()).filter(Boolean);else archetypes=subTypes.split(/\s*\/\s*|\s*[,|]\s*/).map(value=>value.trim()).filter(Boolean)}catch{archetypes=subTypes.split(/\s*\/\s*|\s*[,|]\s*/).map(value=>value.trim()).filter(Boolean)}
  }
  const cardTitle=displayCardName(title,code);
  if(pokemonSource){
    return <>
      <p className="eyebrow"><i className="filter-colour identity-colour" title={color||undefined} aria-label={color?`${color} color`:undefined} style={{background:identityBackground}}/><span>{setCode||code}</span></p>
      <div className="pokemon-preview-title"><Heading id={titleId} className="card-detail-title"><PokemonMechanicText text={cardTitle}/></Heading><PokemonCardVitals source={pokemonSource} language={language}/></div>
      <div className="pokemon-preview-meta">{setName&&<span>{setName}</span>}{setCode&&<strong>{setCode}</strong>}{pokemonSource.localId&&<span>{String(pokemonSource.localId)}</span>}{rarity&&<span>{rarity}</span>}{typeof pokemonSource.regulationMark==='string'&&<span>{pokemonSource.regulationMark}</span>}{pokemonSource.illustrator&&<span className="pokemon-preview-illustrator">Illus. <b>{String(pokemonSource.illustrator)}</b></span>}</div>
      <PokemonCardText code={code} name={title} language={language} source={pokemonSource}/>
    </>;
  }
  return <>
    <p className="eyebrow">
      <i className="filter-colour identity-colour" title={color || undefined} aria-label={color ? `${color} color` : undefined} style={{ background: identityBackground }} />
      <span>{code}</span>
    </p>
    <Heading id={titleId} className="card-detail-title">{cardTitle}</Heading>
    <p className="viewer-kind"><span className="viewer-kind-type">{displayType}</span>{rarity&&<span className="viewer-kind-rarity">{rarity}</span>}{attribute&&<span className="viewer-kind-attribute">{id?'Atribut':'Attribute'}: {attribute}</span>}</p>
    {archetypes.length>0&&<p className="viewer-archetypes"><span>{id?'Arketipe':'Archetype'}</span>{archetypes.map(archetype=><Link key={archetype} href={`/cards?archetype=${encodeURIComponent(archetype)}`}>{archetype}</Link>)}</p>}
    <dl className="viewer-stats">
      {type!=='Leader'&&<div className="viewer-stat-cost"><dt>{id?'Biaya':'Cost'}</dt><dd>{cost}</dd></div>}
      {(type==='Character'||type==='Leader')&&<div><dt>{id?'Kekuatan':'Power'}</dt><dd>{power??0}</dd></div>}
      {life!==null&&life!==undefined&&<div><dt>{id?'Nyawa':'Life'}</dt><dd>{life}</dd></div>}
      <div><dt>{id?'Blok':'Block'}</dt><dd><BlockValue value={block}/></dd></div>
      <SetInformation compact setCode={setCode} fallbackName={setName}/>
    </dl>
    {hasEffect&&<section className="card-detail-effect viewer-effect"><h3>{id?'Efek':'Effect'}</h3>{effect}</section>}
    {afterEffect}
  </>;
}
