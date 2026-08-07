import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { DiscountDisplay } from '../../charges/entities/charge.entity';
import { PaymentMethod } from '../entities/billing.entity';

export class ChargeDiscountDto {
  @IsUUID()
  chargeId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  /** Obligatorio: un descuento sin motivo deja la caja sin explicación. */
  @IsString()
  @Length(3, 300)
  reason: string;
}

export class GlobalDiscountDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsString()
  @Length(3, 300)
  reason: string;
}

export class CheckoutPaymentDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  reference?: string;
}

export class CheckoutDto {
  /**
   * Cargos que el paciente decide pagar ahora. Puede ser un subconjunto: el
   * resto sigue pendiente en su cuenta.
   */
  @IsArray()
  @ArrayMinSize(1, { message: 'Seleccione al menos un cargo para cobrar' })
  @IsUUID('4', { each: true })
  chargeIds: string[];

  /** Descuentos aplicados a líneas puntuales. */
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ChargeDiscountDto)
  lineDiscounts?: ChargeDiscountDto[];

  /** Descuento sobre el total, que se prorratea entre las líneas. */
  @IsOptional()
  @ValidateNested()
  @Type(() => GlobalDiscountDto)
  globalDiscount?: GlobalDiscountDto;

  /**
   * Cómo se imprime el descuento en el recibo. **No altera ningún dato ni
   * ningún reporte**: los importes guardados son los mismos en ambos modos.
   */
  @IsEnum(DiscountDisplay)
  @IsOptional()
  discountDisplay?: DiscountDisplay;

  /** Pago en el mismo acto. Si se omite, la factura queda pendiente de cobro. */
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutPaymentDto)
  payment?: CheckoutPaymentDto;

  @IsString()
  @IsOptional()
  notes?: string;
}
