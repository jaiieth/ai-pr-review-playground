import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  /** Outstanding balance of a sale order = net amount - sum of receipts (only posted orders). */
  async outstanding(orderId: number): Promise<Prisma.Decimal> {
    const order = await this.prisma.saleOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'P') {
      throw new BadRequestException('order is not posted');
    }
    const rows = await this.prisma.$queryRaw<{ paid: Prisma.Decimal | null }[]>`
      SELECT SUM(amount) AS paid FROM receipt WHERE order_id = ${orderId} AND status <> 'C'`;
    const paid = rows[0]?.paid ?? new Prisma.Decimal(0);
    return order.net_amount.minus(paid);
  }

  /** Record a receipt; amount must be > 0 and not exceed the outstanding balance. */
  async receive(orderId: number, amount: number, user: string): Promise<void> {
    const balance = await this.outstanding(orderId);
    if (amount <= 0 || amount > balance.toNumber()) {
      throw new BadRequestException('invalid receipt amount');
    }
    await this.prisma.$executeRaw`INSERT INTO receipt (order_id, amount, status, create_by)
      VALUES (${orderId}, ${amount}, 'O', ${user})`;
  }
}
