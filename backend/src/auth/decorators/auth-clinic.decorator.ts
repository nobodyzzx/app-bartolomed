import { applyDecorators, UseGuards } from '@nestjs/common';
import { ClinicScopeGuard } from '../guards/clinic-scope.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserRoleGuard } from '../guards/user-role.guard';
import { ValidRoles } from '../interfaces';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { ClinicRoles } from './clinic-roles.decorator';
import { RoleProtected } from './role-protected.decorator';

interface AuthClinicOptions {
  roles?: ValidRoles[];
  clinicRoles?: string[];
}

export function AuthClinic(options: AuthClinicOptions = {}) {
  const { roles = [], clinicRoles = [] } = options;

  const decorators = [
    RoleProtected(...roles),
    UseGuards(JwtAuthGuard, UserRoleGuard, PermissionsGuard, ClinicScopeGuard),
  ];

  if (clinicRoles.length > 0) {
    decorators.unshift(ClinicRoles(...clinicRoles));
  }

  return applyDecorators(...decorators);
}
