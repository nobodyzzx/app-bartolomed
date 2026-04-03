import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { UserClinic } from '../../users/entities/user-clinic.entity';
import { User } from '../../users/entities/user.entity';
import { ValidRoles } from '../../users/interfaces';
import { META_CLINIC_ROLES, resolveClinicId } from '../decorators/clinic-roles.decorator';

@Injectable()
export class ClinicScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as User & { clinicIds?: string[] };
    if (!user) throw new ForbiddenException('No user in request');

    // SUPER_ADMIN siempre puede pasar
    if (user.roles?.includes(ValidRoles.SUPER_ADMIN)) return true;

    const clinicId = resolveClinicId(req);
    if (!clinicId) throw new ForbiddenException('clinicId is required (param or header x-clinic-id)');

    // Validar membresía usando clinicIds del JWT (sin DB lookup)
    const clinicIds = user.clinicIds ?? [];
    const isMember = clinicIds.includes(clinicId);

    if (!isMember) {
      // Fallback: si el token es antiguo (pre-clinicIds), verificar contra DB
      if (clinicIds.length === 0) {
        const membership = await this.dataSource.getRepository(UserClinic).findOne({
          where: { clinic: { id: clinicId }, user: { id: user.id } },
          relations: ['clinic', 'user'],
        });
        if (!membership) throw new ForbiddenException('User is not member of this clinic');

        const requiredClinicRoles =
          this.reflector.getAllAndOverride<string[]>(META_CLINIC_ROLES, [context.getHandler(), context.getClass()]) || [];
        if (requiredClinicRoles.length === 0) return true;
        const hasRole = membership.roles.some(r => requiredClinicRoles.includes(r));
        if (!hasRole) throw new ForbiddenException(`User lacks required clinic roles: ${requiredClinicRoles.join(', ')}`);
        return true;
      }
      throw new ForbiddenException('User is not member of this clinic');
    }

    // Con clinicIds en el token: verificar roles de clínica sólo si se requieren
    const requiredClinicRoles =
      this.reflector.getAllAndOverride<string[]>(META_CLINIC_ROLES, [context.getHandler(), context.getClass()]) || [];

    if (requiredClinicRoles.length === 0) return true;

    // Roles de clínica específicos: consulta puntual sólo cuando es necesario
    const membership = await this.dataSource.getRepository(UserClinic).findOne({
      where: { clinic: { id: clinicId }, user: { id: user.id } },
    });
    if (!membership) throw new ForbiddenException('User is not member of this clinic');
    const hasRole = membership.roles.some(r => requiredClinicRoles.includes(r));
    if (!hasRole) throw new ForbiddenException(`User lacks required clinic roles: ${requiredClinicRoles.join(', ')}`);

    return true;
  }
}
