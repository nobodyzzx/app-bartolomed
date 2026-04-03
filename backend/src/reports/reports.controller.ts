import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Auth, AuthClinic, GetUser } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { AdvancedReportsService } from './services/advanced-reports.service';
import { ExportService } from './services/export.service';
import { ReportsPdfService } from './services/reports-pdf.service';
import { ReportFilters, ReportsService } from './services/reports.service';

@Controller('reports')
@AuthClinic()
@RequirePermissions(Permission.ReportsMedical, Permission.ReportsFinancial, Permission.ReportsStock)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly advancedReportsService: AdvancedReportsService,
    private readonly exportService: ExportService,
    private readonly reportsPdfService: ReportsPdfService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private scope(filters: ReportFilters, req: Request): ReportFilters {
    return { ...filters, clinicId: resolveClinicId(req)! };
  }

  // ─── Reportes existentes (R-01..R-08) ────────────────────────────────────

  @Get('dashboard')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getDashboardReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getDashboardReport(this.scope(filters, req));
  }

  @Get('patients/demographics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getPatientDemographicsReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getPatientDemographicsReport(this.scope(filters, req));
  }

  @Get('appointments/statistics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getAppointmentStatisticsReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getAppointmentStatisticsReport(this.scope(filters, req));
  }

  @Get('doctors/performance')
  @Auth(ValidRoles.ADMIN)
  getDoctorPerformanceReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getDoctorPerformanceReport(this.scope(filters, req));
  }

  @Get('medical-records')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getMedicalRecordsReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getMedicalRecordsReport(this.scope(filters, req));
  }

  @Get('financial/summary')
  @Auth(ValidRoles.ADMIN)
  getFinancialSummaryReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getFinancialSummaryReport(this.scope(filters, req));
  }

  @Get('financial/payment-methods')
  @Auth(ValidRoles.ADMIN)
  getPaymentMethodReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getPaymentMethodReport(this.scope(filters, req));
  }

  @Get('inventory/stock')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getStockReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getStockReport(this.scope(filters, req));
  }

  // ─── Nuevos reportes (R-09..R-13) ────────────────────────────────────────

  /**
   * R-09: Salida de medicamentos vs. ingresos por traspasos.
   * GET /api/reports/pharmacy/consumption?startDate=&endDate=
   */
  @Get('pharmacy/consumption')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getPharmacyConsumption(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getPharmacyConsumptionReport(this.scope(filters, req));
  }

  /**
   * R-10: Timeline unificado de un paciente (citas, registros, recetas, ventas).
   * GET /api/reports/patients/:id/timeline
   */
  @Get('patients/:id/timeline')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  getPatientTimeline(@Param('id', ParseUUIDPipe) patientId: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req)!;
    return this.advancedReportsService.getPatientTimeline(patientId, clinicId);
  }

  /**
   * R-11: KPI de eficiencia de traspasos + traslados detenidos > 48h.
   * GET /api/reports/transfers/efficiency?startDate=&endDate=
   */
  @Get('transfers/efficiency')
  @Auth(ValidRoles.ADMIN)
  getTransferEfficiency(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getTransferEfficiencyReport(this.scope(filters, req));
  }

  /**
   * R-12: Stock bajo mínimo, próximo a vencer y vencido.
   * GET /api/reports/inventory/critical?expiryDays=60
   */
  @Get('inventory/critical')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getCriticalStock(
    @Query() filters: ReportFilters,
    @Query('expiryDays', new DefaultValuePipe(60), ParseIntPipe) expiryDays: number,
    @Req() req: Request,
  ) {
    return this.advancedReportsService.getCriticalStockReport(this.scope(filters, req), expiryDays);
  }

  /**
   * R-13: Auditoría de recetas — lo prescrito vs. lo entregado en farmacia.
   * GET /api/reports/audit/prescriptions?doctorId=&startDate=&endDate=
   */
  @Get('audit/prescriptions')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getPrescriptionAudit(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getPrescriptionDispensationAudit(this.scope(filters, req));
  }

  // ─── Exportación (R-14 PDF, R-15 Excel) ──────────────────────────────────

  /**
   * R-14: Exportar stock crítico a PDF.
   * GET /api/reports/export/pdf/critical-stock
   */
  @Get('export/pdf/critical-stock')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportCriticalStockPdf(
    @Query() filters: ReportFilters,
    @Query('expiryDays', new DefaultValuePipe(60), ParseIntPipe) expiryDays: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.advancedReportsService.getCriticalStockReport(this.scope(filters, req), expiryDays);
    this.exportService.streamPdf(
      res,
      'Reporte de Stock Crítico',
      doc => this.exportService.buildCriticalStockPdf(doc, data),
      `stock-critico-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  }

  /**
   * R-14b: Exportar eficiencia de traspasos a PDF.
   * GET /api/reports/export/pdf/transfer-efficiency
   */
  @Get('export/pdf/transfer-efficiency')
  @Auth(ValidRoles.ADMIN)
  async exportTransferEfficiencyPdf(
    @Query() filters: ReportFilters,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.advancedReportsService.getTransferEfficiencyReport(this.scope(filters, req));
    this.exportService.streamPdf(
      res,
      'Reporte de Eficiencia de Traspasos',
      doc => this.exportService.buildTransferEfficiencyPdf(doc, data),
      `eficiencia-traspasos-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  }

  /**
   * R-15: Exportar stock crítico a Excel.
   * GET /api/reports/export/excel/critical-stock
   */
  @Get('export/excel/critical-stock')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportCriticalStockExcel(
    @Query() filters: ReportFilters,
    @Query('expiryDays', new DefaultValuePipe(60), ParseIntPipe) expiryDays: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.advancedReportsService.getCriticalStockReport(this.scope(filters, req), expiryDays);
    await this.exportService.streamExcel(
      res,
      [{ name: 'Stock Crítico', build: ws => this.exportService.buildCriticalStockSheet(ws, data) }],
      `stock-critico-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  /**
   * R-15b: Exportar consumo de farmacia a Excel (2 hojas).
   * GET /api/reports/export/excel/pharmacy-consumption
   */
  @Get('export/excel/pharmacy-consumption')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportPharmacyConsumptionExcel(
    @Query() filters: ReportFilters,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.advancedReportsService.getPharmacyConsumptionReport(this.scope(filters, req));
    await this.exportService.streamExcel(
      res,
      [{ name: 'Consumo', build: ws => this.exportService.buildConsumptionSheet(ws, data) }],
      `consumo-farmacia-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  // ─── Exportación Puppeteer HTML→PDF (R-P1..R-P5) ─────────────────────────

  /**
   * R-P1: Reporte financiero completo con gráficos — Puppeteer PDF.
   * GET /api/reports/export/pdf/financial
   */
  @Get('export/pdf/financial')
  @Auth(ValidRoles.ADMIN)
  async exportFinancialPdf(
    @Query() filters: ReportFilters,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const scoped = this.scope(filters, req);
    const [summary, payments] = await Promise.all([
      this.reportsService.getFinancialSummaryReport(scoped),
      this.reportsService.getPaymentMethodReport(scoped),
    ]);
    const data = { ...summary, paymentMethods: (payments as any).paymentMethods ?? [] };
    const buf = await this.reportsPdfService.generateFinancialPdf(data);
    const filename = `reporte-financiero-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buf);
  }

  /**
   * R-P2: Demografía de pacientes — Puppeteer PDF.
   * GET /api/reports/export/pdf/demographics
   */
  @Get('export/pdf/demographics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  async exportDemographicsPdf(
    @Query() filters: ReportFilters,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.getPatientDemographicsReport(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateDemographicsPdf(data);
    const filename = `demografia-pacientes-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buf);
  }

  /**
   * R-P3: Rendimiento de médicos — Puppeteer PDF.
   * GET /api/reports/export/pdf/doctor-performance
   */
  @Get('export/pdf/doctor-performance')
  @Auth(ValidRoles.ADMIN)
  async exportDoctorPerformancePdf(
    @Query() filters: ReportFilters,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.getDoctorPerformanceReport(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateDoctorPerformancePdf(data);
    const filename = `rendimiento-medicos-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buf);
  }

  /**
   * R-P4: Estadísticas de citas — Puppeteer PDF.
   * GET /api/reports/export/pdf/appointments
   */
  @Get('export/pdf/appointments')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  async exportAppointmentsPdf(
    @Query() filters: ReportFilters,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.getAppointmentStatisticsReport(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateAppointmentsPdf(data);
    const filename = `estadisticas-citas-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buf);
  }

  /**
   * R-P5: Registros médicos — Puppeteer PDF.
   * GET /api/reports/export/pdf/medical-records
   */
  @Get('export/pdf/medical-records')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  async exportMedicalRecordsPdf(
    @Query() filters: ReportFilters,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.getMedicalRecordsReport(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateMedicalRecordsPdf(data);
    const filename = `registros-medicos-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buf);
  }

  /**
   * R-P6: Dashboard general — Puppeteer PDF.
   * GET /api/reports/export/pdf/dashboard
   */
  @Get('export/pdf/dashboard')
  @Auth(ValidRoles.ADMIN)
  async exportDashboardPdf(
    @Query() filters: ReportFilters,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.getDashboardReport(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateDashboardPdf(data);
    const filename = `dashboard-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buf);
  }
}
