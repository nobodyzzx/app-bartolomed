import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { InvoiceStatus } from '../entities/billing.entity';

export class CreateInvoiceItemDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsString()
  @IsOptional()
  serviceCode?: string;

  @IsString()
  @IsOptional()
  category?: string;
}

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  invoiceNumber: string;

  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @IsDate()
  @Type(() => Date)
  issueDate: Date;

  @IsDate()
  @Type(() => Date)
  dueDate: Date;

  @IsNumber()
  @IsOptional()
  @Min(0)
  taxRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountAmount?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  terms?: string;

  @IsBoolean()
  @IsOptional()
  isInsuranceClaim?: boolean;

  @IsString()
  @IsOptional()
  insuranceProvider?: string;

  @IsString()
  @IsOptional()
  insuranceClaimNumber?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  insuranceCoverage?: number;

  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsNotEmpty()
  clinicId: string;

  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}
