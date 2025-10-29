import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class GodBootstrapDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsIn(['create', 'promote'])
  mode?: 'create' | 'promote' = 'create';
}
