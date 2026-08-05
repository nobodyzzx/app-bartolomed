import { IsString, Length } from 'class-validator';

export class CancelChargeDto {
  /** Obligatorio: anular un cargo sin motivo deja la caja sin explicación. */
  @IsString()
  @Length(3, 300)
  reason: string;
}
