import { IsOptional, IsString } from 'class-validator';

export class UploadConsentDocumentDto {
  @IsOptional()
  @IsString()
  witnessName?: string;

  @IsOptional()
  @IsString()
  witnessRelationship?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
