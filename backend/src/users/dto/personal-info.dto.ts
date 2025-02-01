import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PersonalInfoDto {
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: Date;
}
