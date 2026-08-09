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
import { GenerateReportDto } from './dto/asset-report.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { FilterAssetsDto } from './dto/filter-assets.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
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
  constructor(private readonly assetsService: AssetsService) {}

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

  // ==================== REPORTS ROUTES ====================
  @Get('reports')
  // DOCTOR no tiene Permission.AssetsManage — ver nota arriba.
  findAllReports(@Query() filters?: any, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.findAllReports(filters, clinicId);
  }

  @Get('reports/stats')
  getReportsStats(@Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.getReportsStats(clinicId);
  }

  @Post('reports/generate')
  // DOCTOR no tiene Permission.AssetsManage — ver nota arriba.
  generateReport(@Body() data: GenerateReportDto, @GetUser() user: User, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.generateReport(data, user.id, clinicId);
  }

  /**
   * El nombre del archivo sale del título que puso el usuario, y en español eso
   * trae tildes casi siempre. Node rechaza cualquier carácter no ASCII en una
   * cabecera (`ERR_INVALID_CHAR`), así que un informe llamado "Inventario de
   * activos — traspaso" hacía fallar la descarga con un 500 después de haberse
   * generado bien. Se manda un `filename` plano para clientes antiguos y el
   * nombre real en `filename*`, que es el mecanismo previsto para esto.
   */
  @Get('reports/:reportId/download')
  async downloadReport(@Param('reportId', ParseUUIDPipe) id: string, @Res() res: Response, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    const { fileName, contentType, content } = await this.assetsService.downloadReport(id, clinicId);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', contentDisposition(fileName));
    res.send(content);
  }

  @Get('reports/:reportId')
  // DOCTOR no tiene Permission.AssetsManage — ver nota arriba.
  findOneReport(@Param('reportId', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.findOneReport(id, clinicId);
  }

  @Delete('reports/:reportId')
  deleteReport(@Param('reportId', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.deleteReport(id, clinicId);
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
