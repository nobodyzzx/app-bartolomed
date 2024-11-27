import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateClinicDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsString()
  phone: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
