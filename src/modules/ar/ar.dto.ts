import { IsDateString, IsNotEmpty, IsNumberString, IsString } from 'class-validator';

export class ReceiptDto {
  @IsString()
  @IsNotEmpty()
  customerCode!: string;

  @IsNumberString()
  amount!: string;

  @IsDateString()
  receiptDate!: string;
}
