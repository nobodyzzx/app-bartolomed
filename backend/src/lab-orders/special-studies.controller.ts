import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Auth, AuthClinic, GetUser } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { Patient } from '../patients/entities/patient.entity';
import { OptionalActivePatientPipe } from '../patients/pipes/optional-active-patient.pipe';
import { User } from '../users/entities/user.entity';
import { CreateLabOrderDto, CreateExternalLabOrderDto, EnterLabResultDto } from './dto';
import { LabOrderStatus, LabOrderType } from './entities/lab-order.entity';
import { LabOrdersService } from './lab-orders.service';
import { LabResultsPdfService } from './lab-results-pdf.service';

/**
 * Estudios especiales: ecografía, colonoscopia, electrocardiograma.
 *
 * Comparte servicio con laboratorio —cargos, estados, informe en PDF y
 * solicitud externa son los mismos— pero es un módulo aparte de cara al
 * usuario: su propia ruta, su propio rol y **sus propios permisos**.
 *
 * Cada método fija `LabOrderType.SPECIAL`, que es lo que impide que este
 * módulo muestre los análisis clínicos del paciente: quien realiza una
 * ecografía no tiene por qué ver su carga viral ni su prueba de VIH.
 */
@Controller('special-studies')
@AuthClinic()
@RequirePermissions(Permission.SpecialRead, Permission.SpecialOrder, Permission.SpecialResultEnter)
export class SpecialStudiesController {
  constructor(
    private readonly labOrdersService: LabOrdersService,
    private readonly labResultsPdfService: LabResultsPdfService,
  ) {}

  @Post()
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  @RequirePermissions(Permission.SpecialOrder)
  create(
    @Body() createDto: CreateLabOrderDto,
    @Body('patientId', OptionalActivePatientPipe) patient: Patient | undefined,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.labOrdersService.create(
      createDto,
      user,
      resolveClinicId(req),
      patient,
      LabOrderType.SPECIAL,
    );
  }

  /** Mismo criterio que en laboratorio: el paciente llega derivado o particular. */
  @Post('external')
  @Auth(
    ValidRoles.SPECIAL_STUDIES,
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
    return this.labOrdersService.createExternal(
      createDto,
      user,
      resolveClinicId(req),
      patient,
      LabOrderType.SPECIAL,
    );
  }

  @Get()
  findAll(@Req() req: Request, @Query('page') page?: number, @Query('pageSize') pageSize?: number, @Query() query?: any) {
    const filter = { ...query };
    delete filter.page;
    delete filter.pageSize;
    return this.labOrdersService.findAll(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
      filter,
      resolveClinicId(req),
      LabOrderType.SPECIAL,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.labOrdersService.findOne(id, resolveClinicId(req), LabOrderType.SPECIAL);
  }

  @Get(':id/results/pdf')
  async getResultsPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const order = await this.labOrdersService.findOne(
      id,
      resolveClinicId(req),
      LabOrderType.SPECIAL,
    );
    const pdf = await this.labResultsPdfService.generate(order);
    const tieneResultados = (order.items ?? []).some((i: { resultedAt?: Date }) => !!i.resultedAt);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${tieneResultados ? 'resultados' : 'solicitud'}-${order.orderNumber}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Patch(':id/status')
  @Auth(
    ValidRoles.DOCTOR,
    ValidRoles.ADMIN,
    ValidRoles.SUPER_ADMIN,
    ValidRoles.SPECIAL_STUDIES,
  )
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: LabOrderStatus,
    @Req() req: Request,
  ) {
    const clinicId = resolveClinicId(req);
    // Comprueba el módulo antes de tocar nada: sin esto se podría mover el
    // estado de una orden de laboratorio desde este endpoint.
    await this.labOrdersService.findOne(id, clinicId, LabOrderType.SPECIAL);
    return this.labOrdersService.setStatus(id, status, clinicId);
  }

  @Post(':id/items/:itemId/result')
  @Auth(ValidRoles.SPECIAL_STUDIES, ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  @RequirePermissions(Permission.SpecialResultEnter)
  async enterResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: EnterLabResultDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const clinicId = resolveClinicId(req);
    await this.labOrdersService.findOne(id, clinicId, LabOrderType.SPECIAL);
    return this.labOrdersService.enterResult(id, itemId, dto, user, clinicId);
  }
}
