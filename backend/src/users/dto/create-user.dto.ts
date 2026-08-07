import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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

  // Sin @IsOptional() ni default: un usuario creado sin roles explícitos
  // quedaba con roles=['user'] (permisos vacíos) sin ningún aviso — cuenta
  // fantasma sin ningún acceso real. Ahora se exige explícito.
  @IsArray()
  @ArrayMinSize(1, { message: 'El usuario debe tener al menos un rol' })
  @IsEnum(ValidRoles, { each: true })
  roles: ValidRoles[];

  @IsOptional()
  @IsUUID()
  clinicId?: string;
}
