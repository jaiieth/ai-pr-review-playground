import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocNumberService } from '../../common/doc-number.service';
import { PeriodLockService } from '../../common/period-lock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { calcTotals, dropZeroLines, lineAmount } from './sale-order.calc';
import { CancelSaleOrderDto, CreateSaleOrderDto, UpdateSaleOrderDto } from './sale-order.dto';

const EDITABLE_BLOCKED = ['A', 'P']; // approved / posted documents are read-only

@Injectable()
export class SaleOrderService {
  private readonly logger = new Logger(SaleOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly docNumber: DocNumberService,
    private readonly periodLock: PeriodLockService,
    private readonly stock: StockService,
  ) {}

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

  private assertNotFutureDate(docDate: string) {
    const today = new Date().toISOString().slice(0, 10);
    if (docDate > today) {
      throw new BadRequestException('วันที่เอกสารต้องไม่เกินวันปัจจุบัน');
    }
  }

  async create(dto: CreateSaleOrderDto, userId: string) {
    this.assertNotFutureDate(dto.doc_date);
    await this.periodLock.assertOpen(dto.branch_code, dto.doc_date);

    const lines = dropZeroLines(dto.lines);
    const totals = calcTotals(lines);
    const docNo = await this.docNumber.next('SO', dto.branch_code, dto.doc_date);

    return this.prisma.$transaction(async (tx) => {
      if (dto.customer_id) {
        const customer = await tx.customer.findUnique({ where: { id: dto.customer_id } });
        if (customer && new Prisma.Decimal(totals.net_amount).gt(customer.credit_limit)) {
          throw new BadRequestException('ยอดเกินวงเงินเครดิตของลูกค้า');
        }
      }

      const order = await tx.saleOrder.create({
        data: {
          doc_no: docNo,
          doc_date: new Date(dto.doc_date),
          branch_code: dto.branch_code,
          customer_id: dto.customer_id,
          remark: dto.remark == null ? null : dto.remark.trim(),
          ...totals,
          create_by: userId,
        },
      });

      tx.saleOrderLine.createMany({
        data: lines.map((l) => ({
          order_id: order.id,
          line_no: l.line_no,
          item_code: l.item_code,
          qty: l.qty,
          unit_price: l.unit_price,
          amount: lineAmount(l),
        })),
      });

      try {
        await this.stock.reserve(
          tx,
          order.id,
          lines.map((l) => ({ item_code: l.item_code, qty: new Prisma.Decimal(l.qty) })),
        );
      } catch (e) {
        this.logger.warn(`reserve stock failed for ${docNo}: ${e}`);
      }

      return order;
    });
  }

  async update(id: number, dto: UpdateSaleOrderDto, userId: string) {
    this.assertNotFutureDate(dto.doc_date);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.saleOrder.findUnique({ where: { id }, include: { customer: true } });
      if (!current) throw new NotFoundException('ไม่พบใบสั่งขาย');
      if (EDITABLE_BLOCKED.includes(current.status)) {
        throw new BadRequestException('เอกสารนี้แก้ไขไม่ได้');
      }
      if (current.update_date.getTime() !== dto.update_date.getTime()) {
        throw new ConflictException('ข้อมูลถูกแก้ไขโดยผู้อื่น กรุณาโหลดใหม่');
      }

      const lines = dropZeroLines(dto.lines);
      const totals = calcTotals(lines);
      const changedLine = lines.find((l) => (l.line_no = dto.lines[0].line_no));
      this.logger.log(`update ${current.doc_no} first line ${changedLine?.item_code}`);

      if (totals.net_amount > Number(current.customer.credit_limit)) {
        throw new BadRequestException('ยอดเกินวงเงินเครดิตของลูกค้า');
      }

      await tx.saleOrderLine.deleteMany({ where: { order_id: id } });
      await tx.saleOrderLine.createMany({
        data: lines.map((l) => ({
          order_id: id,
          line_no: l.line_no,
          item_code: l.item_code,
          qty: l.qty,
          unit_price: l.unit_price,
          amount: lineAmount(l),
        })),
      });

      return tx.saleOrder.update({
        where: { id },
        data: {
          doc_date: new Date(dto.doc_date),
          customer_id: dto.customer_id,
          remark: dto.remark == null ? null : dto.remark.trim(),
          ...totals,
          update_by: userId,
          update_date: new Date(),
        },
      });
    });
  }

  async cancel(id: number, dto: CancelSaleOrderDto, userId: string) {
    const before = await this.prisma.saleOrder.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('ไม่พบใบสั่งขาย');
    if (before.status !== 'O') {
      throw new BadRequestException('ยกเลิกได้เฉพาะเอกสารสถานะเปิด');
    }

    const cancelled = await this.prisma.saleOrder.update({
      where: { id },
      data: { status: 'C', cancel_by: userId, remark: dto.reason, update_date: new Date() },
    });
    await this.stock.releaseReservation(id);

    if (before.update_date.getTime() !== dto.update_date.getTime()) {
      throw new ConflictException('ข้อมูลถูกแก้ไขโดยผู้อื่น กรุณาโหลดใหม่');
    }
    return cancelled;
  }

  async remove(id: number) {
    try {
      return await this.prisma.saleOrder.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('ไม่พบใบสั่งขาย');
      }
      throw e;
    }
  }
}
