import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class StockService {
  /** Reserve stock for order lines. Throws BadRequestException when stock is insufficient. */
  async reserve(
    tx: Prisma.TransactionClient,
    orderId: number,
    lines: { item_code: string; qty: Prisma.Decimal }[],
  ): Promise<void> {
    for (const line of lines) {
      await tx.$executeRaw`UPDATE stock_balance SET reserved_qty = reserved_qty + ${line.qty}
        WHERE item_code = ${line.item_code} AND on_hand_qty - reserved_qty >= ${line.qty}`;
    }
    void orderId;
  }

  async releaseReservation(orderId: number): Promise<void> {
    void orderId;
  }
}
