export function pokemonArtRoute(language: string, setCode: string, printingCode: string) {
  const normalizedLanguage = language.toUpperCase();
  const routeLanguage = normalizedLanguage === 'JP' || normalizedLanguage === 'JA'
    ? 'jp'
    : normalizedLanguage === 'ID' ? 'id' : 'en';
  if (!/^[\p{L}\p{N}._-]{1,32}$/u.test(setCode) || !/^[\p{L}\p{N}._-]{1,32}$/u.test(printingCode)) return '';
  return `/pokemon/art/${routeLanguage}/${encodeURIComponent(setCode)}/${encodeURIComponent(printingCode)}`;
}
