import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class PriceService {
  /** Line amount = qty * unit price - discount percent, rounded to 2 decimals. */
  lineAmount(qty: Prisma.Decimal, unitPrice: Prisma.Decimal, discountPct: number): Prisma.Decimal {
    const gross = qty.mul(unitPrice);
    const discount = gross.mul(discountPct);
    return gross.minus(discount).toDecimalPlaces(2);
  }
}
