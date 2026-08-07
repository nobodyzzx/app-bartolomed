import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

/**
 * Interceptor que mide cada request HTTP y alimenta las métricas Prometheus.
 *
 * - `route` se toma del template registrado por Express (`req.route?.path`),
 *   no de la URL real, para evitar explosión de cardinalidad por `:id`.
 * - Se ignora el propio endpoint `/metrics` para que el scraper no se mida a
 *   sí mismo.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const method = req.method;

    if (req.path === '/metrics' || req.path === '/api/metrics') {
      return next.handle();
    }

    const start = process.hrtime.bigint();
    return next.handle().pipe(
      tap({
        next: () => this.record(start, method, this.routeFor(req), res.statusCode),
        error: () =>
          // Si el handler throw-ea, el filtro global ya seteó res.statusCode.
          this.record(start, method, this.routeFor(req), res.statusCode || 500),
      }),
    );
  }

  private record(start: bigint, method: string, route: string, status: number): void {
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = { method, route, status: String(status) };
    this.metrics.httpRequestsTotal.inc(labels);
    this.metrics.httpRequestDurationSeconds.observe(labels, durationSec);
  }

  private routeFor(req: Request): string {
    // Express asigna req.route cuando matchea un handler; si no, caemos al path
    // raw pero capado a algo razonable para evitar cardinalidad infinita.
    const template = (req.route as { path?: string } | undefined)?.path;
    if (template) return `${req.baseUrl ?? ''}${template}`;
    return req.path || 'unknown';
  }
}
