import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { AuthClinic } from '../auth/decorators';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { AssetsService } from './assets.service';
import { CreateAssetMaintenanceDto, UpdateAssetMaintenanceDto } from './dto/asset-maintenance.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { FilterAssetsDto } from './dto/filter-assets.dto';
import { PrintAssetReportDto, PrintHandoverActDto } from './dto/print-asset-report.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetPrintReportsService } from './services/asset-print-reports.service';
import { contentDisposition } from '../common/utils/content-disposition.util';

// Sin @Auth() por método: @AuthClinic a nivel de clase ya monta
// JwtAuthGuard+UserRoleGuard+PermissionsGuard+ClinicScopeGuard con estos
// mismos roles — repetirlo en cada endpoint solo duplicaba la ejecución de
// los guards sin cambiar el resultado (todos los métodos usaban los mismos
// roles que la clase).
@Controller('assets')
@AuthClinic({ roles: [ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN] })
@RequirePermissions(Permission.AssetsManage)
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly printReports: AssetPrintReportsService,
  ) {}

  @Post()
  create(@Body() createAssetDto: CreateAssetDto, @GetUser() user: User, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.assetsService.create(createAssetDto, user.id, clinicId);
  }

  @Get()
  // DOCTOR/NURSE no tienen Permission.AssetsManage (class-level, solo
  // ADMIN/SUPER_ADMIN) — listarlos acá era decorativo, PermissionsGuard los
  // bloqueaba igual. El frontend tampoco enruta /dashboard/assets-control
  // para esos roles.
  findAll(@Query() filters: FilterAssetsDto, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.assetsService.findAll(filters, clinicId);
  }

  @Get('stats')
  getStats(@Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.assetsService.getStats(clinicId);
  }

  @Get('validate-serial/:serialNumber')
  validateSerialNumber(@Param('serialNumber') serialNumber: string, @Query('excludeId') excludeId?: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.validateSerialNumber(serialNumber, excludeId, clinicId);
  }

  @Get('unique/:field')
  getUniqueValues(@Param('field') field: 'type' | 'manufacturer' | 'location' | 'category', @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.assetsService.getUniqueValues(field, clinicId);
  }

  // ==================== MAINTENANCE ROUTES ====================
  @Get('maintenance')
  // DOCTOR/NURSE no tienen Permission.AssetsManage (class-level, solo
  // ADMIN/SUPER_ADMIN) — listarlos acá era decorativo, PermissionsGuard los
  // bloqueaba igual. El frontend tampoco enruta /dashboard/assets-control
  // para esos roles.
  findAllMaintenance(@Query() filters?: any, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.findAllMaintenance(filters, clinicId);
  }

  @Get('maintenance/stats')
  getMaintenanceStats(@Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.getMaintenanceStats(clinicId);
  }

  @Post('maintenance')
  createMaintenance(@Body() data: CreateAssetMaintenanceDto, @GetUser() user: User, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.createMaintenance(data, user.id, clinicId);
  }

  @Get('maintenance/:maintenanceId')
  // DOCTOR/NURSE no tienen Permission.AssetsManage (class-level, solo
  // ADMIN/SUPER_ADMIN) — listarlos acá era decorativo, PermissionsGuard los
  // bloqueaba igual. El frontend tampoco enruta /dashboard/assets-control
  // para esos roles.
  findOneMaintenance(@Param('maintenanceId', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.findOneMaintenance(id, clinicId);
  }

  @Patch('maintenance/:maintenanceId')
  updateMaintenance(
    @Param('maintenanceId', ParseUUIDPipe) id: string,
    @Body() data: UpdateAssetMaintenanceDto,
    @Req() req?: Request,
    @GetUser() user?: User,
  ) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.updateMaintenance(id, data, clinicId, user?.id);
  }

  @Delete('maintenance/:maintenanceId')
  deleteMaintenance(@Param('maintenanceId', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.deleteMaintenance(id, clinicId);
  }

  // ==================== INFORMES PARA IMPRIMIR ====================

  /**
   * Los cinco informes de papel del control de activos, expuestos en la página
   * unificada de Reportes. Se compilan al vuelo y no se persisten: un activo
   * corregido no debe dejar un PDF archivado que lo contradiga (mismo criterio
   * que el informe de resultados de laboratorio).
   *
   * Reemplazan al generador de `AssetReport`, que archivaba una copia de los
   * datos en la fila y ofrecía seis tipos de los que cuatro salían vacíos o en
   * Bs 0,00 contra el inventario real, cargado sin precios ni fechas de compra.
   */
  @Get('reports/print/inventory-by-location')
  async printInventoryByLocation(@Query() q: PrintAssetReportDto, @Req() req: Request, @Res() res: Response) {
    const buf = await this.printReports.inventoryByLocation(resolveClinicId(req), q);
    this.sendPdf(res, 'inventario-activos', buf);
  }

  @Get('reports/print/handover-act')
  async printHandoverAct(@Query() q: PrintHandoverActDto, @Req() req: Request, @Res() res: Response) {
    const buf = await this.printReports.handoverAct(resolveClinicId(req), q);
    this.sendPdf(res, 'acta-entrega-activos', buf);
  }

  @Get('reports/print/count-sheet')
  async printCountSheet(@Query() q: PrintAssetReportDto, @Req() req: Request, @Res() res: Response) {
    const buf = await this.printReports.countSheet(resolveClinicId(req), q);
    this.sendPdf(res, 'hoja-conteo-activos', buf);
  }

  @Get('reports/print/executive-summary')
  async printExecutiveSummary(@Query() q: PrintAssetReportDto, @Req() req: Request, @Res() res: Response) {
    const buf = await this.printReports.executiveSummary(resolveClinicId(req), q);
    this.sendPdf(res, 'resumen-activos', buf);
  }

  @Get('reports/print/condition-and-disposals')
  async printConditionAndDisposals(@Query() q: PrintAssetReportDto, @Req() req: Request, @Res() res: Response) {
    const buf = await this.printReports.conditionAndDisposals(resolveClinicId(req), q);
    this.sendPdf(res, 'activos-mal-estado-y-bajas', buf);
  }

  private sendPdf(res: Response, base: string, buf: Buffer): void {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDisposition(`${base}-${new Date().toISOString().slice(0, 10)}.pdf`));
    res.end(buf);
  }

  // ==================== ASSET ROUTES (KEEP AT END) ====================
  // IMPORTANTE: Rutas con :id deben ir AL FINAL para no capturar rutas específicas como /maintenance, /reports, /stats

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateAssetDto: UpdateAssetDto, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.update(id, updateAssetDto, clinicId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.remove(id, clinicId);
  }

  @Get(':id')
  // DOCTOR/NURSE no tienen Permission.AssetsManage (class-level, solo
  // ADMIN/SUPER_ADMIN) — listarlos acá era decorativo, PermissionsGuard los
  // bloqueaba igual. El frontend tampoco enruta /dashboard/assets-control
  // para esos roles.
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.findOne(id, clinicId);
  }
}
