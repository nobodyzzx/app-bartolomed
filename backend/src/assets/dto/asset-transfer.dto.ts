import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AssetTransferStatus } from '../entities/asset-transfer.entity';

export class CreateAssetTransferItemDto {
  @IsUUID()
  assetId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateAssetTransferDto {
  @IsUUID()
  targetClinicId: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateAssetTransferItemDto)
  @ArrayMinSize(1)
  items: CreateAssetTransferItemDto[];
}

export class DispatchTransferDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ConfirmReceiptDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RejectTransferDto {
  @IsString()
  @MinLength(1)
  reason: string;
}

export class FilterAssetTransfersDto {
  @IsEnum(AssetTransferStatus)
  @IsOptional()
  status?: AssetTransferStatus;
}
