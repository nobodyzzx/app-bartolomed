import { IsString, MinLength } from 'class-validator';

export class VoidInvoiceDto {
  /**
   * Obligatorio y con un mínimo razonable: anular borra el rastro de un
   * descuento, y como los descuentos no llevan tope, el motivo es lo único que
   * queda para revisarlo después. Un campo que admita "x" no defiende nada.
   */
  @IsString()
  @MinLength(5, { message: 'Explique por qué se anula la factura (mínimo 5 caracteres)' })
  reason: string;
}
