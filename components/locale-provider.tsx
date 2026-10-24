'use client';

import {createContext, useContext, useLayoutEffect, useState, type ReactNode} from 'react';
import {usePathname, useRouter} from 'next/navigation';
import {localeFromPath, localeHref, type SiteLocale} from '@/lib/locale-path';

const LocaleContext = createContext<SiteLocale>('EN');

export function LocaleProvider({initialLocale, children}: {initialLocale: SiteLocale; children: ReactNode}) {
  const pathname = usePathname();
  const [locale, setLocale] = useState(initialLocale);
  const router = useRouter();

  useLayoutEffect(() => {
    // Rewrites can expose the unprefixed pathname during server rendering.
    const sync = () => {
      const currentLocale = localeFromPath(window.location.pathname);
      setLocale(currentLocale);
      document.documentElement.lang = currentLocale.toLowerCase();
      try { window.localStorage.setItem('vivreplay-locale', currentLocale); } catch {}
      document.cookie = `vivreplay-locale=${currentLocale}; path=/; max-age=31536000; SameSite=Lax`;
      window.dispatchEvent(new CustomEvent('vivreplay:locale', {detail: currentLocale}));
    };
    sync();
    const onLocale = (event: Event) => {
      const next = (event as CustomEvent<SiteLocale>).detail;
      if (next !== 'ID' && next !== 'EN') return;
      setLocale(next);
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const target = localeHref(current, next);
      if (target !== current) router.push(target);
    };
    window.addEventListener('vivreplay:locale', onLocale);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('vivreplay:locale', onLocale);
      window.removeEventListener('popstate', sync);
    };
  }, [pathname, initialLocale, router]);

  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useRouteLocale() {
  return useContext(LocaleContext);
}

export function LocaleScope({locale, children}: {locale: SiteLocale; children: ReactNode}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
