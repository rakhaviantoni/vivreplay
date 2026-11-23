export interface CreditTopupPackage {
  amount: number;
  label: string;
}

export const CREDIT_TOPUP_PACKAGES: readonly CreditTopupPackage[] = [
  { amount: 25_000, label: 'Rp 25.000' },
  { amount: 50_000, label: 'Rp 50.000' },
  { amount: 100_000, label: 'Rp 100.000' },
  { amount: 250_000, label: 'Rp 250.000' },
] as const;

export const ALLOWED_CREDIT_TOPUP_AMOUNTS = new Set<number>(
  CREDIT_TOPUP_PACKAGES.map(pkg => pkg.amount),
);
