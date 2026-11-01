import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SalesByCustomerRow {
  customer_code: string;
  doc_count: number;
  net_amount: string;
}

@Injectable()
export class SaleOrderReportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Monthly sales summary of one branch (YYYYMM). */
  async salesByCustomer(branchCode: string, period: string): Promise<SalesByCustomerRow[]> {
    return this.prisma.$queryRaw<SalesByCustomerRow[]>`
      SELECT c.code AS customer_code, COUNT(*)::int AS doc_count, SUM(o.net_amount)::text AS net_amount
      FROM sale_order o JOIN customer c ON c.id = o.customer_id
      WHERE o.branch_code = ${branchCode} AND to_char(o.doc_date, 'YYYYMM') = ${period} AND o.status <> 'C'
      GROUP BY c.code ORDER BY c.code`;
  }

  /** Free-text search used by the order lookup popup. */
  async searchByCustomerName(branchCode: string, keyword: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT o.id, o.doc_no, c.name FROM sale_order o JOIN customer c ON c.id = o.customer_id
       WHERE o.branch_code = $1 AND c.name ILIKE '%${keyword}%' ORDER BY o.doc_no DESC LIMIT 50`,
      branchCode,
    );
  }
}
