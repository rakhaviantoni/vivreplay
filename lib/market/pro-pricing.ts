export interface ProPricing {
  amount: number;
  durationDays: number;
  introAmount: number | null;
  introEndsAt: string | null;
  introLimit: number;
}

export const DEFAULT_PRO_PRICING: ProPricing = {
  amount: 24_900,
  durationDays: 30,
  introAmount: 19_900,
  introEndsAt: '2026-11-19T16:59:59.000Z',
  introLimit: 100,
};

interface SettingsDatabase {
  prepare(query:string):{first<T=unknown>():Promise<T|null>};
}

export async function getProPricing(database: SettingsDatabase): Promise<ProPricing> {
  try {
    const row = await database.prepare("SELECT value FROM app_settings WHERE key='pro_pricing'").first() as {value?: string} | null;
    if (!row?.value) return DEFAULT_PRO_PRICING;
    const value = JSON.parse(row.value) as Partial<ProPricing>;
    return {
      amount: Number.isSafeInteger(value.amount) && Number(value.amount) > 0 ? Number(value.amount) : DEFAULT_PRO_PRICING.amount,
      durationDays: Number.isInteger(value.durationDays) && Number(value.durationDays) > 0 ? Number(value.durationDays) : DEFAULT_PRO_PRICING.durationDays,
      introAmount: value.introAmount === null ? null : Number.isSafeInteger(value.introAmount) && Number(value.introAmount) > 0 ? Number(value.introAmount) : DEFAULT_PRO_PRICING.introAmount,
      introEndsAt: value.introEndsAt && Number.isFinite(Date.parse(value.introEndsAt)) ? new Date(value.introEndsAt).toISOString() : null,
      introLimit: Number.isSafeInteger(value.introLimit) && Number(value.introLimit) >= 0 ? Number(value.introLimit) : DEFAULT_PRO_PRICING.introLimit,
    };
  } catch {
    return DEFAULT_PRO_PRICING;
  }
}
