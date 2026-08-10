import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class MoveAssetDto {
  /** Ambiente al que va. Se acepta texto libre: es el mismo campo del ítem. */
  @IsString()
  @MaxLength(200)
  toLocation: string;

  /**
   * Clínica a la que va. Omitida, el ítem se queda en la suya, que es el caso
   * corriente. Solo se admite una clínica de la que el usuario sea miembro.
   */
  @IsOptional()
  @IsUUID()
  toClinicId?: string;

  /** Unidades que se mueven. Omitida, va el ítem completo. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class FilterMovementsDto {
  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
