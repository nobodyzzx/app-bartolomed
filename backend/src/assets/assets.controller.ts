import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { Auth, AuthClinic } from '../auth/decorators';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { FilterAssetsDto } from './dto/filter-assets.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Controller('assets')
@AuthClinic({ roles: [ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN] })
@RequirePermissions(Permission.AssetsManage)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  create(@Body() createAssetDto: CreateAssetDto, @GetUser() user: User, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.assetsService.create(createAssetDto, user.id, clinicId);
  }

  @Get()
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  findAll(@Query() filters: FilterAssetsDto, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.assetsService.findAll(filters, clinicId);
  }

  @Get('stats')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  getStats(@Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.assetsService.getStats(clinicId);
  }

  @Get('validate-serial/:serialNumber')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  validateSerialNumber(@Param('serialNumber') serialNumber: string, @Query('excludeId') excludeId?: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.validateSerialNumber(serialNumber, excludeId, clinicId);
  }

  @Get('unique/:field')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  getUniqueValues(@Param('field') field: 'type' | 'manufacturer' | 'location' | 'category', @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.assetsService.getUniqueValues(field, clinicId);
  }

  // ==================== MAINTENANCE ROUTES ====================
  @Get('maintenance')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  findAllMaintenance(@Query() filters?: any, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.findAllMaintenance(filters, clinicId);
  }

  @Get('maintenance/stats')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  getMaintenanceStats(@Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.getMaintenanceStats(clinicId);
  }

  @Post('maintenance')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  createMaintenance(@Body() data: any, @GetUser() user: User, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.createMaintenance(data, user.id, clinicId);
  }

  @Get('maintenance/:maintenanceId')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  findOneMaintenance(@Param('maintenanceId', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.findOneMaintenance(id, clinicId);
  }

  @Patch('maintenance/:maintenanceId')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  updateMaintenance(@Param('maintenanceId', ParseUUIDPipe) id: string, @Body() data: any, @Req() req?: Request, @GetUser() user?: User) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.updateMaintenance(id, data, clinicId, user?.id);
  }

  @Delete('maintenance/:maintenanceId')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  deleteMaintenance(@Param('maintenanceId', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.deleteMaintenance(id, clinicId);
  }

  // ==================== REPORTS ROUTES ====================
  @Get('reports')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR)
  findAllReports(@Query() filters?: any, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.findAllReports(filters, clinicId);
  }

  @Get('reports/stats')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  getReportsStats(@Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.getReportsStats(clinicId);
  }

  @Post('reports/generate')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR)
  generateReport(@Body() data: any, @GetUser() user: User, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.generateReport(data, user.id, clinicId);
  }

  @Get('reports/:reportId')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR)
  findOneReport(@Param('reportId', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.findOneReport(id, clinicId);
  }

  @Delete('reports/:reportId')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  deleteReport(@Param('reportId', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.deleteReport(id, clinicId);
  }

  // ==================== ASSET ROUTES (KEEP AT END) ====================
  // IMPORTANTE: Rutas con :id deben ir AL FINAL para no capturar rutas específicas como /maintenance, /reports, /stats

  @Patch(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateAssetDto: UpdateAssetDto, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.update(id, updateAssetDto, clinicId);
  }

  @Delete(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.remove(id, clinicId);
  }

  @Get(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.assetsService.findOne(id, clinicId);
  }
}
