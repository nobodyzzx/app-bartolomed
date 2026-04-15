import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  /** Rutas que no generan entradas de auditoría */
  private readonly skipPaths = ['/api/health', '/api/docs', '/api/audit', '/api/favicon'];

  /** Solo se loguean mutaciones y endpoints de autenticación */
  private readonly loggedMethods = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

  /** GETs sobre recursos sensibles que también se auditan como VIEW */
  private readonly sensitiveGetPrefixes = [
    '/api/patients',
    '/api/medical-records',
    '/api/prescriptions',
    '/api/pharmacy/sales',
    '/api/pharmacy/invoices',
    '/api/invoices',
    '/api/assets',
    '/api/users',
  ];

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const { method, path, headers } = req as {
      method: string;
      path: string;
      ip: string;
      headers: Record<string, string>;
      user?: { id?: string; email?: string; personalInfo?: { firstName?: string; lastName?: string } };
    };

    const isAuthPath = (path as string).startsWith('/api/auth');
    const isMutation = this.loggedMethods.has(method);
    const isSensitiveGet = method === 'GET' && this.sensitiveGetPrefixes.some(p => (path as string).startsWith(p));

    if (!isMutation && !isAuthPath && !isSensitiveGet) return next.handle();
    if (this.skipPaths.some(p => (path as string).startsWith(p))) return next.handle();

    const ipAddress =
      ((headers['x-forwarded-for'] as string) ?? '').split(',')[0].trim() || (req as { ip: string }).ip;
    const clinicId = headers['x-clinic-id'];
    const startTime = Date.now();

    const buildEntry = (statusCode: number, extra?: Record<string, unknown>) => {
      const user = (req as { user?: { id?: string; email?: string; personalInfo?: { firstName?: string; lastName?: string } } }).user;
      const userName =
        user?.personalInfo?.firstName && user?.personalInfo?.lastName
          ? `${user.personalInfo.firstName} ${user.personalInfo.lastName}`
          : undefined;

      return {
        action: this.mapAction(method, path),
        resource: this.mapResource(path),
        resourceId: this.extractResourceId(path),
        userId: user?.id,
        userEmail: user?.email,
        userName,
        clinicId,
        ipAddress,
        method,
        path,
        statusCode,
        status: statusCode < 400 ? 'success' : 'failure',
        details: { responseTime: Date.now() - startTime, ...extra },
      };
    };

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        this.auditService.log(buildEntry((res as { statusCode: number }).statusCode)).catch(() => {});
      }),
      catchError((error: { status?: number; message?: string }) => {
        this.auditService.log(buildEntry(error.status ?? 500, { error: error.message })).catch(() => {});
        return throwError(() => error);
      }),
    );
  }

  private mapAction(method: string, path: string): string {
    if (path.includes('/auth/login')) return 'LOGIN';
    if (path.includes('/auth/logout')) return 'LOGOUT';
    if (path.includes('/auth/refresh')) return 'REFRESH';
    if (path.includes('/adjust-payment')) return 'PAYMENT_ADJUSTED';
    if (path.includes('/status') && method === 'PATCH') return 'STATUS_CHANGED';
    if (path.includes('/cancel') && method === 'PATCH') return 'CANCELLED';
    const map: Record<string, string> = {
      POST: 'CREATE',
      PATCH: 'UPDATE',
      PUT: 'UPDATE',
      DELETE: 'DELETE',
      GET: 'VIEW',
    };
    return map[method] ?? method;
  }

  private mapResource(path: string): string {
    const stripped = path.replace('/api/', '');
    // Recursos compuestos más específicos primero
    if (stripped.startsWith('pharmacy-sales')) return 'Farmacia — Ventas';
    if (stripped.startsWith('pharmacy/invoices')) return 'Farmacia — Facturas';
    if (stripped.startsWith('pharmacy/sales')) return 'Farmacia — Ventas';
    if (stripped.startsWith('pharmacy/inventory')) return 'Farmacia — Inventario';
    if (stripped.startsWith('pharmacy/purchase-orders')) return 'Farmacia — Órdenes de Compra';
    if (stripped.startsWith('medical-records')) return 'Historial Médico';
    if (stripped.startsWith('asset-transfers')) return 'Traslados de Activos';

    const segment = stripped.split('/')[0] ?? '';
    const map: Record<string, string> = {
      patients: 'Pacientes',
      appointments: 'Citas',
      billing: 'Facturación',
      pharmacy: 'Farmacia',
      prescriptions: 'Recetas',
      auth: 'Autenticación',
      users: 'Usuarios',
      clinics: 'Clínicas',
      assets: 'Activos',
      roles: 'Roles',
      transfers: 'Traslados de Stock',
      reports: 'Reportes',
      seed: 'Seeds',
    };
    return map[segment] ?? segment ?? 'Sistema';
  }

  private extractResourceId(path: string): string | undefined {
    const match = path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return match?.[0];
  }
}
