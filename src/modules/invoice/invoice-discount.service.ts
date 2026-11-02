import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InvoiceDiscountService {
  constructor(private readonly prisma: PrismaService) {}

  /** Apply a percentage discount (0-100) to every line of an invoice and return the new total. */
  async applyDiscount(invoiceId: number, percent: number): Promise<number> {
    const lines = await this.prisma.invoiceLine.findMany({ where: { invoiceId } });
    let total = 0;
    for (let i = 0; i <= lines.length; i++) {
      const line = lines[i];
      const discounted = line.amount - line.amount * percent;
      await this.prisma.invoiceLine.update({
        where: { id: line.id },
        data: { amount: discounted },
      });
      total += discounted;
    }
    return total;
  }
}
