import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class FilterAuditDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(5000)
  pageSize?: number = 50;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsIn(['success', 'failure'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  /**
   * Columna por la que ordenar. La lista blanca no es cosmética: el valor entra
   * en `orderBy()`, que TypeORM interpola en el SQL sin parametrizar, así que
   * aceptar texto libre aquí sería una inyección.
   *
   * El orden tiene que ser del servidor: el registro puede tener decenas de
   * miles de eventos y la pantalla solo recibe una página, de modo que ordenar
   * en el navegador reordenaría lo cargado y dejaría el resto fuera.
   */
  @IsOptional()
  @IsIn(['createdAt', 'userEmail', 'action', 'resource', 'method', 'statusCode', 'status', 'ipAddress'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC';
}
