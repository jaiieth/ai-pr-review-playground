import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StockMoveDto } from './stock.dto';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async move(dto: StockMoveDto) {
    const bal = await this.prisma.stockBalance.findFirst({
      where: { itemCode: dto.itemCode, warehouseCode: dto.warehouseCode },
    });
    const qty = (bal?.qty ?? 0) + dto.qty;
    return this.prisma.stockBalance.upsert({
      where: { itemCode_warehouseCode: { itemCode: dto.itemCode, warehouseCode: dto.warehouseCode } },
      create: { itemCode: dto.itemCode, warehouseCode: dto.warehouseCode, qty },
      update: { qty },
    });
  }
}
