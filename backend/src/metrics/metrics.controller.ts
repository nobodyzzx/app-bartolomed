import { Controller, Get, Header, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/decorators';
import { MetricsService } from './metrics.service';

/**
 * Endpoint Prometheus. Sin autenticación: típicamente lo scrapea el agente
 * Prometheus desde la red interna. En producción, restringir el acceso a
 * nivel de Traefik / firewall si el host es público.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async getMetrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', this.metrics.contentType());
    res.send(await this.metrics.metrics());
  }
}
