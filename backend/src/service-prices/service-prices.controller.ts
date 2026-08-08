import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthClinic, GetUser } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { User } from '../users/entities/user.entity';
import {
  ApplyMarginDto,
  CreateServicePriceDto,
  FilterServicePricesDto,
  UpdateServicePriceDto,
} from './dto';
import { ServicePricesService } from './service-prices.service';

/**
 * Lectura con `BillingRead` y escritura con `SettingsManage`: recepción
 * necesita consultar el tarifario para cobrar, pero cambiar los precios de la
 * clínica es una tarea administrativa (ADMIN / SUPER_ADMIN).
 */
@Controller('service-prices')
@AuthClinic()
@RequirePermissions(Permission.BillingRead)
export class ServicePricesController {
  constructor(private readonly servicePricesService: ServicePricesService) {}

  @Post()
  @RequirePermissions(Permission.SettingsManage)
  create(@Body() dto: CreateServicePriceDto, @GetUser() user: User, @Req() req: Request) {
    return this.servicePricesService.create(dto, user, resolveClinicId(req));
  }

  @Get()
  findAll(@Query() filter: FilterServicePricesDto, @Req() req: Request) {
    return this.servicePricesService.findAll(filter, resolveClinicId(req));
  }

  /**
   * Recalcula en bloque el precio de los estudios de una categoría a partir de
   * un margen sobre su costo de convenio. Con `dryRun` solo devuelve la vista
   * previa: cambiar decenas de precios de golpe no debe confirmarse a ciegas.
   *
   * `POST` y no `PATCH` porque no actualiza un recurso concreto, sino que
   * ejecuta un recálculo sobre un conjunto.
   */
  @Post('apply-margin')
  @HttpCode(200)
  @RequirePermissions(Permission.SettingsManage)
  applyMargin(@Body() dto: ApplyMarginDto, @GetUser() user: User, @Req() req: Request) {
    return this.servicePricesService.applyMargin(dto, user, resolveClinicId(req));
  }

  // Quien pide un estudio de laboratorio necesita elegirlo del tarifario, o la
  // orden se guarda con un nombre libre que no casa con ningún precio y nunca
  // llega a generar cargo. Un médico no tiene `BillingRead` —no cobra— así que
  // este endpoint acepta también `LabOrder`: PermissionsGuard exige *alguno* de
  // los permisos listados, no todos. Y `LabOrderExternal` por lo mismo, para
  // laboratorio y recepción al registrar una solicitud externa. Devuelve solo
  // lo necesario para elegir (id, nombre, categoría y precio) y únicamente
  // precios activos.
  @Get('catalog')
  @RequirePermissions(
    Permission.BillingRead,
    Permission.LabOrder,
    Permission.LabOrderExternal,
    // Quien indica un estudio especial elige del mismo catálogo. Hoy DOCTOR
    // llega por `LabOrder`, pero un rol que solo pidiera gabinete se quedaría
    // sin precios y guardaría el estudio sin cargo, en silencio.
    Permission.SpecialOrder,
  )
  findCatalog(@Query() filter: FilterServicePricesDto, @Req() req: Request) {
    return this.servicePricesService.findCatalog(filter, resolveClinicId(req));
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.servicePricesService.findOne(id, resolveClinicId(req));
  }

  @Patch(':id')
  @RequirePermissions(Permission.SettingsManage)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServicePriceDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.servicePricesService.update(id, dto, user, resolveClinicId(req));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.SettingsManage)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.servicePricesService.remove(id, resolveClinicId(req));
  }
}
