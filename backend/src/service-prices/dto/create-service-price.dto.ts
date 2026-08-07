import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Length, Min, ValidateIf } from 'class-validator';
import { AppointmentType } from '../../appointments/entities/appointment.entity';
import { ServiceCategory } from '../entities/service-price.entity';

export class CreateServicePriceDto {
  /** Único por clínica — el servicio devuelve 409 si ya existe. */
  @IsString()
  @Length(2, 30)
  code: string;

  @IsString()
  @Length(2, 120)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ServiceCategory)
  category: ServiceCategory;

  /**
   * Solo tiene sentido en `CONSULTATION`: es lo que permite resolver la tarifa
   * de una cita automáticamente. Se valida condicionalmente para que no se
   * cuele en un examen de laboratorio, donde no significaría nada.
   */
  @ValidateIf(o => o.category === ServiceCategory.CONSULTATION)
  @IsEnum(AppointmentType)
  @IsOptional()
  appointmentType?: AppointmentType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
