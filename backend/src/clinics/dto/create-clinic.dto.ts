import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateClinicDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  address: string;

  @IsString()
  @MinLength(8)
  @MaxLength(8)
  @Matches(/^[67]\d{7}$/i, { message: 'Phone must be 8 digits starting with 6 or 7' })
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  departamento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  provincia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  localidad?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
