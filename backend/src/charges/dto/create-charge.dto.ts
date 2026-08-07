import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ChargeOrigin } from '../entities/charge.entity';

/**
 * Alta manual de un cargo — típicamente un procedimiento hecho en el momento
 * (curación, inyectable) que no nace de una cita ni de una orden.
 */
export class CreateChargeDto {
  /** Opcional: laboratorio y farmacia atienden gente sin ficha. */
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsString()
  @IsOptional()
  patientName?: string;

  @IsEnum(ChargeOrigin)
  @IsOptional()
  origin?: ChargeOrigin;

  @IsUUID()
  @IsOptional()
  servicePriceId?: string;

  @IsString()
  description: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  listPrice: number;
}
