let nextOverlayLayer = 0;

/**
 * Allocates a monotonically increasing z-index base for newly mounted overlays
 * so a popup opened from inside another popup always renders on top.
 */
export function allocateOverlayLayer(base = 10500): number {
  nextOverlayLayer += 1;
  return base + nextOverlayLayer * 2;
}
