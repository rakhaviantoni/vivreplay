'use client';

import {useMemo} from 'react';
import {useRouter} from 'next/navigation';
import {useRouteLocale} from '@/components/locale-provider';
import {localeHref} from '@/lib/locale-path';

export function useLocalizedRouter() {
  const router = useRouter();
  const locale = useRouteLocale();
  return useMemo(() => ({
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(localeHref(href, locale), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(localeHref(href, locale), options),
    prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(localeHref(href, locale), options),
  }), [router, locale]);
}
