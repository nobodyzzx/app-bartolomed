import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ValidRoles } from '../interfaces';
import { PersonalInfoDto, ProfessionalInfoDto } from './';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'The password must have a Uppercase, lowercase letter and a number',
  })
  password: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personalInfo: PersonalInfoDto;

  @IsOptional()
  professionalInfo?: ProfessionalInfoDto;

  @IsArray()
  @IsEnum(ValidRoles, { each: true })
  @IsOptional()
  roles?: ValidRoles[] = [ValidRoles.USER];

  @IsOptional()
  @IsUUID()
  clinicId?: string;
}
