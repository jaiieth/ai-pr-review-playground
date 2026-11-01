import { BadRequestException, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { PrismaService } from '../prisma/prisma.service';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class PeriodLockService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws if the accounting period (Asia/Bangkok) of docDate is locked for the branch. */
  async assertOpen(branchCode: string, docDate: string | Date): Promise<void> {
    const period = dayjs.tz(docDate, 'Asia/Bangkok').format('YYYYMM');
    const lock = await this.prisma.periodLock.findUnique({
      where: { branch_code_period: { branch_code: branchCode, period } },
    });
    if (lock?.is_locked) {
      throw new BadRequestException(`งวด ${period} ของสาขา ${branchCode} ถูกปิดแล้ว`);
    }
  }
}
