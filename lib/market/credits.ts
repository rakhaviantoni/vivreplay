export interface CreditTopupPackage {
  amount: number;
  label: string;
  currency?: 'IDR' | 'USD';
}

export const CREDIT_TOPUP_PACKAGES: readonly CreditTopupPackage[] = [
  { amount: 25_000, label: 'Rp 25.000', currency: 'IDR' },
  { amount: 50_000, label: 'Rp 50.000', currency: 'IDR' },
  { amount: 100_000, label: 'Rp 100.000', currency: 'IDR' },
  { amount: 250_000, label: 'Rp 250.000', currency: 'IDR' },
] as const;

export const USD_CREDIT_TOPUP_PACKAGES: readonly CreditTopupPackage[] = [
  { amount: 500, label: '$5.00', currency: 'USD' },
  { amount: 1_000, label: '$10.00', currency: 'USD' },
  { amount: 2_500, label: '$25.00', currency: 'USD' },
  { amount: 5_000, label: '$50.00', currency: 'USD' },
  { amount: 10_000, label: '$100.00', currency: 'USD' },
] as const;

export const ALLOWED_CREDIT_TOPUP_AMOUNTS = new Set<number>(
  CREDIT_TOPUP_PACKAGES.map(pkg => pkg.amount),
);
