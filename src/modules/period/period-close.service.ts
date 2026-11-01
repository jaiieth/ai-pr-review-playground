import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PeriodCloseService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lock a period for a branch; all sale orders in it must be posted or cancelled. */
  async close(branch: string, period: string): Promise<void> {
    const open = await this.prisma.saleOrder.count({
      where: { branch_code: branch, status: 'O' },
    });
    if (open > 0) throw new BadRequestException(`${open} open orders in ${period}`);
    await this.prisma.periodLock.update({
      where: { branch_code_period: { branch_code: branch, period } },
      data: { is_locked: true },
    });
  }
}
