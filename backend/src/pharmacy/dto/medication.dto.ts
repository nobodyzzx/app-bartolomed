import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { MedicationCategory, ProductType, StorageCondition } from '../entities/pharmacy.entity';

export class CreateMedicationDto {
  /**
   * Opcional: si no viene, el servicio genera el siguiente libre (`MED-0471`).
   * Era obligatorio y lo fabricaba el navegador con azar.
   */
  @IsString()
  @IsOptional()
  code?: string;

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

  /** Medicamento, insumo o cuidado personal. Por defecto, medicamento. */
  @IsEnum(ProductType)
  @IsOptional()
  productType?: ProductType;

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
  @IsBoolean()
  requiresPrescription?: boolean;

  @IsOptional()
  @IsBoolean()
  isControlledSubstance?: boolean;

  @IsOptional()
  @IsString()
  controlledSubstanceSchedule?: string;

  /** El producto solo llega como muestra médica del laboratorio. Informativo. */
  @IsOptional()
  @IsBoolean()
  isMedicalSample?: boolean;
}

export class UpdateMedicationDto extends PartialType(CreateMedicationDto) {
  @IsOptional()
  @IsBoolean()
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

  @IsNumber()
  @Min(0)
  unitCost: number;

  @IsNumber()
  @Min(0)
  sellingPrice: number;

  /**
   * Opcional: hay stock que llega sin fecha de vencimiento a la vista (el
   * inventario en papel de la clínica no la trae). Omitirla registra "sin
   * fecha", que es la verdad; inventarse una haría que el control de
   * vencimientos mintiera en un sentido o en el otro.
   */
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsString()
  receivedDate: string;

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

  /** Este lote entró como muestra médica, no comprado. Informativo. */
  @IsOptional()
  @IsBoolean()
  isMedicalSample?: boolean;

  @IsString()
  clinicId: string;
}

export class UpdateMedicationStockDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minimumStock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TransferStockDto {
  @IsString()
  sourceStockId: string;

  @IsString()
  toClinicId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
