export function parseCatalogRange(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  if (!/^\d{1,3}$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 999 ? parsed : undefined;
}
