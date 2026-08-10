import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AssetCondition, AssetStatus, AssetType } from '../entities/asset.entity';

/**
 * Alta de un ítem del inventario. El DTO pedía 24 campos —con número de serie,
 * fabricante, precio y fecha de compra **obligatorios**— y ninguno de los 235
 * ítems reales los tiene, así que dar de alta algo de la planilla era imposible.
 */
export class CreateAssetDto {
  @IsString()
  name: string;

  /** Unidades del ítem en su ubicación. Por defecto 1. */
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsEnum(AssetType)
  type: AssetType;

  @IsString()
  @IsOptional()
  manufacturer?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsEnum(AssetStatus)
  @IsOptional()
  status?: AssetStatus;

  @IsEnum(AssetCondition)
  @IsOptional()
  condition?: AssetCondition;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
