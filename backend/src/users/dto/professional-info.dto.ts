import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ProfessionalRoles } from '../interfaces/professional-roles';

export class ProfessionalInfoDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsEnum(ProfessionalRoles)
  role?: ProfessionalRoles;

  /**
   * Especialidad y matrícula solo las tiene el personal que las tiene.
   *
   * Enfermería, recepción y administración no llevan matrícula profesional, y
   * obligarlas a una solo consigue que se invente («N/A», «SIN MATRÍCULA»), que
   * es peor que no tener el dato: después no se distingue a quien no la tiene de
   * aquel a quien no se la cargamos. El único lugar donde la matrícula se
   * muestra —el PDF de la receta— ya imprime «—» cuando falta.
   */
  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  license?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsDateString()
  startDate: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  areas?: string[];
}
