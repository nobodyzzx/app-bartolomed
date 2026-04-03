import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import { AuthClinic } from '../../auth/decorators';
import { resolveClinicId } from '../../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permissions.enum';
import { ValidRoles } from '../../auth/interfaces';
import {
  CreatePharmacyInvoiceDto,
  UpdatePharmacyInvoiceDto,
  UpdatePharmacyInvoiceStatusDto,
} from '../dto/pharmacy-invoice.dto';
import { InvoiceStatus } from '../entities/pharmacy-invoice.entity';
import { PharmacyInvoicesService } from '../services/pharmacy-invoices.service';

@Controller('pharmacy-invoices')
@AuthClinic({ roles: [ValidRoles.PHARMACIST, ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN] })
@RequirePermissions(Permission.PharmacyBilling)
export class PharmacyInvoicesController {
  constructor(private readonly pharmacyInvoicesService: PharmacyInvoicesService) {}

  @Post()
  create(@Body() createPharmacyInvoiceDto: CreatePharmacyInvoiceDto, @Request() req: any) {
    const createdById = req.user?.sub || 'system';
    return this.pharmacyInvoicesService.create(createPharmacyInvoiceDto, createdById);
  }

  @Get()
  findAll(@Query('status') status?: InvoiceStatus, @Request() req?: any) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    if (status) {
      return this.pharmacyInvoicesService.getInvoicesByStatus(status, clinicId);
    }
    return this.pharmacyInvoicesService.findAll(clinicId);
  }

  @Get('overdue')
  getOverdue(@Request() req?: any) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.pharmacyInvoicesService.getOverdueInvoices(clinicId);
  }

  @Get('revenue')
  getTotalRevenue(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Request() req?: any) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.pharmacyInvoicesService.getTotalRevenue(start, end, clinicId);
  }

  @Get('pending-amount')
  getPendingAmount(@Request() req?: any) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.pharmacyInvoicesService.getPendingAmount(clinicId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const clinicId = resolveClinicId(req);
    return this.pharmacyInvoicesService.findOne(id, clinicId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePharmacyInvoiceDto: UpdatePharmacyInvoiceDto, @Request() req: any) {
    const clinicId = resolveClinicId(req);
    return this.pharmacyInvoicesService.update(id, updatePharmacyInvoiceDto, clinicId);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdatePharmacyInvoiceStatusDto, @Request() req: any) {
    const clinicId = resolveClinicId(req);
    return this.pharmacyInvoicesService.updateStatus(id, updateStatusDto, clinicId);
  }

  @Post('mark-overdue')
  markOverdue(@Request() req?: any) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.pharmacyInvoicesService.markOverdueInvoices(clinicId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    const clinicId = resolveClinicId(req);
    return this.pharmacyInvoicesService.remove(id, clinicId);
  }
}
