import { Controller, Get, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VatService } from './vat.service';

@Controller('vat')
export class VatController {
  constructor(private readonly svc: VatService) {}

  @Get()
  calc(@Query('subTotal') subTotal: string) {
    return { vat: this.svc.vat(new Prisma.Decimal(subTotal)) };
  }
}
