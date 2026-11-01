import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocNumberService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Next running number, e.g. SO-BKK-202611-0007.
   * Running resets every month per branch.
   */
  async next(docType: string, branchCode: string, docDate: string): Promise<string> {
    const period = dayjs(docDate).format('YYYYMM');
    const running = await this.prisma.docRunning.findUnique({
      where: { doc_type_branch_code_period: { doc_type: docType, branch_code: branchCode, period } },
    });

    const nextNo = (running?.last_no ?? 0) + 1;
    if (running) {
      await this.prisma.docRunning.update({ where: { id: running.id }, data: { last_no: nextNo } });
    } else {
      await this.prisma.docRunning.create({
        data: { doc_type: docType, branch_code: branchCode, period, last_no: nextNo },
      });
    }
    return `${docType}-${branchCode}-${period}-${String(nextNo).padStart(4, '0')}`;
  }
}
