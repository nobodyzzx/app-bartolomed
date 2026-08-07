import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { MaintenanceStatus, MaintenanceType } from '../entities/asset-maintenance.entity';

export class CreateAssetMaintenanceDto {
  @IsUUID()
  assetId: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(MaintenanceType)
  @IsOptional()
  type?: MaintenanceType;

  @IsDateString()
  scheduledDate: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  estimatedCost?: number;

  @IsString()
  @IsOptional()
  technician?: string;

  @IsString()
  @IsOptional()
  vendor?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(4)
  priority?: number;
}

// No incluye assetId: reasignar el registro a otro activo (potencialmente de
// otra clínica) no es una operación de "actualización", requeriría su propio
// endpoint con las validaciones de findOne(assetId, clinicId) que ya tiene create().
export class UpdateAssetMaintenanceDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(MaintenanceType)
  @IsOptional()
  type?: MaintenanceType;

  @IsEnum(MaintenanceStatus)
  @IsOptional()
  status?: MaintenanceStatus;

  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @IsDateString()
  @IsOptional()
  completedDate?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  estimatedCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  actualCost?: number;

  @IsString()
  @IsOptional()
  technician?: string;

  @IsString()
  @IsOptional()
  vendor?: string;

  @IsString()
  @IsOptional()
  workPerformed?: string;

  @IsString()
  @IsOptional()
  partsReplaced?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(4)
  priority?: number;

  @IsDateString()
  @IsOptional()
  nextMaintenanceDate?: string;
}
