import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';

import { Clinic } from '../../clinics/entities/clinic.entity';
import { ValidRoles } from '../../users/interfaces';
import { ClinicScopeGuard } from './clinic-scope.guard';

type MockUser = {
  id: string;
  roles?: string[];
  clinicIds?: string[];
};

const buildContext = (req: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

const buildRequest = (user: MockUser | undefined, clinicId?: string) => ({
  user,
  params: {},
  headers: clinicId ? { 'x-clinic-id': clinicId } : {},
});

describe('ClinicScopeGuard', () => {
  const CLINIC_A = 'clinic-a-uuid';
  const CLINIC_B = 'clinic-b-uuid';
  const USER_ID = 'user-1';

  let reflector: Reflector;
  let dataSource: jest.Mocked<DataSource>;
  let userClinicRepo: { findOne: jest.Mock };
  let clinicRepo: { findOne: jest.Mock };
  let guard: ClinicScopeGuard;

  beforeEach(() => {
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    userClinicRepo = { findOne: jest.fn() };
    // Activa por defecto: la mayoría de los tests no le importa el estado de
    // la clínica, sólo membresía/roles — los que sí lo prueban lo sobrescriben.
    clinicRepo = { findOne: jest.fn().mockResolvedValue({ id: CLINIC_A, isActive: true }) };
    dataSource = {
      getRepository: jest.fn((entity: unknown) => (entity === Clinic ? clinicRepo : userClinicRepo)),
    } as unknown as jest.Mocked<DataSource>;

    guard = new ClinicScopeGuard(reflector, dataSource);
  });

  it('rechaza si no hay user en el request', async () => {
    const ctx = buildContext(buildRequest(undefined, CLINIC_A));
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('SUPER_ADMIN siempre pasa, incluso sin clinicId', async () => {
    const user: MockUser = { id: USER_ID, roles: [ValidRoles.SUPER_ADMIN] };
    const ctx = buildContext(buildRequest(user));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(userClinicRepo.findOne).not.toHaveBeenCalled();
  });

  it('rechaza si no se puede resolver clinicId', async () => {
    const user: MockUser = { id: USER_ID, roles: [ValidRoles.DOCTOR], clinicIds: [CLINIC_A] };
    const ctx = buildContext(buildRequest(user));
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Falta la clínica/);
  });

  it('rechaza cross-tenant: clinicIds del JWT no incluye el clinic solicitado', async () => {
    const user: MockUser = { id: USER_ID, roles: [ValidRoles.DOCTOR], clinicIds: [CLINIC_A] };
    const ctx = buildContext(buildRequest(user, CLINIC_B));
    await expect(guard.canActivate(ctx)).rejects.toThrow(/no pertenece a esta clínica/);
    expect(userClinicRepo.findOne).not.toHaveBeenCalled();
  });

  it('acepta si clinicIds del JWT incluye el clinic solicitado', async () => {
    const user: MockUser = { id: USER_ID, roles: [ValidRoles.DOCTOR], clinicIds: [CLINIC_A, CLINIC_B] };
    const ctx = buildContext(buildRequest(user, CLINIC_A));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('fallback DB: token antiguo sin clinicIds → consulta UserClinic', async () => {
    userClinicRepo.findOne.mockResolvedValue({ roles: ['DOCTOR'] });
    const user: MockUser = { id: USER_ID, roles: [ValidRoles.DOCTOR], clinicIds: [] };
    const ctx = buildContext(buildRequest(user, CLINIC_A));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(userClinicRepo.findOne).toHaveBeenCalledWith({
      where: { clinic: { id: CLINIC_A }, user: { id: USER_ID } },
      relations: ['clinic', 'user'],
    });
  });

  it('fallback DB: rechaza si no hay membership', async () => {
    userClinicRepo.findOne.mockResolvedValue(null);
    const user: MockUser = { id: USER_ID, roles: [ValidRoles.DOCTOR], clinicIds: [] };
    const ctx = buildContext(buildRequest(user, CLINIC_A));
    await expect(guard.canActivate(ctx)).rejects.toThrow(/no pertenece a esta clínica/);
  });

  it('exige roles de clínica si el handler los marca', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN_CLINIC']);
    userClinicRepo.findOne.mockResolvedValue({ roles: ['DOCTOR'] });
    const user: MockUser = { id: USER_ID, roles: [ValidRoles.DOCTOR], clinicIds: [CLINIC_A] };
    const ctx = buildContext(buildRequest(user, CLINIC_A));
    await expect(guard.canActivate(ctx)).rejects.toThrow(/lacks required clinic roles/);
  });

  it('acepta si el rol de clínica coincide', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN_CLINIC']);
    userClinicRepo.findOne.mockResolvedValue({ roles: ['ADMIN_CLINIC'] });
    const user: MockUser = { id: USER_ID, roles: [ValidRoles.DOCTOR], clinicIds: [CLINIC_A] };
    const ctx = buildContext(buildRequest(user, CLINIC_A));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // Bug real: desactivar una clínica no revocaba sesiones ya autenticadas —
  // el guard solo validaba membresía, nunca isActive de la clínica en sí.
  it('rechaza si la clínica ya no está activa', async () => {
    clinicRepo.findOne.mockResolvedValue({ id: CLINIC_A, isActive: false });
    const user: MockUser = { id: USER_ID, roles: [ValidRoles.DOCTOR], clinicIds: [CLINIC_A] };
    const ctx = buildContext(buildRequest(user, CLINIC_A));
    await expect(guard.canActivate(ctx)).rejects.toThrow(/no está activa/);
    expect(userClinicRepo.findOne).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN pasa aunque la clínica esté inactiva (necesita reactivarla)', async () => {
    clinicRepo.findOne.mockResolvedValue({ id: CLINIC_A, isActive: false });
    const user: MockUser = { id: USER_ID, roles: [ValidRoles.SUPER_ADMIN] };
    const ctx = buildContext(buildRequest(user, CLINIC_A));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(clinicRepo.findOne).not.toHaveBeenCalled();
  });

  it('resuelve clinicId desde param de ruta', async () => {
    const user: MockUser = { id: USER_ID, roles: [ValidRoles.DOCTOR], clinicIds: [CLINIC_A] };
    const ctx = buildContext({ user, params: { clinicId: CLINIC_A }, headers: {} });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('NO acepta clinicId vía query string (vector cross-tenant)', async () => {
    const user: MockUser = { id: USER_ID, roles: [ValidRoles.DOCTOR], clinicIds: [CLINIC_A] };
    const ctx = buildContext({ user, params: {}, headers: {}, query: { clinicId: CLINIC_A } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Falta la clínica/);
  });
});
