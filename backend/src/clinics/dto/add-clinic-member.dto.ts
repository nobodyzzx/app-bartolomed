import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class AddClinicMemberDto {
  @IsUUID()
  userId: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roles?: string[] = [];
}
