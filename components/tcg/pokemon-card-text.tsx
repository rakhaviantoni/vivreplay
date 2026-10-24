'use client';

import { CaretDown, CaretUp, Circle, Drop, Eye, Flame, GearSix, HandFist, Leaf, Lightning, Moon, Star, Sun } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { versionedCardCatalogUrl } from '@/lib/card-catalog-cache';

type PokemonText = {
  code?: string;
  name?: string;
  language: string;
  source?: {
    description?: string;
    illustrator?: string;
    category?: string;
    regulationMark?: string;
    abilities?: Array<{ type?: string; name?: string; effect?: string }>;
    ability?: unknown;
    powers?: unknown;
    power?: unknown;
    pokePower?: unknown;
    pokePowers?: unknown;
    pokemonPower?: unknown;
    pokemonPowers?: unknown;
    pokeBody?: unknown;
    pokeBodies?: unknown;
    ancientTrait?: unknown;
    [key: string]: unknown;
    attacks?: Array<{ name?: string; cost?: string[]; damage?: string | number; effect?: string }>;
    weaknesses?: Array<{ type?: string; value?: string }>;
    resistances?: Array<{ type?: string; value?: string }>;
    retreat?: number;
    effect?: string;
    stage?: string;
    evolvesFrom?: string;
    evolveFrom?: string;
    hp?: number;
    types?: string[];
    trainerType?: string;
  };
};

type EvolutionNode = { code: string; name: string; spriteName: string; stage: string; dexIds?: string[]; children: EvolutionNode[] };

const energySymbols = {
  Colorless: { Icon: Circle, color: '#898b91', asset: 'colorless' },
  Grass: { Icon: Leaf, color: '#4d9b55', asset: 'grass' },
  Fire: { Icon: Flame, color: '#dc5a37', asset: 'fire' },
  Water: { Icon: Drop, color: '#3988c9', asset: 'water' },
  Lightning: { Icon: Lightning, color: '#c89c21', asset: 'lightning' },
  Psychic: { Icon: Eye, color: '#a45ba8', asset: 'psychic' },
  Fighting: { Icon: HandFist, color: '#a46d3e', asset: 'fighting' },
  Darkness: { Icon: Moon, color: '#565260', asset: 'darkness' },
  Metal: { Icon: GearSix, color: '#718c9c', asset: 'metal' },
  Dragon: { Icon: Sun, color: '#b87834', asset: 'dragon' },
  Fairy: { Icon: Star, color: '#ce77ae', asset: 'fairy' },
} as const;

type EnergyType = keyof typeof energySymbols;

function EnergyCost({ cost, language }: { cost?: string[]; language: string }) {
  if (!cost?.length) return null;
  return <span className="pokemon-energy-cost" aria-label={`${cost.length} ${language === 'ID' ? 'energi' : 'energy'}: ${cost.join(', ')}`}>
    {cost.map((type, index) => <EnergySymbol type={type} key={`${type}-${index}`}/>) }
  </span>;
}

export function EnergySymbol({ type }: { type: string }) {
  const normalizedType = energyTypeFromName(type);
  if (!normalizedType) return null;
  const energy = energySymbols[normalizedType];
  const { Icon } = energy;
  return <span className="pokemon-energy-symbol" role="img" title={type} aria-label={`${normalizedType} Energy`} style={{ '--energy-color': energy.color } as React.CSSProperties}>
    <Icon className="pokemon-energy-fallback" size={12} weight="fill" aria-hidden="true"/>
    <img src={`/assets/pokemon/energy/${energy.asset}.png`} alt="" loading="lazy" onLoad={event=>{event.currentTarget.parentElement?.classList.add('has-energy-image')}} onError={event=>{event.currentTarget.remove()}}/>
  </span>;
}

export function energyTypeFromName(value: string): EnergyType | undefined {
  const key = value.trim().toLocaleLowerCase().replace(/[\s_-]+/g, '').replace(/^(?:basic|basicenergy|energy|energid?asar|energi)/, '').replace(/^(?:基本)/, '').replace(/(?:energy|エネルギー)$/, '');
  const localized: Record<string, EnergyType> = {
    colorless: 'Colorless', normal: 'Colorless', 無色: 'Colorless', 無色エネルギー: 'Colorless',
    grass: 'Grass', daun: 'Grass', 草: 'Grass', 草エネルギー: 'Grass',
    fire: 'Fire', api: 'Fire', 炎: 'Fire', 炎エネルギー: 'Fire',
    water: 'Water', air: 'Water', 水: 'Water', 水エネルギー: 'Water',
    lightning: 'Lightning', electric: 'Lightning', listrik: 'Lightning', 雷: 'Lightning', 雷エネルギー: 'Lightning',
    psychic: 'Psychic', psikis: 'Psychic', 超: 'Psychic', 超エネルギー: 'Psychic',
    fighting: 'Fighting', petarung: 'Fighting', 闘: 'Fighting', 闘エネルギー: 'Fighting',
    darkness: 'Darkness', dark: 'Darkness', kegelapan: 'Darkness', 悪: 'Darkness', 悪エネルギー: 'Darkness',
    metal: 'Metal', steel: 'Metal', logam: 'Metal', 鋼: 'Metal', 鋼エネルギー: 'Metal',
    dragon: 'Dragon', naga: 'Dragon', 竜: 'Dragon', 竜エネルギー: 'Dragon',
    fairy: 'Fairy', peri: 'Fairy', フェアリー: 'Fairy', フェアリーエネルギー: 'Fairy',
  };
  return localized[key];
}

export function energyAssetFromName(value: string): string | undefined {
  const type = energyTypeFromName(value);
  return type ? energySymbols[type].asset : undefined;
}

function RuleCopy({ text }: { text?: string }) {
  if (!text?.trim()) return null;
  text = text.replace(/\\(?=<\/?(?:span|em|i|strong|b)\b)/gi, '').replace(/\s+/g, ' ').replace(/\bto\s+(\d+)\s+of\b/gi, 'to $1 of');
  const energyLetters: Record<string, EnergyType> = { C: 'Colorless', G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning', P: 'Psychic', F: 'Fighting', D: 'Darkness', M: 'Metal', Y: 'Fairy' };
  const parts = text.split(/(<span\b[^>]*class=["'][^"']*energy-symbol[^"']*["'][^>]*>[\s\S]*?<\/span\s*>|!?\[[^\]]*\]\(https?:\/\/[^)]+\)|<\/?(?:em|i|strong|b)\b[^>]*>|<br\s*\/?>|\*\*|__|\*|_|\[[^\]]+\]|\{[^}]+\})/gi);
  const rendered: ReactNode[] = [];
  let emphasis = 0;
  let bold = 0;
  parts.forEach((part, index) => {
    if (/^<(?:em|i)\b/i.test(part)) { emphasis++; return; }
    if (/^<\/(?:em|i)\s*>$/i.test(part)) { emphasis = Math.max(0, emphasis - 1); return; }
    if (/^<(?:strong|b)\b/i.test(part)) { bold++; return; }
    if (/^<\/(?:strong|b)\s*>$/i.test(part)) { bold = Math.max(0, bold - 1); return; }
    if (part === '**' || part === '__') { bold = bold ? bold - 1 : bold + 1; return; }
    if (part === '*' || part === '_') { emphasis = emphasis ? emphasis - 1 : emphasis + 1; return; }
    if (/^<br\s*\/?>$/i.test(part)) { rendered.push(<br key={index}/>); return; }
    const energySpan = /^<span\b[^>]*class=["']([^"']*energy-symbol[^"']*)["'][^>]*>([\s\S]*?)<\/span\s*>$/i.exec(part);
    if (energySpan) {
      const energyName = energySpan[1]?.split(/\s+/).find(name => energyTypeFromName(name));
      const symbol = energyName ? <EnergySymbol type={energyName}/> : energySpan[2];
      rendered.push(formatInline(symbol, emphasis, bold, index));
      return;
    }
    const markdownImage = /^!?\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/i.exec(part);
    if (markdownImage) {
      const fileName = markdownImage[2]?.split(/[/?#]/).filter(Boolean).at(-1)?.replace(/\.[a-z\d]+$/i, '') ?? '';
      const energyType = energyTypeFromName(fileName);
      const count = Math.min(10, Math.max(1, markdownImage[1]?.match(/image/gi)?.length ?? 1));
      const symbols = energyType ? Array.from({length:count}, (_,symbolIndex) => <EnergySymbol type={energyType} key={`${index}-${symbolIndex}`}/>) : markdownImage[1];
      rendered.push(formatInline(symbols, emphasis, bold, index));
      return;
    }
    const mark = /^\{(GX|EX|VSTAR|VMAX|V-UNION)\}$/i.exec(part)?.[1];
    if (mark) { rendered.push(formatInline(<span className={`pokemon-rule-mark pokemon-rule-mark-${mark.toLowerCase().replace(/[^a-z]+/g,'-')}`}>{mark.toUpperCase()}</span>, emphasis, bold, index)); return; }
    if (/^\[[^\]]+\]$/.test(part)) {
      const label = part.slice(1, -1);
      rendered.push(formatInline(label, Math.max(1, emphasis), bold, index));
      return;
    }
    const energyName = /^\{([^}]+)\}$/.exec(part)?.[1];
    const shortEnergy = /^\{([CGRWLPFDMY])\}$/i.exec(part)?.[1]?.toUpperCase();
    const energyType = (energyName && energyTypeFromName(energyName)) || (shortEnergy ? energyLetters[shortEnergy] : undefined);
    if (energyType) { rendered.push(formatInline(<EnergySymbol type={energyType}/>, emphasis, bold, index)); return; }
    const textParts = part.split(/(\b(?:Colorless|Normal|Grass|Fire|Water|Lightning|Electric|Psychic|Fighting|Darkness|Dark|Metal|Steel|Dragon|Fairy)\s+Energy\b)/gi);
    textParts.forEach((textPart, textIndex) => {
      const namedEnergy = /^(\w+)\s+Energy$/i.exec(textPart);
      if (namedEnergy) {
        const energyType = energyTypeFromName(namedEnergy[1] ?? '');
        if (energyType) {
          rendered.push(formatInline(<><EnergySymbol type={energyType}/> Energy</>, emphasis, bold, index * 1000 + textIndex));
          return;
        }
      }
      const inlineParts = textPart.split(/(\b(?:V-UNION|VSTAR|VMAX|GX|EX|V|ex)\b)/gi);
      inlineParts.forEach((inlinePart, inlineIndex) => {
        const mechanic = /^(?:V-UNION|VSTAR|VMAX|GX|EX|V|ex)$/i.test(inlinePart);
        const content = mechanic ? <span className={`pokemon-rule-mark pokemon-rule-mark-${inlinePart.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{inlinePart}</span> : inlinePart;
        rendered.push(formatInline(content, emphasis, bold, index * 1000 + textIndex * 100 + inlineIndex));
      });
    });
  });
  return <span className="pokemon-rule-copy">{rendered}</span>;
}

export function PokemonMechanicText({ text }: { text?: string }) {
  return <RuleCopy text={text}/>;
}

export function PokemonCardVitals({ source, language }: { source?: PokemonText['source']; language: string }) {
  if (!source || (source.hp === undefined && !source.types?.length)) return null;
  const lang = (language === 'ID' || language === 'JP' ? language : 'EN') as keyof typeof textByLanguage;
  return <div className="pokemon-dialog-title-vitals" role="group" aria-label={lang === 'ID' ? 'HP dan tipe Pokémon' : lang === 'JP' ? 'HPとタイプ' : 'Pokémon HP and type'}>
    {source.hp !== undefined && <span className="pokemon-fact-hp"><b>{textByLanguage[lang].hp}</b><strong>{source.hp}</strong></span>}
    {source.types?.length ? <EnergyCost cost={source.types} language={lang}/> : null}
  </div>;
}

function formatInline(content: ReactNode, emphasis: number, bold: number, key: number) {
  return <span key={key}>{bold > 0 ? <strong>{emphasis > 0 ? <em>{content}</em> : content}</strong> : emphasis > 0 ? <em>{content}</em> : content}</span>;
}

function isCardtellSetDescription(source: NonNullable<PokemonText['source']>) {
  const description = typeof source.description === 'string' ? source.description.trim() : '';
  return String(source.source ?? '').toLowerCase() === 'cardtell' && /^[^·•]{1,100}[·•]\s*[A-Z0-9_-]+(?:\/[A-Z0-9_-]+)?$/i.test(description);
}

export function trainerEffectText(source: NonNullable<PokemonText['source']>) {
  const isTrainer = [source.category, source.trainerType].some(value => typeof value === 'string' && /trainer|supporter|item|stadium/i.test(value));
  const candidates = [source.effect, source.trainerEffect, source.trainerText, source.cardEffect, source.effectText, source.text, source.rules, isTrainer && !isCardtellSetDescription(source) ? source.description : undefined];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const entry = Object.entries(value as Record<string, unknown>).find(([key, part]) => /^(?:effect|text|description|en|id|ja)$/i.test(key) && typeof part === 'string' && part.trim());
      if (entry && typeof entry[1] === 'string') return entry[1];
    }
    if (Array.isArray(value)) {
      const text = value.map(item => typeof item === 'string' ? item : item && typeof item === 'object' ? Object.values(item as Record<string, unknown>).find(part => typeof part === 'string' && part.trim()) : undefined).filter((part): part is string => typeof part === 'string' && Boolean(part.trim())).join('\n');
      if (text) return text;
    }
  }
  return undefined;
}

function cardDescription(source: NonNullable<PokemonText['source']>) {
  const description = typeof source.description === 'string' ? source.description.trim() : '';
  if (!description) return '';
  return isCardtellSetDescription(source) ? '' : description;
}

export type PokemonRuleAbility = { type?: string; name: string; effect?: string };
export function pokemonRuleAbilities(source: NonNullable<PokemonText['source']>): PokemonRuleAbility[] {
  const keys = ['abilities','ability','powers','power','pokePower','pokePowers','pokemonPower','pokemonPowers','pokeBody','pokeBodies','ancientTrait'];
  const entries: PokemonRuleAbility[] = [];
  for (const key of keys) {
    const fallbackType = key==='pokeBody'||key==='pokeBodies'?'Poké-Body':key==='ancientTrait'?'Ancient Trait':['power','powers','pokePower','pokePowers','pokemonPower','pokemonPowers'].includes(key)?'Poké-Power':undefined;
    const raw = source[key];
    const values = Array.isArray(raw) ? raw.map(value => [undefined, value] as const) : typeof raw==='string' ? [[undefined,raw] as const] : raw && typeof raw === 'object' ? Object.entries(raw as Record<string, unknown>).some(([, value]) => value && typeof value === 'object') && !('name' in raw) ? Object.entries(raw as Record<string, unknown>) : [[undefined, raw] as const] : [];
    for (const [fallbackName, value] of values) {
      if (typeof value === 'string') {
        const parts=value.split(/:\s*/,3);
        const typedRule=parts.length>1&&/^(?:pok[eé](?:-power|-body)?|ability|ancient trait)$/i.test(parts[0]??'');
        if(typedRule)entries.push({type:parts[0],name:parts[1]??'Power',effect:parts[2]});
        else if(fallbackName)entries.push({type:fallbackType,name:fallbackName,effect:value});
        else if(fallbackType&&/power|body|trait/i.test(key))entries.push({type:fallbackType,name:value});
        else entries.push({type:fallbackType,name:'',effect:value});
        continue;
      }
      if (!value || typeof value !== 'object') continue;
      const rule = value as Record<string, unknown>;
      const name = [rule.name,rule.title,rule.power].find(item => typeof item === 'string' && item.trim());
      const effect = [rule.effect,rule.text,rule.description].find(item => typeof item === 'string' && item.trim());
      const type = [rule.type,rule.kind,rule.category].find(item => typeof item === 'string' && item.trim());
      if (typeof name === 'string' || typeof effect === 'string') entries.push({type:typeof type==='string'?type:fallbackType,name:typeof name==='string'?name:fallbackName??(fallbackType??'Power'),effect:typeof effect==='string'?effect:undefined});
    }
  }
  return [...new Map(entries.filter(item=>item.name||item.effect).map(item=>[`${item.type??''}:${item.name}:${item.effect??''}`,item])).values()];
}

const textByLanguage = {
  ID: { description: 'Keterangan Pokémon', abilities: 'Ability', attacks: 'Serangan', details: 'Data kartu', hp: 'HP', stage: 'Tahap', evolves: 'Berevolusi dari', type: 'Tipe', weakness: 'Kelemahan', resistance: 'Resistansi', retreat: 'Mundur', trainer: 'Efek kartu' },
  EN: { description: 'Pokémon description', abilities: 'Abilities', attacks: 'Attacks', details: 'Card details', hp: 'HP', stage: 'Stage', evolves: 'Evolves from', type: 'Type', weakness: 'Weakness', resistance: 'Resistance', retreat: 'Retreat', trainer: 'Card effect' },
  JP: { description: 'ポケモンの説明', abilities: '特性', attacks: 'ワザ', details: 'カード情報', hp: 'HP', stage: '進化', evolves: '進化前', type: 'タイプ', weakness: '弱点', resistance: '抵抗力', retreat: 'にげる', trainer: 'カードの効果' },
} as const;

function formatStage(stage: string, language: keyof typeof textByLanguage) {
  const normalized = stage.trim().replace(/\s+/g, ' ');
  const match = /^(?:stage\s*)(\d+)$/i.exec(normalized);
  if (match) return language === 'ID' ? `Tahap ${match[1]}` : language === 'JP' ? `Stage ${match[1]}` : `Stage ${match[1]}`;
  if (/^basic$/i.test(normalized) && language === 'ID') return 'Dasar';
  if (/^basic$/i.test(normalized) && language === 'JP') return 'たね';
  return normalized;
}

export function PokemonCardText({ code, name, language, source, printingId, onEvolutionSelect }: PokemonText & { printingId?: string; onEvolutionSelect?: (code: string) => void }) {
  const [resolvedSource, setResolvedSource] = useState<{ key: string; source: PokemonText['source'] } | null>(null);
  const [textLoadingKey, setTextLoadingKey] = useState('');
  const [evolution, setEvolution] = useState<EvolutionNode | null>(null);
  const [evolutionLoadedKey, setEvolutionLoadedKey] = useState('');
  const [evolutionVariants, setEvolutionVariants] = useState<Record<string, number>>({});
  const evolutionTrackRef = useRef<HTMLDivElement>(null);
  const [evolutionEdges, setEvolutionEdges] = useState({ left: false, right: false });
  const sourceKey = `${printingId ?? code ?? ''}|${language}`;
  const hasSourceText = Boolean(source && (source.attacks?.length || pokemonRuleAbilities(source).length || trainerEffectText(source) || cardDescription(source)));
  const sourceForCard = hasSourceText ? source : resolvedSource?.key === sourceKey ? { ...source, ...resolvedSource.source } : source;
  const textLoading = Boolean(printingId && !hasSourceText && textLoadingKey !== sourceKey);
  useEffect(() => {
    if (!printingId || hasSourceText) { setTextLoadingKey(sourceKey); return; }
    const controller = new AbortController();
    setTextLoadingKey('');
    fetch(versionedCardCatalogUrl(`/api/cards/printing/${encodeURIComponent(printingId)}`), { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<{ sourcePayload?: PokemonText['source'] }> : null)
      .then(result => {
        if (controller.signal.aborted) return;
        const payload = result?.sourcePayload;
        if (payload && typeof payload === 'object') setResolvedSource({ key: sourceKey, source: payload });
        setTextLoadingKey(sourceKey);
      })
      .catch(error => { if (error.name !== 'AbortError') setTextLoadingKey(sourceKey); });
    return () => controller.abort();
  }, [printingId, sourceKey, hasSourceText]);
  const predecessor = sourceForCard?.evolvesFrom ?? sourceForCard?.evolveFrom;
  const evolutionRequestKey = `${code ?? ''}|${language}|${typeof predecessor === 'string' ? predecessor.trim() : ''}`;
  const evolutionLoading = Boolean(code) && evolutionLoadedKey !== evolutionRequestKey;
  useEffect(() => {
    if (!code) { setEvolution(null); setEvolutionLoadedKey(evolutionRequestKey); return; }
    const controller = new AbortController();
    const params = new URLSearchParams({ code, language });
    if (typeof predecessor === 'string' && predecessor.trim()) params.set('evolveFrom', predecessor.trim());
    fetch(versionedCardCatalogUrl(`/api/cards/catalog/evolution?${params}`), { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<{ evolution?: EvolutionNode | null }> : { evolution: null })
      .then(result => { setEvolution(result.evolution ?? null); setEvolutionLoadedKey(evolutionRequestKey); })
      .catch(error => { if (error.name !== 'AbortError') { setEvolution(null); setEvolutionLoadedKey(evolutionRequestKey); } });
    return () => controller.abort();
  }, [code, language, predecessor, evolutionRequestKey]);
  const updateEvolutionEdges = useCallback(() => {
    const track = evolutionTrackRef.current;
    if (!track) return;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const left = track.scrollLeft > 2;
    const right = maxScroll - track.scrollLeft > 2;
    setEvolutionEdges(current => current.left === left && current.right === right ? current : { left, right });
  }, []);
  useEffect(() => {
    const track = evolutionTrackRef.current;
    if (!track) return;
    const frame = requestAnimationFrame(updateEvolutionEdges);
    const observer = new ResizeObserver(updateEvolutionEdges);
    observer.observe(track);
    if (track.firstElementChild) observer.observe(track.firstElementChild);
    track.addEventListener('scroll', updateEvolutionEdges, { passive: true });
    window.addEventListener('resize', updateEvolutionEdges);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      track.removeEventListener('scroll', updateEvolutionEdges);
      window.removeEventListener('resize', updateEvolutionEdges);
    };
  }, [code, evolution, updateEvolutionEdges]);
  const lang = (language === 'ID' || language === 'JP' ? language : 'EN') as keyof typeof textByLanguage;
  const copy = textByLanguage[lang];
  const cardSource = sourceForCard ?? {};
  const abilities = pokemonRuleAbilities(cardSource);
  const trainerEffect = trainerEffectText(cardSource);
  const description = cardDescription(cardSource);
  const hasCardText = Boolean(cardSource.attacks?.length || abilities.length || trainerEffect);
  const evolutionLevels = (() => {
    const currentEvolution = evolutionLoadedKey === evolutionRequestKey ? evolution : null;
    if (!currentEvolution) return [] as EvolutionNode[][];
    const levels: EvolutionNode[][] = [[currentEvolution]];
    for (let depth = 0; depth < 3; depth++) {
      const next = levels[depth].flatMap(node => node.children ?? []);
      if (!next.length) break;
      levels.push([...new Map(next.map(node => [`${node.code}:${node.stage.toLocaleLowerCase()}`, node])).values()]);
    }
    return levels;
  })();
  const hasFacts = Boolean(evolutionLoading || cardSource.stage || cardSource.evolvesFrom || cardSource.evolveFrom || cardSource.weaknesses?.length || cardSource.resistances?.length || cardSource.retreat !== undefined);
  const currentName = name ?? '';
  const fallbackStage = /\s+VSTAR$/i.test(currentName) ? 'VSTAR' : /\s+VMAX$/i.test(currentName) ? 'VMAX' : cardSource.stage ?? '';
  const stageNodes = evolutionLoading ? [] : evolutionLevels.length ? (() => {
    const groups = new Map<string, EvolutionNode[]>();
    evolutionLevels.forEach((level, depth) => level.forEach(node => {
      const normalized = node.code === code && !node.stage ? { ...node, stage: cardSource.stage ?? '' } : node;
      const key = normalized.stage.trim().toLocaleLowerCase() || `stage-${depth}`;
      const current = groups.get(key) ?? [];
      if (!current.some(item => item.code === normalized.code)) current.push(normalized);
      groups.set(key, current);
    }));
    return [...groups.values()];
  })() : fallbackStage ? [[{ code: code ?? '', name: name ?? '', spriteName: name ?? '', stage: fallbackStage, children: [] }]] : [];
  const stageColumns = stageNodes.map(nodes => {
    const longestName = Math.max(8, ...nodes.map(node => (node.name?.trim() || node.spriteName?.trim() || '').length));
    const controlSpace = nodes.length > 1 ? 10 : 5;
    const weight = Math.min(32, longestName + controlSpace);
    return `minmax(max-content,${weight}fr)`;
  }).join(' ');
  const stageNames = (stage: string, depth: number) => {
    if (!stage && depth === 0) return lang === 'ID' ? 'Dasar' : lang === 'JP' ? 'たね' : 'Basic';
    return stage ? formatStage(stage, lang) : lang === 'ID' ? `Tahap ${depth}` : lang === 'JP' ? `Stage ${depth}` : `Stage ${depth}`;
  };
  const energyValues = (items?: Array<{ type?: string; value?: string }>) => items?.length ? <span className="pokemon-fact-energy-list">{items.map((item,index) => <span className="pokemon-fact-energy" key={`${item.type}-${index}`}><EnergySymbol type={item.type ?? ''}/>{item.value && <small>{item.value}</small>}</span>)}</span> : <span className="pokemon-fact-dash">—</span>;

  return <div className="pokemon-card-text">
    {textLoading ? <div className="pokemon-card-text-loading" role="status" aria-label={lang === 'ID' ? 'Memuat teks kartu' : lang === 'JP' ? 'カードテキストを読み込み中' : 'Loading card text'}><i/><i/><i/><i/></div> : <>
      {description && ![cardSource.category, cardSource.trainerType].some(value => typeof value === 'string' && /trainer|supporter|item|stadium/i.test(value)) && <section className="pokemon-card-description"><p>{description}</p></section>}
      {abilities.length ? <section className="pokemon-card-rules pokemon-ability-list">{abilities.map((ability, index) => <article className="pokemon-card-ability" key={`${ability.name || 'ability'}-${index}`}><p><small className="pokemon-ability-badge">{ability.type || (lang==='ID'?'Ability':lang==='JP'?'特性':'Ability')}</small><strong><PokemonMechanicText text={ability.name}/></strong></p><RuleCopy text={ability.effect}/></article>)}</section> : null}
      {cardSource.attacks?.length ? <section className="pokemon-card-rules" aria-label={copy.attacks}>{cardSource.attacks.map((attack, index) => <article className="pokemon-card-attack" key={`${attack.name ?? 'attack'}-${index}`}><header><EnergyCost cost={attack.cost} language={lang}/><strong><PokemonMechanicText text={attack.name}/></strong>{attack.damage !== undefined && attack.damage !== '' && <b>{attack.damage}</b>}</header><RuleCopy text={attack.effect}/></article>)}</section> : null}
      {trainerEffect && !cardSource.attacks?.length && !abilities.length ? <section className="pokemon-card-rules"><h3>{typeof cardSource.trainerType === 'string' && cardSource.trainerType.trim() ? cardSource.trainerType : copy.trainer}</h3><RuleCopy text={trainerEffect}/></section> : null}
      {!hasCardText && !description && <p className="pokemon-card-text-missing">{lang === 'ID' ? 'Teks kartu belum tersedia.' : lang === 'JP' ? 'カードテキストはありません。' : 'Card text is not available.'}</p>}
    </>}
    {hasFacts && <section className="pokemon-card-facts">
      {stageNodes.length > 0 && <section className={`pokemon-evolution${stageNodes.length === 1 ? ' is-single' : ''}${evolutionEdges.left ? ' has-left-overflow' : ''}${evolutionEdges.right ? ' has-right-overflow' : ''}`} aria-label={lang === 'ID' ? 'Evolusi' : lang === 'JP' ? '進化' : 'Evolution'}>
        <div ref={evolutionTrackRef} className="pokemon-evolution-track" style={{ '--pokemon-evolution-stage-count': stageNodes.length, '--pokemon-evolution-stage-columns': stageColumns } as CSSProperties}>{stageNodes.map((nodes, depth) => <div className="pokemon-evolution-group" key={`step-${depth}`}>
          {depth > 0 && <span className="pokemon-evolution-arrow" aria-hidden="true"/>}
          <div className="pokemon-evolution-step">
            <small>{stageNames(nodes[0]?.stage ?? '', depth)}</small>
            <div>{nodes.length > 1 ? (() => {
              const variantKey = `${depth}:${nodes.map(node => node.code).join(',')}`;
              const currentIndex = nodes.findIndex(node => node.code === code);
              const selectedIndex = Math.min(evolutionVariants[variantKey] ?? Math.max(currentIndex, 0), nodes.length - 1);
              const node = nodes[selectedIndex];
              const displayName = node.name?.trim() || node.spriteName?.trim() || cardSource.evolvesFrom || cardSource.evolveFrom || (lang === 'ID' ? 'Dasar' : 'Basic');
              const isCurrent = node.code === code;
              const dexId = node.dexIds?.find(value => /^\d+$/.test(value));
              const spriteUrl = dexId ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png` : undefined;
              const selectVariant = (nextIndex: number) => setEvolutionVariants(current => ({ ...current, [variantKey]: nextIndex }));
              return <div className="pokemon-evolution-variants" key={variantKey}>
                <button type="button" className={`pokemon-evolution-node${isCurrent ? ' is-current' : ''}`} aria-current={isCurrent ? 'step' : undefined} aria-label={`${stageNames(node.stage, depth)}: ${displayName}`} disabled={!node.code || isCurrent || !onEvolutionSelect} onClick={() => node.code && onEvolutionSelect?.(node.code)}>
                  <span className="pokemon-evolution-sprite" aria-hidden="true"><span>{displayName.slice(0,1)}</span>{spriteUrl&&<img src={spriteUrl} alt="" loading="lazy" onError={event=>{event.currentTarget.style.display='none';}}/>}</span>
                  <b>{displayName}</b>
                  <small className="pokemon-evolution-variant-count">{selectedIndex + 1}/{nodes.length}</small>
                </button>
                <span className="pokemon-evolution-variant-controls">
                  <button type="button" className="pokemon-evolution-variant-nav" aria-label={lang === 'ID' ? 'Form sebelumnya' : 'Previous form'} disabled={selectedIndex === 0} onClick={() => selectVariant(selectedIndex - 1)}><CaretUp size={13} weight="bold"/></button>
                  <button type="button" className="pokemon-evolution-variant-nav" aria-label={lang === 'ID' ? 'Form berikutnya' : 'Next form'} disabled={selectedIndex === nodes.length - 1} onClick={() => selectVariant(selectedIndex + 1)}><CaretDown size={13} weight="bold"/></button>
                </span>
              </div>;
            })() : nodes.slice(0, 8).map((node, index) => {
              const displayName = node.name?.trim() || node.spriteName?.trim() || cardSource.evolvesFrom || cardSource.evolveFrom || (lang === 'ID' ? 'Dasar' : 'Basic');
              const isCurrent = node.code === code;
              const dexId = node.dexIds?.find(value => /^\d+$/.test(value));
              const spriteUrl = dexId ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png` : undefined;
              return <button type="button" className={`pokemon-evolution-node${isCurrent ? ' is-current' : ''}`} key={`${node.code}-${index}`} aria-current={isCurrent ? 'step' : undefined} aria-label={`${stageNames(node.stage, depth)}: ${displayName}`} disabled={!node.code || isCurrent || !onEvolutionSelect} onClick={() => node.code && onEvolutionSelect?.(node.code)}>
                <span className="pokemon-evolution-sprite" aria-hidden="true"><span>{displayName.slice(0,1)}</span>{spriteUrl&&<img src={spriteUrl} alt="" loading="lazy" onError={event=>{event.currentTarget.style.display='none';}}/>}</span>
                <b>{displayName}</b>
              </button>;
            })}{nodes.length > 8 && <span className="pokemon-evolution-more">+{nodes.length - 8}</span>}</div>
          </div>
        </div>)}</div>
      </section>}
      {!stageNodes.length && evolutionLoading && <section className="pokemon-evolution pokemon-evolution-loading" role="status" aria-label={lang === 'ID' ? 'Memuat evolusi' : lang === 'JP' ? '進化を読み込み中' : 'Loading evolution'}>
        <div className="pokemon-evolution-track" aria-hidden="true"><div className="pokemon-evolution-skeleton-step"><i/><b/><i/></div><span className="pokemon-evolution-skeleton-arrow"/><div className="pokemon-evolution-skeleton-step"><i/><b/><i/></div></div>
      </section>}
      {(cardSource.weaknesses?.length || cardSource.resistances?.length || cardSource.retreat !== undefined) && <dl className="pokemon-fact-combat"><div><dt>{copy.weakness}</dt><dd>{energyValues(cardSource.weaknesses)}</dd></div><div><dt>{copy.resistance}</dt><dd>{energyValues(cardSource.resistances)}</dd></div><div><dt>{copy.retreat}</dt><dd>{cardSource.retreat !== undefined && cardSource.retreat > 0 ? <EnergyCost cost={Array.from({ length: Math.min(cardSource.retreat, 10) }, () => 'Colorless')} language={lang}/> : <span className="pokemon-fact-dash">—</span>}</dd></div></dl>}
    </section>}
  </div>;
}
