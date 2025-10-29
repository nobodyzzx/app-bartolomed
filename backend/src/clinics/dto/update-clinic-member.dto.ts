import { IsArray, IsString } from 'class-validator';

export class UpdateClinicMemberDto {
  @IsArray()
  @IsString({ each: true })
  roles: string[];
}
