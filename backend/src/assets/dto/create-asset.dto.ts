import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { AssetCondition, AssetStatus, AssetType, DepreciationMethod } from '../entities/asset.entity';

export class CreateAssetDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(AssetType)
  type: AssetType;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  subCategory?: string;

  @IsString()
  @IsOptional()
  manufacturer?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsString()
  @IsOptional()
  barcodeNumber?: string;

  @IsEnum(AssetStatus)
  @IsOptional()
  status?: AssetStatus;

  @IsEnum(AssetCondition)
  @IsOptional()
  condition?: AssetCondition;

  @IsNumber()
  @Min(0)
  purchasePrice: number;

  @IsDateString()
  purchaseDate: string;

  @IsString()
  @IsOptional()
  vendor?: string;

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @IsString()
  @IsOptional()
  warrantyInfo?: string;

  @IsDateString()
  @IsOptional()
  warrantyExpiry?: string;

  @IsEnum(DepreciationMethod)
  @IsOptional()
  depreciationMethod?: DepreciationMethod;

  @IsNumber()
  @IsOptional()
  @Min(1)
  usefulLifeYears?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  salvageValue?: number;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  building?: string;

  @IsString()
  @IsOptional()
  floor?: string;

  @IsDateString()
  @IsOptional()
  lastMaintenanceDate?: string;

  @IsDateString()
  @IsOptional()
  nextMaintenanceDate?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maintenanceIntervalMonths?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  specifications?: any;

  @IsOptional()
  attachments?: any;
}
