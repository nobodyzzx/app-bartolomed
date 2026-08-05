import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Auth, AuthClinic, GetUser } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { Patient } from '../patients/entities/patient.entity';
import { OptionalActivePatientPipe } from '../patients/pipes/optional-active-patient.pipe';
import { User } from '../users/entities/user.entity';
import { CreateLabOrderDto, UpdateLabOrderDto, EnterLabResultDto } from './dto';
import { LabOrderStatus } from './entities/lab-order.entity';
import { LabOrdersService } from './lab-orders.service';

@Controller('lab-orders')
@AuthClinic()
@RequirePermissions(Permission.LabRead, Permission.LabOrder, Permission.LabResultEnter)
export class LabOrdersController {
  constructor(private readonly labOrdersService: LabOrdersService) {}

  @Post()
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  @RequirePermissions(Permission.LabOrder)
  create(
    @Body() createDto: CreateLabOrderDto,
    @Body('patientId', OptionalActivePatientPipe) patient: Patient | undefined,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const clinicId = resolveClinicId(req);
    return this.labOrdersService.create(createDto, user, clinicId, patient);
  }

  @Get()
  findAll(@Req() req: Request, @Query('page') page?: number, @Query('pageSize') pageSize?: number, @Query() query?: any) {
    const clinicId = resolveClinicId(req);
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 20;
    const filter = { ...query };
    delete filter.page;
    delete filter.pageSize;
    return this.labOrdersService.findAll(p, ps, filter, clinicId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.labOrdersService.findOne(id, clinicId);
  }

  @Patch(':id')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  @RequirePermissions(Permission.LabOrder)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateLabOrderDto, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.labOrdersService.update(id, updateDto, clinicId);
  }

  @Patch(':id/status')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN, ValidRoles.LABORATORY)
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body('status') status: LabOrderStatus, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.labOrdersService.setStatus(id, status, clinicId);
  }

  @Post(':id/items/:itemId/result')
  @Auth(ValidRoles.LABORATORY, ValidRoles.ADMIN)
  @RequirePermissions(Permission.LabResultEnter)
  enterResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: EnterLabResultDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const clinicId = resolveClinicId(req);
    return this.labOrdersService.enterResult(id, itemId, dto, user, clinicId);
  }

  @Delete(':id')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  @RequirePermissions(Permission.LabOrder)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.labOrdersService.remove(id, clinicId);
  }
}
