import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { AssetCondition, AssetStatus, AssetType } from '../entities/asset.entity';

export class FilterAssetsDto {
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;

  @IsOptional()
  @IsEnum(AssetCondition)
  condition?: AssetCondition;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  purchaseDateFrom?: string;

  @IsOptional()
  @IsDateString()
  purchaseDateTo?: string;

  @IsOptional()
  @IsString()
  search?: string; // Búsqueda general (nombre, descripción, serial)
}
