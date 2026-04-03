import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Request } from '@nestjs/common';
import { AuthClinic } from '../../auth/decorators';
import { resolveClinicId } from '../../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permissions.enum';
import { ValidRoles } from '../../auth/interfaces';
import { CreatePharmacySaleDto, UpdatePharmacySaleDto, UpdatePharmacySaleStatusDto } from '../dto/pharmacy-sale.dto';
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
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
  ) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.pharmacySalesService.listWithFilters({
      status,
      clinicId,
      paymentMethod,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
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
