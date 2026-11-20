'use client';

const preloadedImageUrls = new Set<string>();
const MAX_PRELOADED_CACHE = 600;

export function preloadCardImage(url?: string | null) {
  if (typeof window === 'undefined' || !url || preloadedImageUrls.has(url)) return;
  if (preloadedImageUrls.size >= MAX_PRELOADED_CACHE) {
    const oldest = preloadedImageUrls.values().next().value;
    if (oldest) preloadedImageUrls.delete(oldest);
  }
  preloadedImageUrls.add(url);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
}

export function scheduleCardImagePreload(urls: Array<string | null | undefined>, limit = 24): () => void {
  if (typeof window === 'undefined') return () => {};
  const queue = urls.filter((url): url is string => Boolean(url && !preloadedImageUrls.has(url))).slice(0, limit);
  if (!queue.length) return () => {};

  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    for (const url of queue) preloadCardImage(url);
  };

  if (typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(run, { timeout: 1200 });
    return () => {
      cancelled = true;
      window.cancelIdleCallback(idleId);
    };
  }
  const timerId = window.setTimeout(run, 150);
  return () => {
    cancelled = true;
    window.clearTimeout(timerId);
  };
}
