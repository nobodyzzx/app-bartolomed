import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Auth, AuthClinic, GetUser } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { Patient } from '../patients/entities/patient.entity';
import { OptionalActivePatientPipe } from '../patients/pipes/optional-active-patient.pipe';
import { User } from '../users/entities/user.entity';
import {
  CreateLabOrderDto,
  CreateExternalLabOrderDto,
  UpdateLabOrderDto,
  EnterLabResultDto,
} from './dto';
import { LabOrderStatus, LabOrderType } from './entities/lab-order.entity';
import { LabOrdersService } from './lab-orders.service';
import { LabResultsPdfService } from './lab-results-pdf.service';

@Controller('lab-orders')
@AuthClinic()
@RequirePermissions(Permission.LabRead, Permission.LabOrder, Permission.LabResultEnter)
export class LabOrdersController {
  constructor(
    private readonly labOrdersService: LabOrdersService,
    private readonly labResultsPdfService: LabResultsPdfService,
  ) {}

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

  /**
   * Endpoint aparte, y no una bandera en `POST /lab-orders`, para que la
   * autorización sea explícita: aquí entran roles que **no** pueden indicar
   * exámenes (laboratorio, recepción) y el DTO ni siquiera acepta `doctorId`,
   * así que no hay forma de que quien registra acabe firmando la orden.
   */
  @Post('external')
  @Auth(
    ValidRoles.LABORATORY,
    ValidRoles.RECEPTIONIST,
    ValidRoles.ADMIN,
    ValidRoles.SUPER_ADMIN,
  )
  @RequirePermissions(Permission.LabOrderExternal)
  createExternal(
    @Body() createDto: CreateExternalLabOrderDto,
    @Body('patientId', OptionalActivePatientPipe) patient: Patient | undefined,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const clinicId = resolveClinicId(req);
    return this.labOrdersService.createExternal(createDto, user, clinicId, patient);
  }

  @Get()
  findAll(@Req() req: Request, @Query('page') page?: number, @Query('pageSize') pageSize?: number, @Query() query?: any) {
    const clinicId = resolveClinicId(req);
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 20;
    const filter = { ...query };
    delete filter.page;
    delete filter.pageSize;
    return this.labOrdersService.findAll(p, ps, filter, clinicId, LabOrderType.LAB);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.labOrdersService.findOne(id, clinicId, LabOrderType.LAB);
  }

  /**
   * Informe de resultados para entregar al paciente o adjuntar al expediente.
   * Basta `LabRead` (el permiso de clase): lo imprime tanto el laboratorio como
   * el médico que pidió el examen, enfermería o recepción al entregarlo.
   */
  @Get(':id/results/pdf')
  async getResultsPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const clinicId = resolveClinicId(req);
    const order = await this.labOrdersService.findOne(id, clinicId, LabOrderType.LAB);
    const pdf = await this.labResultsPdfService.generate(order);
    // El nombre del archivo dice qué es: sin resultados el documento es la
    // solicitud que acompaña la muestra, no un informe.
    const tieneResultados = (order.items ?? []).some((i: { resultedAt?: Date }) => !!i.resultedAt);
    const prefijo = tieneResultados ? 'resultados' : 'solicitud';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${prefijo}-${order.orderNumber}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
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
