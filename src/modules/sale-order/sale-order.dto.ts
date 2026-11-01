import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD');

export const SaleOrderLineSchema = z.object({
  line_no: z.number().int().positive(),
  item_code: z.string().min(1).max(30),
  qty: z.coerce.number().positive('จำนวนต้องมากกว่า 0'),
  unit_price: z.coerce.number().nonnegative('ราคาต้องไม่ติดลบ'),
});

export const CreateSaleOrderSchema = z.object({
  branch_code: z.string().length(3),
  doc_date: dateOnly,
  customer_id: z.number().int().positive().optional(),
  remark: z.string().max(500).nullish(),
  lines: z.array(SaleOrderLineSchema).min(1, 'ต้องมีรายการอย่างน้อย 1 รายการ'),
});

export const UpdateSaleOrderSchema = CreateSaleOrderSchema.omit({ branch_code: true }).extend({
  // optimistic lock token: update_date the client last read
  update_date: z.coerce.date(),
});

export const CancelSaleOrderSchema = z.object({
  update_date: z.coerce.date(),
  reason: z.string().min(1).max(200),
});

export class CreateSaleOrderDto extends createZodDto(CreateSaleOrderSchema) {}
export class UpdateSaleOrderDto extends createZodDto(UpdateSaleOrderSchema) {}
export class CancelSaleOrderDto extends createZodDto(CancelSaleOrderSchema) {}
