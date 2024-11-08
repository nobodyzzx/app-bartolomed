import { IsDateString, IsString } from 'class-validator';

export class PersonalInfoDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  phone: string;

  @IsString()
  address: string;

  @IsDateString()
  birthDate: Date;
}
