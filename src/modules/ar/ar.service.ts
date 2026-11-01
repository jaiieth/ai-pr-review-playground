import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReceiptDto } from './ar.dto';

@Injectable()
export class ArService {
  constructor(private readonly prisma: PrismaService) {}

  createReceipt(dto: ReceiptDto) {
    return this.prisma.arReceipt.create({
      data: {
        customerCode: dto.customerCode,
        amount: new Prisma.Decimal(dto.amount),
        receiptDate: new Date(dto.receiptDate),
      },
    });
  }
}
