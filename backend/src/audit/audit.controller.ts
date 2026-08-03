import { Controller, Get, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthClinic, GetUser } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { AuditService } from './audit.service';
import { FilterAuditDto } from './dto/filter-audit.dto';

// Bug real (fuga cross-clínica): antes solo @Auth(ADMIN, SUPER_ADMIN), sin
// scoping por clínica — un ADMIN de cualquier clínica podía ver logs de
// auditoría (accesos a pacientes, historiales, recetas, IPs) de TODAS las
// demás. @AuthClinic monta ClinicScopeGuard; el scoping fino (SUPER_ADMIN ve
// todo el sistema, ADMIN solo su clínica activa) vive en AuditService.
@Controller('audit')
@AuthClinic({ roles: [ValidRoles.ADMIN] })
@RequirePermissions(Permission.AuditRead)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(@Query() filter: FilterAuditDto, @GetUser() actor: User, @Req() req: Request) {
    return this.auditService.findAll(filter, actor, resolveClinicId(req)!);
  }

  @Get('stats')
  getStats(
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @GetUser() actor: User,
    @Req() req: Request,
  ) {
    return this.auditService.getStats(startDate, endDate, actor, resolveClinicId(req)!);
  }

  @Get('activity')
  getDailyActivity(
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @GetUser() actor: User,
    @Req() req: Request,
  ) {
    return this.auditService.getDailyActivity(startDate, endDate, actor, resolveClinicId(req)!);
  }

  @Get('filters')
  getDistinctValues(@GetUser() actor: User, @Req() req: Request) {
    return this.auditService.getDistinctValues(actor, resolveClinicId(req)!);
  }
}
