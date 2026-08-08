import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { META_PERMISSIONS } from './permissions.decorator';
import { Permission } from './permissions.enum';
import { permissionsForRoles } from './role-permissions.map';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { roles?: string[] } | undefined;

    const required =
      this.reflector.getAllAndOverride<Permission[]>(META_PERMISSIONS, [context.getHandler(), context.getClass()]) ||
      [];

    if (!required || required.length === 0) return true;
    if (!user || !user.roles || user.roles.length === 0)
      throw new ForbiddenException('Falta información de usuario o roles para verificar los permisos.');

    const userPerms = new Set(permissionsForRoles(user.roles));
    const ok = required.some((p: Permission) => userPerms.has(p));

    if (!ok) {
      throw new ForbiddenException('No cuentas con los permisos necesarios para realizar esta acción.');
    }
    return true;
  }
}
