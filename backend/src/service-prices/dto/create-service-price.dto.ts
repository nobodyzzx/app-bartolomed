import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Length, Min, ValidateIf } from 'class-validator';
import { AppointmentType } from '../../appointments/entities/appointment.entity';
import { ServiceCategory } from '../entities/service-price.entity';

export class CreateServicePriceDto {
  /**
   * Único por clínica — el servicio devuelve 409 si ya existe.
   *
   * Opcional: si no viene, el servicio genera el siguiente libre de la
   * categoría (`CONS-009`, `PROC-021`…). Era obligatorio, y obligaba a
   * inventárselo a mano sin ver los que ya existen. Se sigue aceptando para
   * quien quiera uno mnemotécnico.
   */
  @IsString()
  @Length(2, 30)
  @IsOptional()
  code?: string;

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

  /**
   * Categoría clínica del examen (`HEMATOLOGIA`, `QUIMICA_SANGUINEA`…). Solo
   * en laboratorio.
   *
   * Faltaba, y no era un detalle: sin ella un examen dado de alta desde la
   * pantalla quedaba fuera de su grupo en el selector de órdenes —caía en
   * "Otros estudios"— y ahora además no podría recibir el prefijo de código de
   * su familia.
   */
  @ValidateIf(o => o.category === ServiceCategory.LABORATORY)
  @IsString()
  @IsOptional()
  labCategory?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  /**
   * Costo de convenio: lo que cobra el laboratorio externo por el estudio
   * derivado. Editable porque los convenios se renegocian; si no se envía, el
   * costo existente no se toca.
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  costPrice?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  /** ¿El estudio exige consentimiento informado firmado? (colonoscopía sí). */
  @IsBoolean()
  @IsOptional()
  requiresConsent?: boolean;
}
