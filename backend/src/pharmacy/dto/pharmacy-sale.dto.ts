import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
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

  /**
   * Rebaja de esta línea en bolivianos enteros — no un porcentaje. Antes era
   * `discountPercent`: para dar una rebaja de "Bs 5" en mostrador había que
   * calcular a qué porcentaje del precio equivalía.
   */
  @IsOptional()
  @IsInt()
  discountAmount?: number;

  /** Obligatorio si `discountAmount` > 0; lo valida el servicio. */
  @IsOptional()
  @IsString()
  discountReason?: string;

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

  /** Obligatorio si `discountAmount` > 0; lo valida el servicio. */
  @IsOptional()
  @IsString()
  discountReason?: string;

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

  /**
   * Motivo obligatorio (mínimo razonable) cuando `status` es CANCELLED —
   * mismo criterio que `VoidInvoiceDto` en facturación. Cancelar revierte
   * stock, cargo a cuenta y receta dispensada; el motivo es lo único que
   * queda para revisarlo después. Para cualquier otro status sigue siendo
   * una nota libre opcional, sin exigencia de formato.
   */
  @ValidateIf(o => o.status === SaleStatus.CANCELLED)
  @IsString()
  @MinLength(5, { message: 'Explique por qué se cancela la venta (mínimo 5 caracteres)' })
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
  @Min(0)
  amountPaid: number;

  /**
   * Sin mínimo, un "ok" pasaba igual — mismo criterio que cancelar una venta
   * o anular una factura (VoidInvoiceDto): con un pago corregido a mano no
   * hay más rastro que el motivo.
   */
  @IsNotEmpty()
  @IsString()
  @MinLength(5, { message: 'Explique por qué se corrige el pago (mínimo 5 caracteres)' })
  reason: string;
}
