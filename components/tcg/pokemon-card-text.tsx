'use client';

import { Circle, Drop, Eye, Flame, GearSix, HandFist, Leaf, Lightning, Moon, Star, Sun } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

type PokemonText = {
  language: string;
  source?: {
    description?: string;
    illustrator?: string;
    abilities?: Array<{ type?: string; name?: string; effect?: string }>;
    attacks?: Array<{ name?: string; cost?: string[]; damage?: string | number; effect?: string }>;
    weaknesses?: Array<{ type?: string; value?: string }>;
    resistances?: Array<{ type?: string; value?: string }>;
    retreat?: number;
    effect?: string;
    stage?: string;
    evolveFrom?: string;
    hp?: number;
    types?: string[];
    trainerType?: string;
  };
};

const energySymbols = {
  Colorless: { Icon: Circle, color: '#898b91' },
  Grass: { Icon: Leaf, color: '#4d9b55' },
  Fire: { Icon: Flame, color: '#dc5a37' },
  Water: { Icon: Drop, color: '#3988c9' },
  Lightning: { Icon: Lightning, color: '#c89c21' },
  Psychic: { Icon: Eye, color: '#a45ba8' },
  Fighting: { Icon: HandFist, color: '#a46d3e' },
  Darkness: { Icon: Moon, color: '#565260' },
  Metal: { Icon: GearSix, color: '#718c9c' },
  Dragon: { Icon: Sun, color: '#b87834' },
  Fairy: { Icon: Star, color: '#ce77ae' },
} as const;

type EnergyType = keyof typeof energySymbols;

function EnergyCost({ cost, language }: { cost?: string[]; language: string }) {
  if (!cost?.length) return null;
  return <span className="pokemon-energy-cost" aria-label={`${cost.length} ${language === 'ID' ? 'energi' : 'energy'}: ${cost.join(', ')}`}>
    {cost.map((type, index) => <EnergySymbol type={type} key={`${type}-${index}`}/>) }
  </span>;
}

function EnergySymbol({ type }: { type: string }) {
  const normalizedType = energyTypeFromName(type);
  if (!normalizedType) return null;
  const energy = energySymbols[normalizedType];
  const { Icon } = energy;
  return <span className="pokemon-energy-symbol" role="img" title={type} aria-label={`${normalizedType} Energy`} style={{ '--energy-color': energy.color } as React.CSSProperties}>
    <Icon className="pokemon-energy-fallback" size={12} weight="fill" aria-hidden="true"/>
    <img src={`/pokemon/energy/${encodeURIComponent(normalizedType)}`} alt="" loading="lazy" onLoad={event=>{event.currentTarget.parentElement?.classList.add('has-provider-icon')}} onError={event=>{event.currentTarget.remove()}}/>
  </span>;
}

function energyTypeFromName(value: string): EnergyType | undefined {
  const key = value.trim().toLocaleLowerCase().replace(/[\s_-]+/g, '');
  const localized: Record<string, EnergyType> = {
    colorless: 'Colorless', normal: 'Colorless', 無色: 'Colorless',
    grass: 'Grass', daun: 'Grass', 草: 'Grass',
    fire: 'Fire', api: 'Fire', 炎: 'Fire',
    water: 'Water', air: 'Water', 水: 'Water',
    lightning: 'Lightning', electric: 'Lightning', listrik: 'Lightning', 雷: 'Lightning',
    psychic: 'Psychic', psikis: 'Psychic', 超: 'Psychic',
    fighting: 'Fighting', petarung: 'Fighting', 闘: 'Fighting',
    darkness: 'Darkness', dark: 'Darkness', kegelapan: 'Darkness', 悪: 'Darkness',
    metal: 'Metal', steel: 'Metal', logam: 'Metal', 鋼: 'Metal',
    dragon: 'Dragon', naga: 'Dragon', 竜: 'Dragon',
    fairy: 'Fairy', peri: 'Fairy', フェアリー: 'Fairy',
  };
  return localized[key];
}

function RuleCopy({ text, language }: { text?: string; language: string }) {
  if (!text?.trim()) return null;
  return <span className="pokemon-rule-copy">{text.split(/(\[[^\]]+\]|\{[^}]+\})/g).map((part, index) => {
    if (/^\[[^\]]+\]$/.test(part)) return <em key={index}>{part}</em>;
    const energyName = /^\{([^}]+)\}$/.exec(part)?.[1];
    if (energyName && energyTypeFromName(energyName)) return <EnergySymbol type={energyName} key={index}/>;
    return <span key={index}>{part}</span>;
  })}</span>;
}

const textByLanguage = {
  ID: { description: 'Keterangan Pokémon', abilities: 'Ability', attacks: 'Serangan', details: 'Data kartu', hp: 'HP', stage: 'Tahap', evolves: 'Berevolusi dari', type: 'Tipe', weakness: 'Kelemahan', resistance: 'Resistansi', retreat: 'Mundur', trainer: 'Efek kartu' },
  EN: { description: 'Pokémon description', abilities: 'Abilities', attacks: 'Attacks', details: 'Card details', hp: 'HP', stage: 'Stage', evolves: 'Evolves from', type: 'Type', weakness: 'Weakness', resistance: 'Resistance', retreat: 'Retreat', trainer: 'Card effect' },
  JP: { description: 'ポケモンの説明', abilities: '特性', attacks: 'ワザ', details: 'カード情報', hp: 'HP', stage: '進化', evolves: '進化前', type: 'タイプ', weakness: '弱点', resistance: '抵抗力', retreat: 'にげる', trainer: 'カードの効果' },
} as const;

export function PokemonCardText({ language, source }: PokemonText) {
  if (!source) return null;
  const lang = (language === 'ID' || language === 'JP' ? language : 'EN') as keyof typeof textByLanguage;
  const copy = textByLanguage[lang];
  const hasCardText = Boolean(source.attacks?.length || source.abilities?.length || source.effect?.trim());
  const facts: Array<{ label: string; value: ReactNode }> = [];
  if (source.hp !== undefined) facts.push({ label: copy.hp, value: String(source.hp) });
  if (source.stage) facts.push({ label: copy.stage, value: source.stage });
  if (source.evolveFrom) facts.push({ label: copy.evolves, value: source.evolveFrom });
  if (source.types?.length) facts.push({ label: copy.type, value: <EnergyCost cost={source.types} language={lang}/> });
  if (source.weaknesses?.length) facts.push({ label: copy.weakness, value: <span className="pokemon-fact-energy-list">{source.weaknesses.map((item,index) => <span className="pokemon-fact-energy" key={`${item.type}-${index}`}><EnergySymbol type={item.type ?? ''}/>{item.value && <small>{item.value}</small>}</span>)}</span> });
  if (source.resistances?.length) facts.push({ label: copy.resistance, value: <span className="pokemon-fact-energy-list">{source.resistances.map((item,index) => <span className="pokemon-fact-energy" key={`${item.type}-${index}`}><EnergySymbol type={item.type ?? ''}/>{item.value && <small>{item.value}</small>}</span>)}</span> });
  if (source.retreat !== undefined && source.retreat > 0) facts.push({ label: copy.retreat, value: <EnergyCost cost={Array.from({ length: Math.min(source.retreat, 10) }, () => 'Colorless')} language={lang}/> });

  return <div className="pokemon-card-text">
    {source.description?.trim() && <section className="pokemon-card-description"><h3>{copy.description}</h3><p>{source.description}</p></section>}
    {source.abilities?.length ? <section className="pokemon-card-rules"><h3>{copy.abilities}</h3>{source.abilities.map((ability, index) => <article className="pokemon-card-ability" key={`${ability.name ?? 'ability'}-${index}`}><p>{ability.type && <small>{ability.type}</small>}<strong>{ability.name}</strong></p><RuleCopy text={ability.effect} language={lang}/></article>)}</section> : null}
    {source.attacks?.length ? <section className="pokemon-card-rules"><h3>{copy.attacks}</h3>{source.attacks.map((attack, index) => <article className="pokemon-card-attack" key={`${attack.name ?? 'attack'}-${index}`}><header><EnergyCost cost={attack.cost} language={lang}/><strong>{attack.name}</strong>{attack.damage !== undefined && attack.damage !== '' && <b>{attack.damage}</b>}</header><RuleCopy text={attack.effect} language={lang}/></article>)}</section> : null}
    {source.effect?.trim() && !source.attacks?.length && !source.abilities?.length ? <section className="pokemon-card-rules"><h3>{source.trainerType ?? copy.trainer}</h3><RuleCopy text={source.effect} language={lang}/></section> : null}
    {facts.length > 0 && <section className="pokemon-card-facts"><h3>{copy.details}</h3><dl>{facts.map(({label, value}) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
    {!hasCardText && !source.description?.trim() && <p className="pokemon-card-text-missing">{lang === 'ID' ? 'Teks kartu belum tersedia.' : lang === 'JP' ? 'カードテキストはありません。' : 'Card text is not available.'}</p>}
  </div>;
}
