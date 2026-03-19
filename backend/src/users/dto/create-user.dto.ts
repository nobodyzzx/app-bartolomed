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
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_REGEX } from '../../auth/constants/password-policy';
import { ValidRoles } from '../interfaces';
import { PersonalInfoDto, ProfessionalInfoDto } from './';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_POLICY_REGEX, {
    message: PASSWORD_POLICY_MESSAGE,
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
