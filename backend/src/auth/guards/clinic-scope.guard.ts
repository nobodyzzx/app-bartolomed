import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserClinic } from '../../users/entities/user-clinic.entity';
import { User } from '../../users/entities/user.entity';
import { ValidRoles } from '../../users/interfaces';
import { META_CLINIC_ROLES, resolveClinicId } from '../decorators/clinic-roles.decorator';

@Injectable()
export class ClinicScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(UserClinic)
    private readonly userClinicRepo: Repository<UserClinic>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as User;
    if (!user) throw new ForbiddenException('No user in request');

    // SUPER_ADMIN siempre puede pasar
    if (user.roles?.includes(ValidRoles.SUPER_ADMIN)) return true;

    const clinicId = resolveClinicId(req);
    if (!clinicId) throw new ForbiddenException('clinicId is required (param, header x-clinic-id, or query)');

    const requiredClinicRoles =
      this.reflector.getAllAndOverride<string[]>(META_CLINIC_ROLES, [context.getHandler(), context.getClass()]) || [];

    const membership = await this.userClinicRepo.findOne({
      where: { clinic: { id: clinicId }, user: { id: user.id } },
      relations: ['clinic', 'user'],
    });

    if (!membership) throw new ForbiddenException('User is not member of this clinic');

    if (requiredClinicRoles.length === 0) return true; // sólo pertenencia

    const hasRole = membership.roles.some(r => requiredClinicRoles.includes(r));
    if (!hasRole) throw new ForbiddenException(`User lacks required clinic roles: ${requiredClinicRoles.join(', ')}`);

    return true;
  }
}
