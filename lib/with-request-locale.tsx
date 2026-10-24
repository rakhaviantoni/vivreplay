import type {ComponentType} from 'react';
import {LocaleScope} from '@/components/locale-provider';
import {isIndonesianRequest} from './locale';

/** Each streamed page needs its own locale boundary for its initial render. */
export function withRequestLocale<Props extends object>(Page: ComponentType<Props>) {
  return async function LocalizedPage(props: Props) {
    const locale = (await isIndonesianRequest()) ? 'ID' : 'EN';
    return <LocaleScope locale={locale}><Page {...props}/></LocaleScope>;
  };
}
