import { Controller, Get, Query } from '@nestjs/common';
import { Auth } from '../auth/decorators';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { AuditService } from './audit.service';
import { FilterAuditDto } from './dto/filter-audit.dto';

@Controller('audit')
@Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
@RequirePermissions(Permission.AuditRead)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(@Query() filter: FilterAuditDto) {
    return this.auditService.findAll(filter);
  }

  @Get('stats')
  getStats() {
    return this.auditService.getStats();
  }

  @Get('filters')
  getDistinctValues() {
    return this.auditService.getDistinctValues();
  }
}
