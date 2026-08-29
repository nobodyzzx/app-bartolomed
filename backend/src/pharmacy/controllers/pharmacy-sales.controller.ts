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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthClinic } from '../../auth/decorators';
import { SkipAutoAudit } from '../../audit/decorators/skip-auto-audit.decorator';
import { resolveClinicId } from '../../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permissions.enum';
import { ValidRoles } from '../../auth/interfaces';
import {
  AdjustPaymentDto,
  CreatePharmacySaleDto,
  UpdatePharmacySaleDto,
  UpdatePharmacySaleStatusDto,
} from '../dto/pharmacy-sale.dto';
import { SaleStatus } from '../entities/pharmacy-sale.entity';
import { PharmacySalesService } from '../services/pharmacy-sales.service';

@Controller('pharmacy-sales')
@AuthClinic({ roles: [ValidRoles.PHARMACIST, ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN] })
@RequirePermissions(Permission.PharmacyDispense, Permission.PharmacyBilling)
export class PharmacySalesController {
  constructor(private readonly pharmacySalesService: PharmacySalesService) {}

  @Post()
  create(@Body() createPharmacySaleDto: CreatePharmacySaleDto, @Request() req: any) {
    const soldById = req.user?.id || req.user?.sub;
    if (!soldById) {
      throw new Error('User ID not found in request');
    }
    const clinicId = resolveClinicId(req)!;
    return this.pharmacySalesService.create(createPharmacySaleDto, soldById, clinicId);
  }

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('status') status?: SaleStatus,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    // El servicio valida `sortBy` contra su lista blanca: `orderBy()` interpola
    // sin parametrizar, así que no puede llegar texto libre a la consulta.
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'ASC' | 'DESC',
    @Request() req?: any,
  ) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.pharmacySalesService.listWithFilters({
      status,
      clinicId,
      paymentMethod,
      search,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
      sortBy,
      sortDir,
    });
  }

  @Get('daily-total/:date')
  getDailyTotal(@Param('date') date: string, @Request() req: any) {
    const clinicId = resolveClinicId(req);
    return this.pharmacySalesService.getDailySalesTotal(new Date(date), clinicId);
  }

  @Get('summary')
  getSummary(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Request() req?: any) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.pharmacySalesService.getSalesSummary(start, end, clinicId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const clinicId = resolveClinicId(req);
    return this.pharmacySalesService.findOne(id, clinicId);
  }

  /** Recibo en PDF — reemplaza el print() de pantalla de la ficha de venta. */
  @Get(':id/receipt')
  async receipt(@Param('id', ParseUUIDPipe) id: string, @Request() req: any, @Res() res: Response) {
    const clinicId = resolveClinicId(req);
    const { buffer, fileName } = await this.pharmacySalesService.buildReceipt(id, clinicId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updatePharmacySaleDto: UpdatePharmacySaleDto, @Request() req: any) {
    const clinicId = resolveClinicId(req)!;
    return this.pharmacySalesService.update(id, updatePharmacySaleDto, clinicId);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() updateStatusDto: UpdatePharmacySaleStatusDto, @Request() req: any) {
    const clinicId = resolveClinicId(req)!;
    const user = req.user;
    return this.pharmacySalesService.updateStatus(id, updateStatusDto, clinicId, {
      id: user?.id ?? user?.sub,
      email: user?.email ?? '',
      name: user?.personalInfo
        ? `${user.personalInfo.firstName ?? ''} ${user.personalInfo.lastName ?? ''}`.trim()
        : undefined,
      ip: req.ip,
    });
  }

  @Patch(':id/adjust-payment')
  @SkipAutoAudit()
  adjustPayment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdjustPaymentDto, @Request() req: any) {
    const user = req.user;
    return this.pharmacySalesService.adjustPayment(id, dto, {
      id: user?.id ?? user?.sub,
      email: user?.email ?? '',
      name: user?.personalInfo
        ? `${user.personalInfo.firstName ?? ''} ${user.personalInfo.lastName ?? ''}`.trim()
        : undefined,
      clinicId: resolveClinicId(req) ?? undefined,
      ip: req.ip,
    });
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const clinicId = resolveClinicId(req)!;
    return this.pharmacySalesService.remove(id, clinicId);
  }
}
