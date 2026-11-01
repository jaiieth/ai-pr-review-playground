import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class StockMoveDto {
  @IsString() @IsNotEmpty() itemCode!: string;
  @IsString() @IsNotEmpty() warehouseCode!: string;
  @IsInt() qty!: number;
}
