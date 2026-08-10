import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class StartInventoryCountDto {
  /** Ambiente a recorrer. Omitido, el conteo abarca toda la clínica. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CountedItemDto {
  @IsUUID()
  itemId: string;

  /** Unidades halladas. 0 significa que no apareció ninguna. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  countedQuantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SaveCountedItemsDto {
  @ValidateNested({ each: true })
  @Type(() => CountedItemDto)
  @ArrayMinSize(1)
  items: CountedItemDto[];
}

export class CloseInventoryCountDto {
  /**
   * Si es `true`, las cantidades del inventario se ajustan a lo contado. En
   * `false` el conteo queda como registro de la diferencia sin tocar el stock:
   * sirve cuando lo que falta se va a buscar antes de darlo por perdido.
   */
  @IsOptional()
  adjustInventory?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
