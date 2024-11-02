import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PersonalInfoDto } from './personal-info.dto';
import { ProfessionalInfoDto } from './professional-info.dto';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'The password must have a Uppercase, lowercase letter and a number',
  })
  password: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roles?: string[];

  // @IsUUID()
  @IsString() //modificar a IsUUID
  clinicId: string;

  @IsOptional() //OJO AQUI
  personalInfo: PersonalInfoDto;

  @IsOptional()
  professionalInfo?: ProfessionalInfoDto;
}
