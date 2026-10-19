export function pokemonExpansionArt(name: string, code: string) {
  const value = `${name} ${code}`.toLocaleLowerCase();
  if (/30th celebration|\bma6\b/.test(value)) return '/assets/pokemon/expansions/ma-30th-celebration.webp';
  if (/hantaman pertama/.test(value)) return '/assets/pokemon/expansions/sm-hantaman-pertama.webp';
  if (/storm emeralda/.test(value)) return '/assets/pokemon/expansions/jp-storm-emeralda.webp';
  return undefined;
}
