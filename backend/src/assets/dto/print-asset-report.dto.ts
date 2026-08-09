import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class PrintAssetReportDto {
  @ApiPropertyOptional({
    description: 'Limita el informe a un solo ambiente (coincidencia exacta con la ubicación del activo)',
    example: 'SALA ECOGRAFIA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({
    description: 'Tamaño de papel. `oficio` (21,6 × 33 cm) es el que la clínica tiene en la impresora',
    enum: ['oficio', 'a4'],
    default: 'oficio',
  })
  @IsOptional()
  @IsIn(['oficio', 'a4'])
  paper?: 'oficio' | 'a4';
}

export class PrintHandoverActDto extends PrintAssetReportDto {
  @ApiPropertyOptional({ description: 'Nombre de quien entrega; en blanco, la línea de firma sale vacía' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deliveredBy?: string;

  @ApiPropertyOptional({ description: 'Nombre de quien recibe; en blanco, la línea de firma sale vacía' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  receivedBy?: string;
}
