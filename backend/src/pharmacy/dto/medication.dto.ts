import { Type } from 'class-transformer';
import { IsDecimal, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { MedicationCategory, StorageCondition } from '../entities/pharmacy.entity';

export class CreateMedicationDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  genericName?: string;

  @IsOptional()
  @IsString()
  brandName?: string;

  @IsString()
  strength: string;

  @IsString()
  dosageForm: string;

  @IsEnum(MedicationCategory)
  category: MedicationCategory;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  activeIngredients?: string;

  @IsOptional()
  @IsString()
  indications?: string;

  @IsOptional()
  @IsString()
  contraindications?: string;

  @IsOptional()
  @IsString()
  sideEffects?: string;

  @IsOptional()
  @IsString()
  dosageInstructions?: string;

  @IsEnum(StorageCondition)
  storageCondition: StorageCondition;

  @IsOptional()
  requiresPrescription?: boolean;

  @IsOptional()
  isControlledSubstance?: boolean;

  @IsOptional()
  @IsString()
  controlledSubstanceSchedule?: string;
}

export class UpdateMedicationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  genericName?: string;

  @IsOptional()
  @IsString()
  brandName?: string;

  @IsOptional()
  @IsString()
  strength?: string;

  @IsOptional()
  @IsString()
  dosageForm?: string;

  @IsOptional()
  @IsEnum(MedicationCategory)
  category?: MedicationCategory;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  activeIngredients?: string;

  @IsOptional()
  @IsString()
  indications?: string;

  @IsOptional()
  @IsString()
  contraindications?: string;

  @IsOptional()
  @IsString()
  sideEffects?: string;

  @IsOptional()
  @IsString()
  dosageInstructions?: string;

  @IsOptional()
  @IsEnum(StorageCondition)
  storageCondition?: StorageCondition;

  @IsOptional()
  requiresPrescription?: boolean;

  @IsOptional()
  isControlledSubstance?: boolean;

  @IsOptional()
  @IsString()
  controlledSubstanceSchedule?: string;

  @IsOptional()
  isActive?: boolean;
}

export class CreateMedicationStockDto {
  @IsString()
  medicationId: string;

  @IsString()
  batchNumber: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsDecimal({ decimal_digits: '2' })
  unitCost: number;

  @IsDecimal({ decimal_digits: '2' })
  sellingPrice: number;

  @Type(() => Date)
  expiryDate: Date;

  @Type(() => Date)
  receivedDate: Date;

  @IsOptional()
  @IsString()
  supplierBatch?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minimumStock?: number;

  @IsString()
  clinicId: string;
}

export class UpdateMedicationStockDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  unitCost?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  sellingPrice?: number;

  @IsOptional()
  @Type(() => Date)
  expiryDate?: Date;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minimumStock?: number;

  @IsOptional()
  isActive?: boolean;
}
