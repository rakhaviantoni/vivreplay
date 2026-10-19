'use client';

import { Circle, Drop, Eye, Flame, GearSix, HandFist, Leaf, Lightning, Moon, Star, Sun } from '@phosphor-icons/react';

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
    {cost.map((type, index) => {
      const energy = energySymbols[type as EnergyType];
      if (!energy) return <span className="pokemon-energy-unknown" key={`${type}-${index}`} title={type}>{type.slice(0, 1)}</span>;
      const { Icon } = energy;
      return <span className="pokemon-energy-symbol" key={`${type}-${index}`} title={type} style={{ '--energy-color': energy.color } as React.CSSProperties}><Icon size={12} weight="fill" aria-hidden="true"/></span>;
    })}
  </span>;
}

function RuleCopy({ text }: { text?: string }) {
  if (!text?.trim()) return null;
  return <span className="pokemon-rule-copy">{text.split(/(\[[^\]]+\])/g).map((part, index) => /^\[[^\]]+\]$/.test(part) ? <em key={index}>{part}</em> : <span key={index}>{part}</span>)}</span>;
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
  const facts = [
    source.hp !== undefined && [copy.hp, String(source.hp)],
    source.stage && [copy.stage, source.stage],
    source.evolveFrom && [copy.evolves, source.evolveFrom],
    source.types?.length && [copy.type, source.types.join(', ')],
    source.weaknesses?.length && [copy.weakness, source.weaknesses.map(item => `${item.type ?? ''}${item.value ? ` ${item.value}` : ''}`).join(', ')],
    source.resistances?.length && [copy.resistance, source.resistances.map(item => `${item.type ?? ''}${item.value ? ` ${item.value}` : ''}`).join(', ')],
    source.retreat !== undefined && [copy.retreat, String(source.retreat)],
  ].filter((item): item is [string, string] => Boolean(item));

  return <div className="pokemon-card-text">
    {source.description?.trim() && <section className="pokemon-card-description"><h3>{copy.description}</h3><p>{source.description}</p></section>}
    {source.abilities?.length ? <section className="pokemon-card-rules"><h3>{copy.abilities}</h3>{source.abilities.map((ability, index) => <article className="pokemon-card-ability" key={`${ability.name ?? 'ability'}-${index}`}><p>{ability.type && <small>{ability.type}</small>}<strong>{ability.name}</strong></p><RuleCopy text={ability.effect}/></article>)}</section> : null}
    {source.attacks?.length ? <section className="pokemon-card-rules"><h3>{copy.attacks}</h3>{source.attacks.map((attack, index) => <article className="pokemon-card-attack" key={`${attack.name ?? 'attack'}-${index}`}><header><EnergyCost cost={attack.cost} language={lang}/><strong>{attack.name}</strong>{attack.damage !== undefined && attack.damage !== '' && <b>{attack.damage}</b>}</header><RuleCopy text={attack.effect}/></article>)}</section> : null}
    {source.effect?.trim() && !source.attacks?.length && !source.abilities?.length ? <section className="pokemon-card-rules"><h3>{source.trainerType ?? copy.trainer}</h3><RuleCopy text={source.effect}/></section> : null}
    {facts.length > 0 && <section className="pokemon-card-facts"><h3>{copy.details}</h3><dl>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
    {!hasCardText && !source.description?.trim() && <p className="pokemon-card-text-missing">{lang === 'ID' ? 'Teks kartu belum tersedia.' : lang === 'JP' ? 'カードテキストはありません。' : 'Card text is not available.'}</p>}
  </div>;
}
