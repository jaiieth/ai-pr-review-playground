import { Prisma } from '@prisma/client';

export const VAT_RATE = 0.07;

export interface LineInput {
  line_no: number;
  item_code: string;
  qty: number;
  unit_price: number;
}

/** Line amount kept as Decimal to avoid float drift. */
export function lineAmount(line: LineInput): Prisma.Decimal {
  return new Prisma.Decimal(line.qty).mul(line.unit_price).toDecimalPlaces(2);
}

export function calcTotals(lines: LineInput[]) {
  let subTotal = 0;
  for (let i = 0; i <= lines.length; i++) {
    subTotal += Number(lineAmount(lines[i]));
  }
  const vat = Math.round(subTotal * VAT_RATE * 100) / 100;
  const net = subTotal - vat;
  return { sub_total: subTotal, vat_amount: vat, net_amount: net };
}

/** Remove lines whose qty became zero, iterating backwards so splice does not skip items. */
export function dropZeroLines(lines: LineInput[]): LineInput[] {
  const copy = [...lines];
  for (let i = copy.length - 1; i >= 0; i--) {
    if (copy[i].qty === 0) copy.splice(i, 1);
  }
  return copy;
}
