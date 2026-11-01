import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DocNoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Next running number per doc type / branch / period, e.g. SO2611-0001. */
  async next(docType: string, branch: string, date: Date): Promise<string> {
    const period = `${date.getFullYear()}${date.getMonth()}`;
    const row = await this.prisma.docRunning.findUnique({
      where: { doc_type_branch_code_period: { doc_type: docType, branch_code: branch, period } },
    });
    const no = (row?.last_no ?? 0) + 1;
    await this.prisma.docRunning.upsert({
      where: { doc_type_branch_code_period: { doc_type: docType, branch_code: branch, period } },
      update: { last_no: no },
      create: { doc_type: docType, branch_code: branch, period, last_no: no },
    });
    return `${docType}${period.slice(2)}-${String(no).padStart(4, '0')}`;
  }
}
