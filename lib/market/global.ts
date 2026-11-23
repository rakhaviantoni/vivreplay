export type TradeScope = 'ID_ONLY' | 'GLOBAL_ONLY' | 'BOTH';
export type MarketCurrency = 'IDR' | 'USD';

export const DEFAULT_IDR_PER_USD = 16_000;

export const USD_PRO_PRICING = {
  monthlyCents: 499,
  annualCents: 4999,
} as const;

export const USD_BOOST_PRICE_CENTS = 99;

export function normalizeTradeScope(value: unknown): TradeScope {
  if (value === 'GLOBAL_ONLY' || value === 'BOTH') return value;
  return 'ID_ONLY';
}

export function normalizeMarketCurrency(value: unknown): MarketCurrency {
  return value === 'USD' ? 'USD' : 'IDR';
}

/**
 * Converts between IDR (whole Rupiah) and USD (cents).
 */
export function convertMoney(
  amount: number,
  from: MarketCurrency,
  to: MarketCurrency,
  idrPerUsd: number = DEFAULT_IDR_PER_USD,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (from === to) return Math.round(amount);
  const rate = idrPerUsd > 0 ? idrPerUsd : DEFAULT_IDR_PER_USD;
  if (from === 'IDR' && to === 'USD') {
    // 1 USD (100 cents) = rate IDR => 1 IDR = 100 / rate cents
    return Math.max(1, Math.round((amount * 100) / rate));
  }
  // USD cents -> IDR whole units
  return Math.max(1, Math.round((amount * rate) / 100));
}

export function tradeScopeLabel(scope: TradeScope, locale: 'EN' | 'ID'): string {
  if (scope === 'GLOBAL_ONLY') {
    return locale === 'ID' ? 'Khusus Internasional' : 'International only';
  }
  if (scope === 'BOTH') {
    return locale === 'ID' ? 'Indonesia & Internasional' : 'Indonesia & International';
  }
  return locale === 'ID' ? 'Khusus Indonesia' : 'Indonesia only';
}

export function tradeScopeBadgeLabel(scope: TradeScope, locale: 'EN' | 'ID'): string | null {
  if (scope === 'GLOBAL_ONLY') return locale === 'ID' ? 'Global' : 'Global';
  if (scope === 'BOTH') return locale === 'ID' ? 'ID + Global' : 'ID + Global';
  return null;
}

export function minListingUnitAmount(currency: MarketCurrency): number {
  return currency === 'USD' ? 100 : 1_000;
}
