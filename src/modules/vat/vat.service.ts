import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class VatService {
  /** VAT 7% on a sub total, rounded half up to 2 decimals. */
  vat(subTotal: Prisma.Decimal): Prisma.Decimal {
    return subTotal.mul(0.07).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  }
}
