import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { FilterAssetsDto } from './dto/filter-assets.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  create(@Body() createAssetDto: CreateAssetDto, @GetUser() user: User) {
    // TODO: Obtener clinicId del contexto o del usuario
    return this.assetsService.create(createAssetDto, user.id);
  }

  @Get()
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  findAll(@Query() filters: FilterAssetsDto) {
    // TODO: Filtrar por clinicId del usuario
    return this.assetsService.findAll(filters);
  }

  @Get('stats')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  getStats() {
    // TODO: Filtrar por clinicId del usuario
    return this.assetsService.getStats();
  }

  @Get('validate-serial/:serialNumber')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  validateSerialNumber(@Param('serialNumber') serialNumber: string, @Query('excludeId') excludeId?: string) {
    return this.assetsService.validateSerialNumber(serialNumber, excludeId);
  }

  @Get('unique/:field')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  getUniqueValues(@Param('field') field: 'type' | 'manufacturer' | 'location' | 'category') {
    // TODO: Filtrar por clinicId del usuario
    return this.assetsService.getUniqueValues(field);
  }

  // ==================== MAINTENANCE ROUTES ====================
  @Get('maintenance')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  findAllMaintenance(@Query() filters?: any) {
    return this.assetsService.findAllMaintenance(filters);
  }

  @Get('maintenance/stats')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  getMaintenanceStats() {
    return this.assetsService.getMaintenanceStats();
  }

  @Post('maintenance')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  createMaintenance(@Body() data: any, @GetUser() user: User) {
    return this.assetsService.createMaintenance(data, user.id);
  }

  @Get('maintenance/:maintenanceId')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  findOneMaintenance(@Param('maintenanceId', ParseUUIDPipe) id: string) {
    return this.assetsService.findOneMaintenance(id);
  }

  @Patch('maintenance/:maintenanceId')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  updateMaintenance(@Param('maintenanceId', ParseUUIDPipe) id: string, @Body() data: any) {
    return this.assetsService.updateMaintenance(id, data);
  }

  @Delete('maintenance/:maintenanceId')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  deleteMaintenance(@Param('maintenanceId', ParseUUIDPipe) id: string) {
    return this.assetsService.deleteMaintenance(id);
  }

  // ==================== REPORTS ROUTES ====================
  @Get('reports')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR)
  findAllReports(@Query() filters?: any) {
    return this.assetsService.findAllReports(filters);
  }

  @Get('reports/stats')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  getReportsStats() {
    return this.assetsService.getReportsStats();
  }

  @Post('reports/generate')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR)
  generateReport(@Body() data: any, @GetUser() user: User) {
    return this.assetsService.generateReport(data, user.id);
  }

  @Get('reports/:reportId')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR)
  findOneReport(@Param('reportId', ParseUUIDPipe) id: string) {
    return this.assetsService.findOneReport(id);
  }

  @Delete('reports/:reportId')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  deleteReport(@Param('reportId', ParseUUIDPipe) id: string) {
    return this.assetsService.deleteReport(id);
  }

  // ==================== ASSET ROUTES (KEEP AT END) ====================
  // IMPORTANTE: Rutas con :id deben ir AL FINAL para no capturar rutas específicas como /maintenance, /reports, /stats

  @Patch(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateAssetDto: UpdateAssetDto) {
    return this.assetsService.update(id, updateAssetDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.remove(id);
  }

  @Get(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.findOne(id);
  }
}
