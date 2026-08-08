import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Aplica un margen sobre el costo de convenio a varios estudios de una vez.
 *
 * Con 110 estudios en el tarifario, fijar el margen uno por uno no es viable:
 * esto permite decir "quiero 45% en toda la hematología" y que los precios se
 * recalculen. Solo alcanza a los que tienen costo de convenio — sin costo no
 * hay margen que aplicar.
 */
export class ApplyMarginDto {
  /**
   * Categoría clínica a la que se aplica (`HEMATOLOGIA`, `HORMONAS`…). Si no
   * viene, alcanza a **todos** los estudios de laboratorio con costo.
   */
  @IsOptional()
  @IsString()
  labCategory?: string;

  /** Margen sobre el costo, en porcentaje. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  marginPct: number;

  /**
   * Múltiplo al que se redondea el precio resultante, hacia arriba. 5 Bs es
   * como se cobra en mostrador; 1 desactiva el redondeo.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  roundTo?: number;

  /**
   * `true` calcula y devuelve los cambios **sin guardarlos**. Es lo que
   * alimenta la vista previa: un cambio de precios en bloque no debería
   * confirmarse sin ver antes a cuántos estudios afecta y con qué resultado.
   */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
