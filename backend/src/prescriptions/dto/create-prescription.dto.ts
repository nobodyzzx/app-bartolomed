import {
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  IsEnum,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrescriptionStatus } from '../entities/prescription.entity';

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

  // Bug real (auditoría de interrelación de módulos, 2026-08-04): lab-orders
  // (calcado de este DTO) sí exige @ArrayMinSize(1) — este no lo tenía.
  // create() fija status ACTIVE por defecto y nunca pasa por
  // validateStatusTransition() (que sí exige ítems para firmar), así que
  // POST /prescriptions con items: [] creaba una receta ACTIVE sin ítems.
  @IsArray()
  @ArrayMinSize(1, { message: 'La receta debe tener al menos un medicamento' })
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDto)
  items: CreatePrescriptionItemDto[];

  @IsUUID()
  patientId: string;

  @IsUUID()
  doctorId: string;

  @IsUUID()
  clinicId: string;

  @IsOptional()
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;
}
