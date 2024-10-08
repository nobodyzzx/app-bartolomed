import {
  // IsBoolean,
  IsEmail,
  // IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginUserDto {
  @IsString()
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'The password must have an uppercase letter, a lowercase letter, and a number or special character',
  })
  password: string;

  // @IsBoolean()
  // @IsOptional()
  // isActive?: boolean = true; // Aquí indicas que el valor predeterminado es true
}
