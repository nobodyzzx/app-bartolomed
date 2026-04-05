import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSmtpConfigDto {
  @IsString()
  @IsOptional()
  host?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  port?: number;

  @IsBoolean()
  @IsOptional()
  secure?: boolean;

  @IsString()
  @IsOptional()
  user?: string;

  @IsString()
  @IsOptional()
  pass?: string;

  @IsString()
  @IsOptional()
  fromName?: string;

  @IsEmail()
  @IsOptional()
  fromEmail?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
