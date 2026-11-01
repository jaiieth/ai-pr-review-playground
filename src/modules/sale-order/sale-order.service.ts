import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SaleOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: number) {
    const order = await this.prisma.saleOrder.findUnique({
      where: { id },
      include: { lines: { orderBy: { line_no: 'asc' } }, customer: true },
    });
    if (!order) throw new NotFoundException('ไม่พบใบสั่งขาย');
    return order;
  }

  async findAll(branchCode: string, page = 1, pageSize = 50) {
    return this.prisma.saleOrder.findMany({
      where: { branch_code: branchCode },
      orderBy: { doc_date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }
}
