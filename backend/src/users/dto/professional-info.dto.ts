import { IsArray, IsOptional, IsString } from 'class-validator';

export class ProfessionalInfoDto {
  @IsString()
  specialty: string;

  @IsString()
  license: string;

  @IsArray()
  @IsString({ each: true })
  certifications: string[];

  @IsString()
  @IsOptional()
  education?: string;

  @IsString()
  @IsOptional()
  experience?: string;
}
