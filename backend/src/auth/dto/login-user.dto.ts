import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH } from '../constants/password-policy';

export class LoginUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
  // role field is not required for login

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
