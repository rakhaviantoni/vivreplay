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

  const label = language === 'id' ? 'Membuka VivrePlay' : 'Opening VivrePlay';
  return (
    <div
      className={`brand-launch-preloader${market ? ' is-market' : ''}${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-label={market ? `${label} Market` : label}
    >
      <div className="brand-launch-lockup">
        <span className="brand-launch-mark">
          <span className="brand-launch-orbit" aria-hidden="true" />
          <VivreMark size={42} />
        </span>
        <span className="brand-launch-name">VivrePlay</span>
        {market && <span className="brand-launch-market">Market</span>}
      </div>
      <span className="brand-launch-caption">{market ? `${label} Market` : label}</span>
      <span className="brand-launch-progress" aria-hidden="true"><i /></span>
    </div>
  );
}
