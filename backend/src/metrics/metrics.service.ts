import { Injectable, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

/**
 * Servicio de métricas Prometheus.
 *
 * Mantiene un registro propio (no usa `register` global) para que la suite de
 * tests pueda inicializar varias instancias sin colisionar.
 *
 * Métricas expuestas:
 *  - `bartolomed_http_requests_total` (Counter, labels: method/route/status)
 *  - `bartolomed_http_request_duration_seconds` (Histogram, labels: method/route/status)
 *  - `bartolomed_pdf_generated_total` (Counter, labels: status) — incrementado
 *    por `TypstCompilerService.compile()`, el único punto de compilación
 *    compartido por los 25 documentos (22 reportes + receta + 2 expedientes
 *    médicos) desde el cierre de la migración Puppeteer→Typst (Fase 1-3).
 *    Antes de esta migración no existía ningún dato de volumen real de
 *    generación de PDF en el proyecto.
 *  - `bartolomed_pdf_compile_duration_seconds` (Histogram) — duración de
 *    `typst compile` en sí (sin incluir el rasterizado previo de gráficos).
 *  - Métricas de Node por defecto (CPU, memoria, GC, event loop lag) vía
 *    `collectDefaultMetrics`.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestsTotal = new Counter({
    name: 'bartolomed_http_requests_total',
    help: 'Total de requests HTTP procesadas por la API',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  readonly httpRequestDurationSeconds = new Histogram({
    name: 'bartolomed_http_request_duration_seconds',
    help: 'Duración (segundos) de cada request HTTP',
    labelNames: ['method', 'route', 'status'] as const,
    // Buckets pensados para una API REST normal: la mayoría < 250ms.
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly pdfGeneratedTotal = new Counter({
    name: 'bartolomed_pdf_generated_total',
    help: 'Total de documentos PDF compilados con Typst, por resultado',
    labelNames: ['status'] as const,
    registers: [this.registry],
  });

  readonly pdfCompileDurationSeconds = new Histogram({
    name: 'bartolomed_pdf_compile_duration_seconds',
    help: 'Duración (segundos) de `typst compile` — no incluye el rasterizado previo de gráficos',
    // Buckets ajustados a lo medido en los pilotos de la migración
    // (~77-100ms típico, sin browser de por medio).
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  onModuleInit(): void {
    this.registry.setDefaultLabels({ app: 'bartolomed-api' });
    collectDefaultMetrics({ register: this.registry });
  }

  /** Output `text/plain` listo para servir desde el controller. */
  async metrics(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
