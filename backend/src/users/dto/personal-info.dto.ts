import { IsDateString, IsString } from 'class-validator';

export class PersonalInfoDto {
  @IsString()
  address: string;

  @IsString()
  phone: string;

  @IsDateString()
  birthDate: Date;

  @IsString()
  documentType: string;

  @IsString()
  documentNumber: string;
}
