export type SiteLocale = 'EN' | 'ID';

export function localeFromPath(path: string): SiteLocale {
  return /^\/id(?:[/?#]|$)/.test(path) ? 'ID' : 'EN';
}

export function withoutLocale(path: string): string {
  return path.replace(/^\/id(?=[/?#]|$)/, '') || '/';
}

/** Localize page URLs only; API, artwork, downloads, and external URLs keep their original destination. */
export function localeHref(href: string, locale: SiteLocale): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const [, pathname, suffix] = href.match(/^([^?#]*)(.*)$/)!;
  const path = withoutLocale(pathname);
  if (/^\/(?:api|_next|admin|assets|brand|fonts)(?:[/?#]|$)/.test(path)
    || /^\/pokemon\/(?:art|images)(?:\/|$)/.test(path)
    || /^\/auth\/callback(?:[/?#]|$)/.test(path)
    || /\.(?:svg|png|jpe?g|gif|webp|avif|css|js|mjs|woff2?|ico|json|txt|xml|pdf|zip|mp[34]|webm)$/i.test(path)) return href;
  if (locale === 'EN') return `${path}${suffix}`;
  return `/id${path === '/' ? '' : path}${suffix}`;
}
