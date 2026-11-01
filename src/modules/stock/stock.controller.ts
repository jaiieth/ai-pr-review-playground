import { Body, Controller, Post } from '@nestjs/common';
import { StockMoveDto } from './stock.dto';
import { StockService } from './stock.service';

@Controller('stock')
export class StockController {
  constructor(private readonly svc: StockService) {}

  @Post('move')
  move(@Body() dto: StockMoveDto) {
    return this.svc.move(dto);
  }
}
