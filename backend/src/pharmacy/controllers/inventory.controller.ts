import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthClinic } from '../../auth/decorators';
import { resolveClinicId } from '../../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permissions.enum';
import { ValidRoles } from '../../auth/interfaces';
import {
  CreateMedicationDto,
  CreateMedicationStockDto,
  TransferStockDto,
  UpdateMedicationDto,
  UpdateMedicationStockDto,
} from '../dto/medication.dto';
import { InventoryService } from '../services/inventory.service';

@Controller('pharmacy/inventory')
@AuthClinic({ roles: [ValidRoles.PHARMACIST, ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN] })
@RequirePermissions(Permission.PharmacyInventoryManage)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // Medication endpoints (catálogo global compartido entre clínicas)
  @Post('medications')
  createMedication(@Body() createMedicationDto: CreateMedicationDto) {
    return this.inventoryService.createMedication(createMedicationDto);
  }

  @Get('medications')
  findAllMedications(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.findAllMedications(page ? +page : 1, limit ? +limit : 100);
  }

  @Get('medications/search')
  searchMedications(@Query('term') searchTerm: string) {
    return this.inventoryService.searchMedications(searchTerm);
  }

  @Get('medications/:id')
  findMedicationById(@Param('id') id: string) {
    return this.inventoryService.findMedicationById(id);
  }

  @Patch('medications/:id')
  updateMedication(@Param('id') id: string, @Body() updateMedicationDto: UpdateMedicationDto) {
    return this.inventoryService.updateMedication(id, updateMedicationDto);
  }

  @Delete('medications/:id')
  deleteMedication(@Param('id') id: string) {
    return this.inventoryService.deleteMedication(id);
  }

  // Stock endpoints
  @Post('stock')
  addStock(@Body() createStockDto: CreateMedicationStockDto, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.inventoryService.addStock(createStockDto, clinicId);
  }

  @Get('stock')
  findAllStock(
    @Req() req: Request,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const clinicId = resolveClinicId(req);
    if (!clinicId) throw new BadRequestException('Contexto de clínica requerido');
    return this.inventoryService.findAllStock(clinicId, page ? +page : 1, limit ? +limit : 100);
  }

  @Get('stock/low-stock')
  getLowStockItems(@Req() req: Request) {
    const clinicId = resolveClinicId(req);
    if (!clinicId) throw new BadRequestException('Contexto de clínica requerido');
    return this.inventoryService.getLowStockItems(clinicId);
  }

  @Get('stock/expiring')
  getExpiringItems(@Req() req: Request, @Query('days') days?: number) {
    const clinicId = resolveClinicId(req);
    if (!clinicId) throw new BadRequestException('Contexto de clínica requerido');
    return this.inventoryService.getExpiringItems(clinicId, days);
  }

  @Get('stock/:id')
  findStockById(@Param('id') id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.inventoryService.findStockById(id, clinicId);
  }

  @Patch('stock/:id')
  updateStock(@Param('id') id: string, @Body() updateStockDto: UpdateMedicationStockDto, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.inventoryService.updateStock(id, updateStockDto, clinicId);
  }

  @Post('stock/:id/reserve')
  reserveStock(@Param('id') id: string, @Body('quantity') quantity: number, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.inventoryService.reserveStock(id, quantity, clinicId);
  }

  @Post('stock/:id/release')
  releaseStock(@Param('id') id: string, @Body('quantity') quantity: number, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.inventoryService.releaseStock(id, quantity, clinicId);
  }

  @Post('stock/:id/consume')
  consumeStock(@Param('id') id: string, @Body('quantity') quantity: number, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.inventoryService.consumeStock(id, quantity, clinicId);
  }

  @Post('stock/transfer')
  transferStock(@Body() dto: TransferStockDto, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.inventoryService.transferStock(dto, clinicId);
  }
}
