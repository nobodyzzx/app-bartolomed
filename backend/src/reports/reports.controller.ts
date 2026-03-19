import { Controller, Get, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { ReportsService, ReportFilters } from './services/reports.service';
import { Auth, AuthClinic } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';

@Controller('reports')
@AuthClinic()
@RequirePermissions(Permission.ReportsMedical, Permission.ReportsFinancial, Permission.ReportsStock)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private withClinicScope(filters: ReportFilters, req: Request): ReportFilters {
    const clinicId = resolveClinicId(req);
    return { ...filters, clinicId };
  }

  @Get('dashboard')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getDashboardReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getDashboardReport(this.withClinicScope(filters, req));
  }

  @Get('patients/demographics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getPatientDemographicsReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getPatientDemographicsReport(this.withClinicScope(filters, req));
  }

  @Get('appointments/statistics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getAppointmentStatisticsReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getAppointmentStatisticsReport(this.withClinicScope(filters, req));
  }

  @Get('doctors/performance')
  @Auth(ValidRoles.ADMIN)
  getDoctorPerformanceReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getDoctorPerformanceReport(this.withClinicScope(filters, req));
  }

  @Get('medical-records')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getMedicalRecordsReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getMedicalRecordsReport(this.withClinicScope(filters, req));
  }

  @Get('financial/summary')
  @Auth(ValidRoles.ADMIN)
  getFinancialSummaryReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getFinancialSummaryReport(this.withClinicScope(filters, req));
  }

  @Get('financial/payment-methods')
  @Auth(ValidRoles.ADMIN)
  getPaymentMethodReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getPaymentMethodReport(this.withClinicScope(filters, req));
  }

  @Get('inventory/stock')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getStockReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getStockReport(this.withClinicScope(filters, req));
  }
}
