import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ValidRoles } from '../../users/interfaces';
import { Permission } from './permissions.enum';
import { PermissionsGuard } from './permissions.guard';

const buildContext = (user: { roles?: string[] } | undefined): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

describe('PermissionsGuard', () => {
  let reflector: Reflector;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('pasa si el handler no declara permisos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = buildContext({ roles: [ValidRoles.DOCTOR] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('pasa si el array de permisos requeridos está vacío', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const ctx = buildContext({ roles: [ValidRoles.DOCTOR] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rechaza si no hay user', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.PatientsRead]);
    const ctx = buildContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rechaza si user no tiene roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.PatientsRead]);
    const ctx = buildContext({ roles: [] });
    expect(() => guard.canActivate(ctx)).toThrow(/Falta información de usuario o roles/);
  });

  it('SUPER_ADMIN tiene todos los permisos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.SettingsManage]);
    const ctx = buildContext({ roles: [ValidRoles.SUPER_ADMIN] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('DOCTOR puede leer pacientes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.PatientsRead]);
    const ctx = buildContext({ roles: [ValidRoles.DOCTOR] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('DOCTOR no puede gestionar usuarios', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.UsersManage]);
    const ctx = buildContext({ roles: [ValidRoles.DOCTOR] });
    expect(() => guard.canActivate(ctx)).toThrow(/permisos necesarios/);
  });

  it('match parcial: basta uno de los permisos requeridos', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.UsersManage, Permission.PatientsRead]);
    const ctx = buildContext({ roles: [ValidRoles.DOCTOR] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('multi-rol: union de permisos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.BillingManage]);
    const ctx = buildContext({ roles: [ValidRoles.DOCTOR, ValidRoles.ADMIN] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rol desconocido no concede permisos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.PatientsRead]);
    const ctx = buildContext({ roles: ['UNKNOWN_ROLE'] });
    expect(() => guard.canActivate(ctx)).toThrow(/permisos necesarios/);
  });
});
