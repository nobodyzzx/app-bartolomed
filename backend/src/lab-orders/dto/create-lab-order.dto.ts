import {
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsArray,
  IsEnum,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LabTestCategory } from '../entities/lab-order.entity';

export class CreateLabOrderItemDto {
  @IsString()
  testName: string;

  @IsEnum(LabTestCategory)
  category: LabTestCategory;

  @IsOptional()
  @IsString()
  specimenType?: string;
}

export class CreateLabOrderDto {
  @IsString()
  orderNumber: string;

  @IsDateString()
  orderDate: string;

  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;

  @IsArray()
  @ArrayMinSize(1, { message: 'La orden debe tener al menos un estudio' })
  @ValidateNested({ each: true })
  @Type(() => CreateLabOrderItemDto)
  items: CreateLabOrderItemDto[];

  @IsUUID()
  patientId: string;

  @IsUUID()
  doctorId: string;

  @IsUUID()
  clinicId: string;

  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;
}
