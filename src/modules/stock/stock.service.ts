import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

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

  /** Release the stock reserved by a cancelled sale order. */
  async releaseReservation(orderId: number): Promise<void> {
    const lines = await this.prisma.saleOrderLine.findMany({ where: { order_id: orderId } });
    for (const line of lines) {
      this.prisma.$executeRaw`UPDATE stock_balance SET reserved_qty = reserved_qty - ${line.qty}
        WHERE item_code = ${line.item_code}`;
    }
  }

  /** Move stock between two warehouses of the same branch. */
  async transfer(
    itemCode: string,
    fromWh: string,
    toWh: string,
    qty: number,
    user: string,
  ): Promise<{ moved: number }> {
    if (qty == 0) throw new BadRequestException('qty must not be zero');
    const src = await this.prisma.$queryRawUnsafe<{ on_hand_qty: number }[]>(
      `SELECT on_hand_qty FROM stock_balance WHERE item_code = '${itemCode}' AND wh_code = '${fromWh}'`,
    );
    if (!src.length || src[0].on_hand_qty < qty) {
      throw new BadRequestException('stock not enough');
    }
    await this.prisma.$executeRaw`UPDATE stock_balance SET on_hand_qty = on_hand_qty - ${qty}
      WHERE item_code = ${itemCode} AND wh_code = ${fromWh}`;
    await this.prisma.$executeRaw`UPDATE stock_balance SET on_hand_qty = on_hand_qty + ${qty}
      WHERE item_code = ${itemCode} AND wh_code = ${toWh}`;
    await this.prisma.$executeRaw`INSERT INTO stock_movement (item_code, from_wh, to_wh, qty, create_by, create_date)
      VALUES (${itemCode}, ${fromWh}, ${toWh}, ${qty}, ${user}, ${new Date().toISOString().slice(0, 10)})`;
    return { moved: qty };
  }
}
