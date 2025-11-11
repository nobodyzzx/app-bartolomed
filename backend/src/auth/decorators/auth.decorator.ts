import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserRoleGuard } from '../guards/user-role.guard';
import { ValidRoles } from '../interfaces';
import { RoleProtected } from './role-protected.decorator';

export function Auth(...roles: ValidRoles[]) {
  // Use JwtAuthGuard to respect @Public() metadata and allow public routes to bypass auth
  return applyDecorators(RoleProtected(...roles), UseGuards(JwtAuthGuard, UserRoleGuard));
}
