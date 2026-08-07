import { Transform } from 'class-transformer';
import { IsBooleanString, IsEnum, IsOptional, IsString } from 'class-validator';
import { AppointmentType } from '../../appointments/entities/appointment.entity';
import { ServiceCategory } from '../entities/service-price.entity';

export class FilterServicePricesDto {
  @IsEnum(ServiceCategory)
  @IsOptional()
  category?: ServiceCategory;

  @IsEnum(AppointmentType)
  @IsOptional()
  appointmentType?: AppointmentType;

  /** Busca en código y nombre. */
  @IsString()
  @IsOptional()
  search?: string;

  /**
   * Llega como string por querystring. Sin este `Transform`, `'false'` sería
   * truthy y el filtro devolvería siempre los activos.
   */
  @IsBooleanString()
  @IsOptional()
  @Transform(({ value }) => value)
  isActive?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
