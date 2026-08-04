import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { TypstCompilerService } from './typst-compiler.service';
import { ChartRasterizerService } from './chart-rasterizer.service';

@Module({
  imports: [MetricsModule],
  providers: [TypstCompilerService, ChartRasterizerService],
  exports: [TypstCompilerService, ChartRasterizerService],
})
export class PdfModule {}
