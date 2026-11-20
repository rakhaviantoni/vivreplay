export function blockForSet(code: string, payload?: { block?: string | number; block_value?: string | number } | null): string {
  const direct = payload?.block_value ?? payload?.block;
  if (direct !== undefined && direct !== null && String(direct).trim()) return String(direct).toUpperCase();
  const match = code.toUpperCase().match(/^(OP|EB|ST|PRB)[-_ ]?0*(\d+)/);
  if (!match) return 'X';
  const number = Number(match[2]);
  if (match[1] === 'OP') return String(Math.min(5, Math.max(1, Math.ceil(number / 4))));
  if (match[1] === 'EB') return String(Math.min(5, Math.max(1, Math.ceil((number + 1) / 2) + 1)));
  if (match[1] === 'ST') return number >= 28 ? '5' : number >= 20 ? '4' : number >= 11 ? '3' : number >= 5 ? '2' : '1';
  return number >= 2 ? '5' : '4';
}

export function onePieceSetRank(code: string): number {
  const match = code.toUpperCase().match(/^(OP|EB|ST|PRB|P|DON)[-_ ]?0*(\d+)/);
  if (!match) return 0;
  const family: Record<string, number> = { OP: 600, EB: 500, ST: 400, PRB: 300, P: 200, DON: 100 };
  return (family[match[1]] ?? 0) * 1000 + Number(match[2]);
}
