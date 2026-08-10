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
import { CreateAssetDto } from './dto/create-asset.dto';
import { FilterAssetsDto } from './dto/filter-assets.dto';
import { FilterMovementsDto, MoveAssetDto } from './dto/asset-movement.dto';
import { CloseInventoryCountDto, SaveCountedItemsDto, StartInventoryCountDto } from './dto/inventory-count.dto';
import { PrintAssetReportDto, PrintHandoverActDto } from './dto/print-asset-report.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetMovementsService } from './services/asset-movements.service';
import { AssetPrintReportsService } from './services/asset-print-reports.service';
import { InventoryCountsService } from './services/inventory-counts.service';
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
    private readonly movements: AssetMovementsService,
    private readonly counts: InventoryCountsService,
  ) {}

  // ==================== MOVIMIENTOS ENTRE AMBIENTES ====================

  /**
   * Traspasa unidades a otro ambiente en un paso, sea de esta clínica o de la de
   * al lado.
   *
   * Es lo que pasa a diario y antes no dejaba rastro: mover una silla era editar
   * el campo Ambiente. El flujo de `/asset-transfers` sigue disponible para el
   * traslado que necesite despacho y confirmación de recepción firmada.
   */
  @Post(':id/move')
  moveAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveAssetDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.movements.move(id, dto, user.id, resolveClinicId(req)!);
  }

  /**
   * Declarado antes que `movements`: Nest resuelve por orden y una ruta estática
   * detrás de otra más corta igual entra, pero el orden explícito evita que un
   * futuro `movements/:algo` se coma esta.
   */
  @Get('movements/target-clinics')
  findTargetClinics(@GetUser() user: User, @Req() req: Request) {
    return this.movements.targetClinics(user.id, resolveClinicId(req)!);
  }

  @Get('movements')
  findMovements(@Query() filters: FilterMovementsDto, @Req() req: Request) {
    return this.movements.findAll(resolveClinicId(req)!, filters);
  }

  @Get(':id/movements')
  findAssetMovements(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.movements.findByAsset(id, resolveClinicId(req)!);
  }

  // ==================== TOMA DE INVENTARIO ====================

  /**
   * Abre un conteo y congela lo esperado de cada ítem. Sin ese congelado, una
   * edición hecha mientras se recorre la clínica movería el blanco contra el que
   * se mide la diferencia.
   */
  @Post('counts')
  startCount(@Body() dto: StartInventoryCountDto, @GetUser() user: User, @Req() req: Request) {
    return this.counts.start(dto, user.id, resolveClinicId(req)!);
  }

  @Get('counts')
  findCounts(@Req() req: Request) {
    return this.counts.findAll(resolveClinicId(req)!);
  }

  @Get('counts/:countId')
  async findCount(@Param('countId', ParseUUIDPipe) id: string, @Req() req: Request) {
    const count = await this.counts.findOne(id, resolveClinicId(req)!);
    return { ...count, summary: this.counts.summarize(count) };
  }

  @Patch('counts/:countId/items')
  saveCounted(@Param('countId', ParseUUIDPipe) id: string, @Body() dto: SaveCountedItemsDto, @Req() req: Request) {
    return this.counts.saveCounted(id, dto, resolveClinicId(req)!);
  }

  @Post('counts/:countId/close')
  closeCount(
    @Param('countId', ParseUUIDPipe) id: string,
    @Body() dto: CloseInventoryCountDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.counts.close(id, dto, user.id, resolveClinicId(req)!);
  }

  @Post('counts/:countId/cancel')
  cancelCount(@Param('countId', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.counts.cancel(id, resolveClinicId(req)!);
  }

  /** Acta de diferencias del conteo, para archivar firmada. */
  @Get('counts/:countId/act')
  async printCountAct(@Param('countId', ParseUUIDPipe) id: string, @Req() req: Request, @Res() res: Response) {
    const clinicId = resolveClinicId(req);
    const count = await this.counts.findOne(id, clinicId!);
    const buf = await this.printReports.countAct(count, this.counts.summarize(count));
    this.sendPdf(res, `acta-conteo-${count.countNumber}`, buf);
  }

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
  validateSerialNumber(
    @Param('serialNumber') serialNumber: string,
    @Query('excludeId') excludeId?: string,
    @Req() req?: Request,
  ) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.validateSerialNumber(serialNumber, excludeId, clinicId);
  }

  @Get('unique/:field')
  getUniqueValues(@Param('field') field: 'type' | 'manufacturer' | 'location' | 'category', @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.assetsService.getUniqueValues(field, clinicId);
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
