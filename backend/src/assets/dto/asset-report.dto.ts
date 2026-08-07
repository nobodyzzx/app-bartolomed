import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ReportFormat, ReportType } from '../entities/asset-report.entity';

export class GenerateReportDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ReportType)
  type: ReportType;

  @IsEnum(ReportFormat)
  format: ReportFormat;

  // AssetReport.date es NOT NULL sin default — antes se dependía de que el
  // cliente lo mandara "por las dudas"; con @Body() data: any nunca se
  // validaba y el INSERT reventaba con un 500 de Postgres si faltaba.
  @IsDateString()
  date: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsOptional()
  parameters?: any;

  @IsOptional()
  filters?: any;
}
