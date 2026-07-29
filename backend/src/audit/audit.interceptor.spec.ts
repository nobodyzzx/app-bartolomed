import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

type MockRequest = {
  method: string;
  path: string;
  ip: string;
  headers: Record<string, string>;
  user?: { id?: string; email?: string; personalInfo?: { firstName?: string; lastName?: string } };
};

const buildRequest = (overrides: Partial<MockRequest> = {}): MockRequest => ({
  method: 'GET',
  path: '/api/patients',
  ip: '10.0.0.5',
  headers: {},
  ...overrides,
});

const buildContext = (req: MockRequest, statusCode = 200, type: 'http' | 'rpc' = 'http'): ExecutionContext =>
  ({
    getType: () => type,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({ statusCode }),
    }),
  }) as unknown as ExecutionContext;

const buildHandler = (result: unknown = { ok: true }): CallHandler => ({
  handle: jest.fn().mockReturnValue(of(result)),
});

const buildErrorHandler = (error: unknown): CallHandler => ({
  handle: jest.fn().mockReturnValue(throwError(() => error)),
});

describe('AuditInterceptor', () => {
  let auditService: jest.Mocked<AuditService>;
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    auditService = { log: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditService>;
    interceptor = new AuditInterceptor(auditService);
  });

  describe('filtrado de qué se audita', () => {
    it('deja pasar sin auditar si el contexto no es http', async () => {
      const ctx = buildContext(buildRequest(), 200, 'rpc');
      const handler = buildHandler();

      await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('deja pasar sin auditar un GET no sensible', async () => {
      const req = buildRequest({ method: 'GET', path: '/api/reports/summary' });
      const ctx = buildContext(req);
      const handler = buildHandler();

      await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('ignora paths en skipPaths aunque sean mutaciones (ej. /api/audit)', async () => {
      const req = buildRequest({ method: 'DELETE', path: '/api/audit/1' });
      const ctx = buildContext(req);
      const handler = buildHandler();

      await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('ignora /api/health', async () => {
      const req = buildRequest({ method: 'GET', path: '/api/health' });
      const ctx = buildContext(req);
      const handler = buildHandler();

      await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('audita un GET sobre un recurso sensible (VIEW)', async () => {
      const req = buildRequest({ method: 'GET', path: '/api/patients/abc' });
      const ctx = buildContext(req);
      const handler = buildHandler();

      await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'VIEW' }));
    });

    it('audita cualquier mutación aunque el recurso no sea "sensible"', async () => {
      const req = buildRequest({ method: 'POST', path: '/api/roles' });
      const ctx = buildContext(req, 201);
      const handler = buildHandler();

      await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', resource: 'Roles' }));
    });

    it('audita endpoints de /api/auth aunque sean GET', async () => {
      const req = buildRequest({ method: 'POST', path: '/api/auth/login' });
      const ctx = buildContext(req);
      const handler = buildHandler();

      await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN', resource: 'Autenticación' }),
      );
    });
  });

  describe('construcción de la entrada de auditoría', () => {
    it('usa x-forwarded-for (primer valor) como ipAddress si está presente', async () => {
      const req = buildRequest({
        method: 'POST',
        path: '/api/patients',
        ip: '10.0.0.5',
        headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
      });
      const ctx = buildContext(req, 201);
      const handler = buildHandler();

      await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: '203.0.113.9' }));
    });

    it('cae al ip del request si no hay x-forwarded-for', async () => {
      const req = buildRequest({ method: 'POST', path: '/api/patients', ip: '10.0.0.5', headers: {} });
      const ctx = buildContext(req, 201);
      const handler = buildHandler();

      await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: '10.0.0.5' }));
    });

    it('toma clinicId del header x-clinic-id', async () => {
      const req = buildRequest({
        method: 'POST',
        path: '/api/patients',
        headers: { 'x-clinic-id': 'clinic-9' },
      });
      const ctx = buildContext(req, 201);
      const handler = buildHandler();

      await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ clinicId: 'clinic-9' }));
    });

    it('arma userName solo si personalInfo trae firstName y lastName', async () => {
      const req = buildRequest({
        method: 'POST',
        path: '/api/patients',
        user: { id: 'u1', email: 'doc@example.com', personalInfo: { firstName: 'Ana', lastName: 'Perez' } },
      });
      const ctx = buildContext(req, 201);
      const handler = buildHandler();

      await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', userEmail: 'doc@example.com', userName: 'Ana Perez' }),
      );
    });

    it('deja userName undefined si falta el user o su personalInfo', async () => {
      const req = buildRequest({ method: 'POST', path: '/api/patients', user: { id: 'u1' } });
      const ctx = buildContext(req, 201);
      const handler = buildHandler();

      await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ userName: undefined }));
    });

    it('marca status success cuando statusCode < 400', async () => {
      const req = buildRequest({ method: 'POST', path: '/api/patients' });
      const ctx = buildContext(req, 201);
      const handler = buildHandler();

      await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', statusCode: 201 }));
    });
  });

  describe('manejo de errores', () => {
    it('audita como failure y re-lanza el error original', async () => {
      const req = buildRequest({ method: 'POST', path: '/api/patients' });
      const ctx = buildContext(req);
      const error = { status: 409, message: 'Conflict' };
      const handler = buildErrorHandler(error);

      await expect(lastValueFrom(interceptor.intercept(ctx, handler) as any)).rejects.toBe(error);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failure',
          statusCode: 409,
          details: expect.objectContaining({ error: 'Conflict' }),
        }),
      );
    });

    it('usa statusCode 500 si el error no trae status', async () => {
      const req = buildRequest({ method: 'POST', path: '/api/patients' });
      const ctx = buildContext(req);
      const error = { message: 'boom' };
      const handler = buildErrorHandler(error);

      await expect(lastValueFrom(interceptor.intercept(ctx, handler) as any)).rejects.toBe(error);

      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }));
    });

    it('no rompe el flujo si auditService.log() rechaza (queda silenciado)', async () => {
      auditService.log.mockRejectedValueOnce(new Error('db down'));
      const req = buildRequest({ method: 'POST', path: '/api/patients' });
      const ctx = buildContext(req, 201);
      const handler = buildHandler({ id: '1' });

      const result = await lastValueFrom(interceptor.intercept(ctx, handler) as any);

      expect(result).toEqual({ id: '1' });
    });
  });

  describe('mapAction', () => {
    const mapAction = (method: string, path: string) => (interceptor as any).mapAction(method, path);

    it('reconoce acciones especiales por path', () => {
      expect(mapAction('POST', '/api/auth/login')).toBe('LOGIN');
      expect(mapAction('POST', '/api/auth/logout')).toBe('LOGOUT');
      expect(mapAction('POST', '/api/auth/refresh')).toBe('REFRESH');
      expect(mapAction('POST', '/api/billing/1/adjust-payment')).toBe('PAYMENT_ADJUSTED');
      expect(mapAction('PATCH', '/api/appointments/1/status')).toBe('STATUS_CHANGED');
      expect(mapAction('PATCH', '/api/billing/1/cancel')).toBe('CANCELLED');
    });

    it('usa el mapa estándar por método HTTP', () => {
      expect(mapAction('POST', '/api/patients')).toBe('CREATE');
      expect(mapAction('PATCH', '/api/patients')).toBe('UPDATE');
      expect(mapAction('PUT', '/api/patients')).toBe('UPDATE');
      expect(mapAction('DELETE', '/api/patients')).toBe('DELETE');
      expect(mapAction('GET', '/api/patients')).toBe('VIEW');
    });

    it('devuelve el método tal cual si no está en el mapa', () => {
      expect(mapAction('OPTIONS', '/api/patients')).toBe('OPTIONS');
    });
  });

  describe('mapResource', () => {
    const mapResource = (path: string) => (interceptor as any).mapResource(path);

    it('resuelve recursos compuestos de farmacia antes que el genérico', () => {
      expect(mapResource('/api/pharmacy-sales')).toBe('Farmacia — Ventas');
      expect(mapResource('/api/pharmacy/invoices')).toBe('Farmacia — Facturas');
      expect(mapResource('/api/pharmacy/sales')).toBe('Farmacia — Ventas');
      expect(mapResource('/api/pharmacy/inventory')).toBe('Farmacia — Inventario');
      expect(mapResource('/api/pharmacy/purchase-orders')).toBe('Farmacia — Órdenes de Compra');
      expect(mapResource('/api/medical-records/1')).toBe('Historial Médico');
      expect(mapResource('/api/asset-transfers/1')).toBe('Traslados de Activos');
    });

    it('resuelve recursos simples por el primer segmento', () => {
      expect(mapResource('/api/patients/1')).toBe('Pacientes');
      expect(mapResource('/api/appointments')).toBe('Citas');
      expect(mapResource('/api/billing/1')).toBe('Facturación');
      expect(mapResource('/api/auth/login')).toBe('Autenticación');
      expect(mapResource('/api/users/1')).toBe('Usuarios');
      expect(mapResource('/api/clinics/1')).toBe('Clínicas');
      expect(mapResource('/api/assets/1')).toBe('Activos');
      expect(mapResource('/api/roles')).toBe('Roles');
      expect(mapResource('/api/transfers/1')).toBe('Traslados de Stock');
      expect(mapResource('/api/reports/summary')).toBe('Reportes');
      expect(mapResource('/api/seed/reset')).toBe('Seeds');
    });

    it('devuelve el segmento tal cual si no está en el mapa', () => {
      expect(mapResource('/api/algo-nuevo/1')).toBe('algo-nuevo');
    });
  });

  describe('extractResourceId', () => {
    const extractResourceId = (path: string) => (interceptor as any).extractResourceId(path);

    it('extrae el UUID del path si está presente', () => {
      expect(extractResourceId('/api/patients/550e8400-e29b-41d4-a716-446655440000')).toBe(
        '550e8400-e29b-41d4-a716-446655440000',
      );
    });

    it('devuelve undefined si el path no contiene un UUID', () => {
      expect(extractResourceId('/api/patients')).toBeUndefined();
    });
  });
});
