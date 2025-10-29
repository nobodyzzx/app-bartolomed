import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  CreateMedicationDto,
  CreateMedicationStockDto,
  UpdateMedicationDto,
  UpdateMedicationStockDto,
} from '../dto/medication.dto';
import { InventoryService } from '../services/inventory.service';

@Controller('pharmacy/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // Medication endpoints
  @Post('medications')
  createMedication(@Body() createMedicationDto: CreateMedicationDto) {
    return this.inventoryService.createMedication(createMedicationDto);
  }

  @Get('medications')
  findAllMedications() {
    return this.inventoryService.findAllMedications();
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
  addStock(@Body() createStockDto: CreateMedicationStockDto) {
    return this.inventoryService.addStock(createStockDto);
  }

  @Get('stock')
  findAllStock(@Query('clinicId') clinicId: string) {
    return this.inventoryService.findAllStock(clinicId);
  }

  @Get('stock/low-stock')
  getLowStockItems(@Query('clinicId') clinicId: string) {
    return this.inventoryService.getLowStockItems(clinicId);
  }

  @Get('stock/expiring')
  getExpiringItems(@Query('clinicId') clinicId: string, @Query('days') days?: number) {
    return this.inventoryService.getExpiringItems(clinicId, days);
  }

  @Get('stock/:id')
  findStockById(@Param('id') id: string) {
    return this.inventoryService.findStockById(id);
  }

  @Patch('stock/:id')
  updateStock(@Param('id') id: string, @Body() updateStockDto: UpdateMedicationStockDto) {
    return this.inventoryService.updateStock(id, updateStockDto);
  }

  @Post('stock/:id/reserve')
  reserveStock(@Param('id') id: string, @Body('quantity') quantity: number) {
    return this.inventoryService.reserveStock(id, quantity);
  }

  @Post('stock/:id/release')
  releaseStock(@Param('id') id: string, @Body('quantity') quantity: number) {
    return this.inventoryService.releaseStock(id, quantity);
  }

  @Post('stock/:id/consume')
  consumeStock(@Param('id') id: string, @Body('quantity') quantity: number) {
    return this.inventoryService.consumeStock(id, quantity);
  }
}
