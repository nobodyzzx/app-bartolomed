import {
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePrescriptionItemDto {
  @IsString()
  medicationName: string;

  @IsOptional()
  @IsString()
  genericName?: string;

  @IsString()
  strength: string;

  @IsString()
  dosageForm: string;

  @IsString()
  quantity: string;

  @IsString()
  dosage: string;

  @IsString()
  frequency: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  indication?: string;

  @IsOptional()
  @IsBoolean()
  isSubstitutionAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  isControlled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreatePrescriptionDto {
  @IsString()
  prescriptionNumber: string;

  @IsDateString()
  prescriptionDate: string;

  @IsDateString()
  expiryDate: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  patientInstructions?: string;

  @IsOptional()
  @IsString()
  pharmacyInstructions?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isElectronic?: boolean;

  @IsOptional()
  @IsBoolean()
  isControlledSubstance?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  refillsAllowed?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDto)
  items: CreatePrescriptionItemDto[];

  @IsUUID()
  patientId: string;

  @IsUUID()
  doctorId: string;

  @IsUUID()
  clinicId: string;
}
