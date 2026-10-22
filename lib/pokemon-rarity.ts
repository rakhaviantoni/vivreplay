export function pokemonRarityLabel(value?: string | null, language?: string | null) {
  const rarity = value?.trim();
  if (!rarity || ['unknown', 'none', 'null'].includes(rarity.toLowerCase())) return '';

  const normalized = rarity.toLowerCase().replace(/[^a-z]/g, '');
  const japanese = ['JP', 'ID'].includes(language?.toUpperCase() ?? '');
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

export function pokemonPrintingRarity(
  value?: string | null,
  language?: string | null,
  setCode?: string | null,
  printingCode?: string | null,
) {
  const normalizedSet = setCode?.trim().toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  const rawCode = printingCode?.trim().toLowerCase() ?? '';
  const cardNumber = rawCode.match(/(?:^|[-_])([0-9]+)(?:\/[0-9]+)?$/)?.[1]
    ?? rawCode.match(/^([0-9]+)(?:\/[0-9]+)?$/)?.[1]
    ?? '';
  const knownPrintings: Record<string, string> = {
    'sv8a:217': 'SAR',
    'sv4a:347': 'SAR',
    'sv4a:327': 'SSR',
    'sv2a:331': 'SSR',
    'sv4a:349': 'SAR',
    'sv3s:098': 'RR',
    'sv3s:203': 'SR',
    'sv3s:220': 'SAR',
    'sv5s:088': 'RR',
    'sv5s:175': 'SR',
    'sv3s:101': 'U',
    'sv3s:105': 'U',
  };
  const printingRarity = knownPrintings[`${normalizedSet}:${cardNumber}`];
  return printingRarity ? pokemonRarityLabel(printingRarity, language) : pokemonRarityLabel(value, language);
}
