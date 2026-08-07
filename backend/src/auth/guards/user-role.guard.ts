import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { User } from '../../users/entities/user.entity';
import { META_ROLES } from '../decorators/role-protected.decorator';
import { ValidRoles } from '../interfaces';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const validRoles: ValidRoles[] =
      this.reflector.getAllAndOverride<ValidRoles[]>(META_ROLES, [context.getHandler(), context.getClass()]) || [];

    if (validRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as User;

    if (!user) throw new BadRequestException('User not found (request)');

    // SUPER_ADMIN siempre pasa, sin importar los roles requeridos
    if (user.roles?.includes(ValidRoles.SUPER_ADMIN)) return true;

    for (const role of user.roles) {
      if (validRoles.includes(role as ValidRoles)) return true;
    }

    throw new ForbiddenException(`You do not have the required role. Required: ${validRoles.join(', ')}`);
  }
}
