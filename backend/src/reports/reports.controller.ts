import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService, ReportFilters } from './services/reports.service';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getDashboardReport(@Query() filters: ReportFilters) {
    return this.reportsService.getDashboardReport(filters);
  }

  @Get('patients/demographics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getPatientDemographicsReport(@Query() filters: ReportFilters) {
    return this.reportsService.getPatientDemographicsReport(filters);
  }

  @Get('appointments/statistics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getAppointmentStatisticsReport(@Query() filters: ReportFilters) {
    return this.reportsService.getAppointmentStatisticsReport(filters);
  }

  @Get('doctors/performance')
  @Auth(ValidRoles.ADMIN)
  getDoctorPerformanceReport(@Query() filters: ReportFilters) {
    return this.reportsService.getDoctorPerformanceReport(filters);
  }

  @Get('medical-records')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getMedicalRecordsReport(@Query() filters: ReportFilters) {
    return this.reportsService.getMedicalRecordsReport(filters);
  }

  @Get('financial/summary')
  @Auth(ValidRoles.ADMIN)
  getFinancialSummaryReport(@Query() filters: ReportFilters) {
    return this.reportsService.getFinancialSummaryReport(filters);
  }

  @Get('financial/payment-methods')
  @Auth(ValidRoles.ADMIN)
  getPaymentMethodReport(@Query() filters: ReportFilters) {
    return this.reportsService.getPaymentMethodReport(filters);
  }

  @Get('inventory/stock')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getStockReport(@Query() filters: ReportFilters) {
    return this.reportsService.getStockReport(filters);
  }
}
