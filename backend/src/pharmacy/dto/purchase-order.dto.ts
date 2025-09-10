import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PurchaseOrderStatus } from '../entities/purchase-order.entity';

export class CreatePurchaseOrderItemDto {
  @IsNotEmpty()
  @IsString()
  productName: string;

  @IsOptional()
  @IsString()
  productCode?: string;

  @IsOptional()
  @IsString()
  medicationId?: string;

  @IsOptional()
  @IsString()
  medicationName?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  unitPrice: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @IsNotEmpty()
  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  orderDate: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expectedDeliveryDate?: Date;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  shippingCost?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderStatusDto {
  @IsNotEmpty()
  @IsEnum(PurchaseOrderStatus)
  status: PurchaseOrderStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  actualDeliveryDate?: Date;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  orderDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expectedDeliveryDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  actualDeliveryDate?: Date;

  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items?: CreatePurchaseOrderItemDto[];
}
