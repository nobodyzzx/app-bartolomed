import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Auth, AuthClinic, GetUser } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { CreatePrescriptionDto, UpdatePrescriptionDto } from './dto';
import { PrescriptionStatus } from './entities/prescription.entity';
import { PrescriptionsService } from './prescriptions.service';

@Controller('prescriptions')
@AuthClinic()
@RequirePermissions(Permission.PrescriptionsRead, Permission.PrescriptionsSign)
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  create(@Body() createDto: CreatePrescriptionDto, @GetUser() user: User, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.prescriptionsService.create(createDto, user, clinicId);
  }

  @Get()
  findAll(@Req() req: Request, @Query('page') page?: number, @Query('pageSize') pageSize?: number, @Query() query?: any) {
    const clinicId = resolveClinicId(req);
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 20;
    const filter = { ...query };
    delete filter.page;
    delete filter.pageSize;
    return this.prescriptionsService.findAll(p, ps, filter, clinicId);
  }

  // QR endpoint removed — QR generation was removed from the project by request.

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.prescriptionsService.findOne(id, clinicId);
  }

  @Patch(':id')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePrescriptionDto,
    @Req() req: Request,
  ) {
    const clinicId = resolveClinicId(req);
    return this.prescriptionsService.update(id, updateDto, clinicId);
  }

  @Patch(':id/status')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: PrescriptionStatus,
    @Req() req: Request,
    @GetUser() user: User,
  ) {
    const clinicId = resolveClinicId(req);
    return this.prescriptionsService.setStatus(id, status, clinicId, user);
  }

  @Post(':id/sign')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  @RequirePermissions(Permission.PrescriptionsSign)
  sign(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @GetUser() user: User) {
    const clinicId = resolveClinicId(req);
    return this.prescriptionsService.sign(id, clinicId, user);
  }

  @Post(':id/refill')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  refill(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.prescriptionsService.refill(id, clinicId);
  }
}
