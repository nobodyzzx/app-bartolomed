import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class EnterLabResultDto {
  @IsOptional()
  @IsString()
  resultValue?: string;

  @IsOptional()
  @IsString()
  resultUnit?: string;

  @IsOptional()
  @IsString()
  referenceRange?: string;

  @IsOptional()
  @IsBoolean()
  isAbnormal?: boolean;

  @IsOptional()
  @IsString()
  resultNotes?: string;

  @IsOptional()
  @IsString()
  resultFileUrl?: string;
}
