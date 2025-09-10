import { Type } from 'class-transformer';
import { IsArray, IsDecimal, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { PaymentMethod, SaleStatus } from '../entities/sale.entity';

export class CreateSaleItemDto {
  @IsString()
  medicationStockId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsDecimal({ decimal_digits: '2' })
  unitPrice: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  discountPercent?: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @Type(() => Date)
  expiryDate?: Date;
}

export class CreateSaleDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  taxRate?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  discountAmount?: number;

  @IsDecimal({ decimal_digits: '2' })
  amountPaid: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  prescriptionNumber?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  @IsString()
  clinicId: string;
}

export class UpdateSaleDto {
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  amountPaid?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RefundSaleDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  refundAmount?: number;
}
