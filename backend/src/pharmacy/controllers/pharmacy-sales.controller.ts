import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import { CreatePharmacySaleDto, UpdatePharmacySaleDto, UpdatePharmacySaleStatusDto } from '../dto/pharmacy-sale.dto';
import { SaleStatus } from '../entities/pharmacy-sale.entity';
import { PharmacySalesService } from '../services/pharmacy-sales.service';

@Controller('pharmacy-sales')
export class PharmacySalesController {
  constructor(private readonly pharmacySalesService: PharmacySalesService) {}

  @Post()
  create(@Body() createPharmacySaleDto: CreatePharmacySaleDto, @Request() req: any) {
    const soldById = req.user?.sub || 'system';
    return this.pharmacySalesService.create(createPharmacySaleDto, soldById);
  }

  @Get()
  findAll(
    @Query('status') status?: SaleStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (status) {
      return this.pharmacySalesService.getSalesByStatus(status);
    }
    if (startDate && endDate) {
      return this.pharmacySalesService.getSalesByDateRange(new Date(startDate), new Date(endDate));
    }
    return this.pharmacySalesService.findAll();
  }

  @Get('daily-total/:date')
  getDailyTotal(@Param('date') date: string) {
    return this.pharmacySalesService.getDailySalesTotal(new Date(date));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pharmacySalesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePharmacySaleDto: UpdatePharmacySaleDto) {
    return this.pharmacySalesService.update(id, updatePharmacySaleDto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdatePharmacySaleStatusDto) {
    return this.pharmacySalesService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pharmacySalesService.remove(id);
  }
}
