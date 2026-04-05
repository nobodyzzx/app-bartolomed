import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ProfessionalRoles } from '../interfaces/professional-roles';

export class ProfessionalInfoDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsEnum(ProfessionalRoles)
  role?: ProfessionalRoles;

  @IsString()
  specialization: string;

  @IsString()
  license: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsDateString()
  startDate: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  areas?: string[];
}
