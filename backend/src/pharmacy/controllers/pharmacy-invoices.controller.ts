import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
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
    // req.user es la entidad User completa (JwtStrategy.validate) — no tiene `.sub`.
    // Bug real: el fallback 'system' era el único valor usado en la práctica y
    // siempre rompía el insert porque createdById es una columna uuid.
    const createdById = req.user?.id;
    if (!createdById) {
      throw new Error('User ID not found in request');
    }
    const clinicId = resolveClinicId(req)!;
    return this.pharmacyInvoicesService.create(createPharmacyInvoiceDto, createdById, clinicId);
  }

  @Get()
  findAll(
    @Query('status') status?: InvoiceStatus,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Request() req?: any,
  ) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.pharmacyInvoicesService.findAll(clinicId, status, page, limit);
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

  @Get('by-sale/:saleId')
  findBySale(@Param('saleId', ParseUUIDPipe) saleId: string, @Request() req: any) {
    const clinicId = resolveClinicId(req)!;
    return this.pharmacyInvoicesService.findBySale(saleId, clinicId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const clinicId = resolveClinicId(req);
    return this.pharmacyInvoicesService.findOne(id, clinicId);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updatePharmacyInvoiceDto: UpdatePharmacyInvoiceDto, @Request() req: any) {
    const clinicId = resolveClinicId(req);
    return this.pharmacyInvoicesService.update(id, updatePharmacyInvoiceDto, clinicId);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() updateStatusDto: UpdatePharmacyInvoiceStatusDto, @Request() req: any) {
    const clinicId = resolveClinicId(req);
    return this.pharmacyInvoicesService.updateStatus(id, updateStatusDto, clinicId);
  }

  @Post('mark-overdue')
  markOverdue(@Request() req?: any) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.pharmacyInvoicesService.markOverdueInvoices(clinicId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const clinicId = resolveClinicId(req);
    return this.pharmacyInvoicesService.remove(id, clinicId);
  }
}
