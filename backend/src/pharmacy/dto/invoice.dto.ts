import { Type as TransformType } from 'class-transformer';
import { IsDecimal, IsEnum, IsOptional, IsString } from 'class-validator';
import { InvoiceStatus } from '../entities/invoice.entity';

export class CreateInvoiceDto {
  @IsString()
  saleId: string;

  @TransformType(() => Date)
  invoiceDate: Date;

  @TransformType(() => Date)
  dueDate: Date;

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  taxRate?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  discountAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsString()
  clinicId: string;
}

export class UpdateInvoiceDto {
  @IsOptional()
  @TransformType(() => Date)
  dueDate?: Date;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  amountPaid?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;
}

export class PayInvoiceDto {
  @IsDecimal({ decimal_digits: '2' })
  amountPaid: number;

  @TransformType(() => Date)
  paidDate: Date;

  @IsOptional()
  @IsString()
  paymentReference?: string;
}
