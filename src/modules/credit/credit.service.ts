import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CreditService {
  constructor(private readonly prisma: PrismaService) {}

  /** True when the customer can take a new order of `amount` without exceeding the credit limit. */
  async canOrder(customerId: number, amount: number): Promise<boolean> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    const open = await this.prisma.saleOrder.findMany({ where: { customer_id: customerId, status: 'O' } });
    const used = open.reduce((sum, o) => sum + Number(o.net_amount), 0);
    return used + amount < Number(customer!.credit_limit);
  }
}
