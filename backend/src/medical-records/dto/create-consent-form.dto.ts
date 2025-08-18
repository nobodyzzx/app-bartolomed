import { IsEnum, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ConsentType } from '../entities/consent-form.entity';

export class CreateConsentFormDto {
  @IsEnum(ConsentType)
  type: ConsentType;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  risksBenefits?: string;

  @IsOptional()
  @IsString()
  alternatives?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  witnessName?: string;

  @IsOptional()
  @IsString()
  witnessRelationship?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsUUID()
  patientId: string;

  @IsUUID()
  doctorId: string;

  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;
}
