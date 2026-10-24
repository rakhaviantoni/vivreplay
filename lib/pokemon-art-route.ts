export function pokemonArtRoute(language: string, setCode: string, printingCode: string, printingId?: string) {
  const normalizedLanguage = language.toUpperCase();
  const routeLanguage = normalizedLanguage === 'JP' || normalizedLanguage === 'JA'
    ? 'jp'
    : normalizedLanguage === 'ID' ? 'id' : 'en';
  const isPrintingId=Boolean(printingId&&/^[a-z0-9-]{36}$/i.test(printingId));
  if(/^CT-\d+$/i.test(printingCode)&&!isPrintingId)return '';
  const cardNumber=/^CT-\d+$/i.test(printingCode)&&isPrintingId?`p-${printingId!.slice(0,8)}`:printingCode.replace(/^(\d+)\/\d+$/,'$1').replace(/^([a-z0-9]+)\/([a-z0-9]+)$/i,'$1-$2').trim();
  if (!/^[\p{L}\p{N}._-]{1,32}$/u.test(setCode) || !/^[\p{L}\p{N}._-]{1,32}$/u.test(cardNumber)) return '';
  const path = `/${encodeURIComponent(setCode)}/${routeLanguage}/${encodeURIComponent(cardNumber)}.webp`;
  return isPrintingId
    ? `${path}?printingId=${encodeURIComponent(printingId!)}`
    : path;
}
