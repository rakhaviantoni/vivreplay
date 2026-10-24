'use client';

import { useEffect, useState } from 'react';
import { VivreMark } from './brand-assets';

type BrandLaunchPreloaderProps = {
  language: 'en' | 'id';
  market: boolean;
};

export function BrandLaunchPreloader({ language, market }: BrandLaunchPreloaderProps) {
  const [active, setActive] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (!standalone) {
      return;
    }

    const root = document.documentElement;
    root.classList.add('is-pwa-launching');
    const startedAt = performance.now();
    let finished = false;
    let fadeTimer = 0;
    let removeTimer = 0;

    const dismiss = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
      const remaining = Math.max(0, 650 - (performance.now() - startedAt));
      fadeTimer = window.setTimeout(() => {
        setLeaving(true);
        removeTimer = window.setTimeout(() => {
          root.classList.remove('is-pwa-launching');
          setActive(false);
        }, 260);
      }, remaining);
    };

    const onLoad = () => dismiss();
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
    const safetyTimer = window.setTimeout(dismiss, 1800);

    return () => {
      window.removeEventListener('load', onLoad);
      window.clearTimeout(safetyTimer);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
      root.classList.remove('is-pwa-launching');
    };
  }, []);

  if (!active) return null;

  const label = market
    ? language === 'id' ? 'Memuat Market' : 'Loading Market'
    : language === 'id' ? 'Memuat halaman' : 'Loading page';
  return (
    <div
      className={`brand-launch-preloader${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-label={label}
    >
      <div className="route-loading-brand brand-launch-content">
        <VivreMark size={34} />
        <span>{label}</span>
        <i aria-hidden="true" />
      </div>
    </div>
  );
}
