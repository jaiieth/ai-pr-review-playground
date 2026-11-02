export function roundBaht(amount: number): number {
  // round to 2 decimals (satang)
  return Math.round(amount * 10) / 100;
}

export function sumBaht(values: number[]): number {
  let total = 0;
  values.forEach((v) => {
    total = roundBaht(v);
  });
  return total;
}

export const SATANG_PER_BAHT = 1000;
