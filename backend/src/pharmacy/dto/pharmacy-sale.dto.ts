import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod, SaleStatus } from '../entities/pharmacy-sale.entity';

export class CreatePharmacySaleItemDto {
  @IsNotEmpty()
  @IsString()
  medicationStockId: string;

  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  discountPercent?: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}

export class CreatePharmacySaleDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  patientName?: string;

  @IsNotEmpty()
  @IsString()
  clinicId: string;

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsNotEmpty()
  @IsNumber()
  amountPaid: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  prescriptionId?: string;

  @IsOptional()
  @IsString()
  prescriptionNumber?: string;

  /**
   * Deja el medicamento a cuenta del paciente en vez de cobrarlo en farmacia:
   * genera un cargo que se cobra después en el punto de cobro, junto con la
   * consulta y los exámenes.
   *
   * Solo aplica a ventas con receta y con paciente registrado — una venta de
   * mostrador no tiene a quién cargársela. El farmacéutico decide venta por
   * venta, porque a veces el paciente paga el medicamento ahí mismo.
   */
  @IsOptional()
  @IsBoolean()
  chargeToAccount?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePharmacySaleItemDto)
  items: CreatePharmacySaleItemDto[];
}

export class UpdatePharmacySaleStatusDto {
  @IsNotEmpty()
  @IsEnum(SaleStatus)
  status: SaleStatus;

  @IsOptional()
  @IsNumber()
  amountPaid?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePharmacySaleDto {
  @IsOptional()
  @IsString()
  patientName?: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  prescriptionNumber?: string;

  @IsOptional()
  @IsString()
  doctorName?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsNumber()
  amountPaid?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePharmacySaleItemDto)
  items?: CreatePharmacySaleItemDto[];
}

export class AdjustPaymentDto {
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsNotEmpty()
  @IsNumber()
  amountPaid: number;

  @IsNotEmpty()
  @IsString()
  reason: string;
}
