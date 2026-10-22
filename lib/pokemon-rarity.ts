export function pokemonRarityLabel(value?: string | null, language?: string | null) {
  const rarity = value?.trim();
  if (!rarity || ['unknown', 'none', 'null'].includes(rarity.toLowerCase())) return '';

  const normalized = rarity.toLowerCase().replace(/[^a-z]/g, '');
  const japanese = language?.toUpperCase() === 'JP';
  const labels: Record<string, string> = {
    cc: 'CC', classiccollection: 'CC',
    c: 'C', common: 'C',
    u: 'U', uncommon: 'U',
    r: 'R', rare: 'R', rareholo: 'R',
    rr: 'RR', doublerare: 'RR', rareholov: 'RR', rareholoex: 'RR',
    rrr: 'RRR', triplerare: 'RRR',
    ur: 'UR', ultrarare: 'UR',
    hr: 'HR', hyperrare: 'HR',
    ir: japanese ? 'AR' : 'IR', illustrationrare: japanese ? 'AR' : 'IR',
    onestar: japanese ? 'AR' : 'IR',
    ar: 'AR', artrare: 'AR',
    sir: japanese ? 'SAR' : 'SIR', specialillustrationrare: japanese ? 'SAR' : 'SIR',
    twostar: japanese ? 'SAR' : 'SIR', doublestar: japanese ? 'SAR' : 'SIR',
    sar: 'SAR', specialartrare: 'SAR',
    ace: 'ACE', acespec: 'ACE', acespecrare: 'ACE',
    a: 'A', amazing: 'A', amazingrare: 'A',
    k: 'K', radiantrare: 'K',
    s: 'S', shinyrare: 'S',
    ssr: 'SSR', shinyultrarare: 'SSR',
    rareholovmax: 'VMAX', vmax: 'VMAX',
    rareholovstar: 'VSTAR', vstar: 'VSTAR',
    rarehololvx: 'LV.X', rareprime: 'PRIME', rarebreak: 'BREAK',
    rareprismstar: 'Prism Star', rareholostar: 'Star',
    secretrare: 'SR', raresecret: 'SR',
    ex: 'EX',
    gx: 'GX', rarehologx: 'GX',
    v: 'V',
    promo: 'Promo', promotional: 'Promo',
  };
  return labels[normalized] ?? rarity;
}
