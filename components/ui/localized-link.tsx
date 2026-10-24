'use client';

import NextLink from 'next/link';
import {forwardRef, type ComponentProps} from 'react';
import {useRouteLocale} from '@/components/locale-provider';
import {localeHref} from '@/lib/locale-path';

const LocalizedLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(function LocalizedLink({href, ...props}, ref) {
  const locale = useRouteLocale();
  const localized = typeof href === 'string'
    ? localeHref(href, locale)
    : href.pathname && !href.host && !href.hostname && !href.protocol
      ? {...href, pathname: localeHref(href.pathname, locale)}
      : href;
  return <NextLink ref={ref} href={localized} {...props}/>;
});

export default LocalizedLink;
