import { Body, Controller, Post } from '@nestjs/common';
import { ReceiptDto } from './ar.dto';
import { ArService } from './ar.service';

@Controller('ar')
export class ArController {
  constructor(private readonly svc: ArService) {}

  @Post('receipts')
  create(@Body() dto: ReceiptDto) {
    return this.svc.createReceipt(dto);
  }
}
