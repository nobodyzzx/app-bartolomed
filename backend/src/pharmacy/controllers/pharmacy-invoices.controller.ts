import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import {
  CreatePharmacyInvoiceDto,
  UpdatePharmacyInvoiceDto,
  UpdatePharmacyInvoiceStatusDto,
} from '../dto/pharmacy-invoice.dto';
import { InvoiceStatus } from '../entities/pharmacy-invoice.entity';
import { PharmacyInvoicesService } from '../services/pharmacy-invoices.service';

@Controller('pharmacy-invoices')
export class PharmacyInvoicesController {
  constructor(private readonly pharmacyInvoicesService: PharmacyInvoicesService) {}

  @Post()
  create(@Body() createPharmacyInvoiceDto: CreatePharmacyInvoiceDto, @Request() req: any) {
    const createdById = req.user?.sub || 'system';
    return this.pharmacyInvoicesService.create(createPharmacyInvoiceDto, createdById);
  }

  @Get()
  findAll(@Query('status') status?: InvoiceStatus) {
    if (status) {
      return this.pharmacyInvoicesService.getInvoicesByStatus(status);
    }
    return this.pharmacyInvoicesService.findAll();
  }

  @Get('overdue')
  getOverdue() {
    return this.pharmacyInvoicesService.getOverdueInvoices();
  }

  @Get('revenue')
  getTotalRevenue(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.pharmacyInvoicesService.getTotalRevenue(start, end);
  }

  @Get('pending-amount')
  getPendingAmount() {
    return this.pharmacyInvoicesService.getPendingAmount();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pharmacyInvoicesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePharmacyInvoiceDto: UpdatePharmacyInvoiceDto) {
    return this.pharmacyInvoicesService.update(id, updatePharmacyInvoiceDto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdatePharmacyInvoiceStatusDto) {
    return this.pharmacyInvoicesService.updateStatus(id, updateStatusDto);
  }

  @Post('mark-overdue')
  markOverdue() {
    return this.pharmacyInvoicesService.markOverdueInvoices();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pharmacyInvoicesService.remove(id);
  }
}
