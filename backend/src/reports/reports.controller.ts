import {
  Controller,
  DefaultValuePipe,
  Get,
  Logger,
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
import { todayInClinicTz } from '../common/utils/date-format.util';
import { User } from '../users/entities/user.entity';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { AdvancedReportsService } from './services/advanced-reports.service';
import { ExportService } from './services/export.service';
import { ReportsPdfService } from './services/reports-pdf.service';
import { buildDateRange, ReportFilters, ReportsService } from './services/reports.service';
import { RevenueReportsService } from './services/revenue-reports.service';

@Controller('reports')
@AuthClinic()
@RequirePermissions(Permission.ReportsMedical, Permission.ReportsFinancial, Permission.ReportsStock)
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(
    private readonly reportsService: ReportsService,
    private readonly revenueReportsService: RevenueReportsService,
    private readonly advancedReportsService: AdvancedReportsService,
    private readonly exportService: ExportService,
    private readonly reportsPdfService: ReportsPdfService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private scope(filters: ReportFilters, req: Request): ReportFilters {
    // El rango de fechas se arma aquí desde los `startDate`/`endDate` planos de
    // la query: el frontend los manda sueltos, no como objeto anidado, así que
    // `filters.dateRange` llegaba siempre vacío y los reportes no filtraban.
    return {
      ...filters,
      clinicId: resolveClinicId(req)!,
      dateRange: buildDateRange(req.query as Record<string, unknown>),
    };
  }

  /**
   * El corte de turno es información de cuánto cobró/vendió una persona — no
   * es asunto de un colega verlo. Quien no sea admin solo puede pedir el
   * propio: se ignora cualquier `userId` que venga en la query y se fuerza al
   * del token, en vez de devolver 403 (más simple para el caso normal: la UI
   * ni le muestra la opción de elegir a otra persona).
   */
  private resolveStaffUserId(requestedUserId: string | undefined, user: User): string {
    const isAdmin = user.roles?.some(r => r === ValidRoles.ADMIN || r === ValidRoles.SUPER_ADMIN);
    return isAdmin && requestedUserId ? requestedUserId : user.id;
  }

  // ─── Reportes existentes (R-01..R-08) ────────────────────────────────────

  @Get('dashboard')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getDashboardReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getDashboardReport(this.scope(filters, req));
  }

  // Enfermería entra acá: tiene `ReportsMedical` en el mapa de permisos y la ruta
  // `/dashboard/reports` la lista en `allowedRoles`, pero el rol faltaba en estos dos
  // handlers, que son los únicos que pueblan la sección "Clínica". Resultado: la
  // pantalla cargaba, pedía los dos endpoints, recibía 403 en ambos y se quedaba con
  // los contadores en "—" y los gráficos en esqueleto para siempre. Son agregados
  // clínicos sin datos financieros ni de paciente identificable.
  @Get('patients/demographics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  getPatientDemographicsReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getPatientDemographicsReport(this.scope(filters, req));
  }

  @Get('appointments/statistics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  getAppointmentStatisticsReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getAppointmentStatisticsReport(this.scope(filters, req));
  }

  @Get('doctors/performance')
  @Auth(ValidRoles.ADMIN)
  getDoctorPerformanceReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getDoctorPerformanceReport(this.scope(filters, req));
  }

  @Get('medical-records')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  getMedicalRecordsReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.reportsService.getMedicalRecordsReport(this.scope(filters, req));
  }

  /**
   * Ingresos por origen: responde "¿cuánto ingresó la clínica y por qué
   * concepto?", que el reporte financiero clásico no puede porque lee
   * facturas sin desglose.
   */
  @Get('revenue/by-origin')
  @Auth(ValidRoles.ADMIN)
  getRevenueByOrigin(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.revenueReportsService.getRevenueByOrigin(this.scope(filters, req));
  }

  /**
   * Descuentos otorgados. Con autorización sin tope, es la única defensa que
   * queda: incluye los "absorbidos", que el recibo del paciente no muestra.
   */
  @Get('revenue/discounts')
  @Auth(ValidRoles.ADMIN)
  getDiscountsReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.revenueReportsService.getDiscountsReport(this.scope(filters, req));
  }

  /** Cuentas por cobrar: cargos generados que todavía nadie pagó. */
  @Get('revenue/receivables')
  @Auth(ValidRoles.ADMIN)
  getReceivables(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.revenueReportsService.getReceivables(this.scope(filters, req));
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
    try {
      const data = await this.advancedReportsService.getCriticalStockReport(this.scope(filters, req), expiryDays);
      const buf = await this.reportsPdfService.generateCriticalStockPdf(data);
      const filename = `stock-critico-${new Date().toISOString().slice(0, 10)}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.end(buf);
    } catch (e) {
      this.logger.error('[CriticalStockPdf ERROR]', e instanceof Error ? e.stack : String(e));
      res.status(500).json({ error: String(e) });
    }
  }

  /**
   * Control de ingresos en PDF: origen del dinero, descuentos otorgados y
   * cuentas por cobrar, en un solo documento.
   */
  @Get('export/pdf/revenue-control')
  @Auth(ValidRoles.ADMIN)
  async exportRevenueControlPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    try {
      const scoped = this.scope(filters, req);
      const [revenue, discounts, receivables] = await Promise.all([
        this.revenueReportsService.getRevenueByOrigin(scoped),
        this.revenueReportsService.getDiscountsReport(scoped),
        this.revenueReportsService.getReceivables(scoped),
      ]);
      const period = scoped.dateRange
        ? `${new Date(scoped.dateRange.startDate).toLocaleDateString('es-BO')} a ${new Date(scoped.dateRange.endDate).toLocaleDateString('es-BO')}`
        : undefined;

      const buf = await this.reportsPdfService.generateRevenueControlPdf({
        revenue,
        discounts,
        receivables,
        period,
      });
      const filename = `control-ingresos-${new Date().toISOString().slice(0, 10)}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.end(buf);
    } catch (e) {
      this.logger.error('[RevenueControlPdf ERROR]', e instanceof Error ? e.stack : String(e));
      res.status(500).json({ error: String(e) });
    }
  }

  /**
   * R-14b: Exportar eficiencia de traspasos a PDF.
   * GET /api/reports/export/pdf/transfer-efficiency
   */
  @Get('export/pdf/transfer-efficiency')
  @Auth(ValidRoles.ADMIN)
  async exportTransferEfficiencyPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.advancedReportsService.getTransferEfficiencyReport(this.scope(filters, req));
      const buf = await this.reportsPdfService.generateTransferEfficiencyPdf(data);
      const filename = `eficiencia-traspasos-${new Date().toISOString().slice(0, 10)}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.end(buf);
    } catch (e) {
      this.logger.error('[TransferEfficiencyPdf ERROR]', e instanceof Error ? e.stack : String(e));
      res.status(500).json({ error: String(e) });
    }
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
  async exportPharmacyConsumptionExcel(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getPharmacyConsumptionReport(this.scope(filters, req));
    await this.exportService.streamExcel(
      res,
      [{ name: 'Consumo', build: ws => this.exportService.buildConsumptionSheet(ws, data) }],
      `consumo-farmacia-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  // ─── Farmacia: reportes JSON (F1-R1..F3-R13) ─────────────────────────────

  @Get('pharmacy/rotation')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getRotationReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getRotationReport(this.scope(filters, req));
  }

  @Get('pharmacy/top-selling')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getTopSellingMedications(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getTopSellingMedications(this.scope(filters, req));
  }

  @Get('pharmacy/margins')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getProductMarginReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getProductMarginReport(this.scope(filters, req));
  }

  // Antes 'pharmacy/daily-sales': el reporte ya no es solo de farmacia
  // (incluye ingresos de la clínica vía charges/invoices), el nombre de la
  // ruta quedaba desalineado con lo que realmente devuelve.
  @Get('daily-sales')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getDailySalesSummary(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getDailySalesSummary(this.scope(filters, req));
  }

  @Get('pharmacy/expiry-buckets')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getExpiryBucketReport(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getExpiryBucketReport(this.scope(filters, req));
  }

  @Get('pharmacy/purchase-vs-consumption')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getPurchaseVsConsumption(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getPurchaseVsConsumption(this.scope(filters, req));
  }

  @Get('pharmacy/by-category')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getSalesByCategory(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getSalesByCategory(this.scope(filters, req));
  }

  @Get('pharmacy/stock-movements')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getStockMovementsReport(@Query() filters: ReportFilters & { medicationId?: string }, @Req() req: Request) {
    return this.advancedReportsService.getStockMovementsReport(this.scope(filters, req) as any);
  }

  @Get('pharmacy/suppliers')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getSupplierAnalysis(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getSupplierAnalysis(this.scope(filters, req));
  }

  @Get('pharmacy/prescription-summary')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getPrescriptionDispensingSummary(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getPrescriptionDispensingSummary(this.scope(filters, req));
  }

  @Get('pharmacy/credit-sales')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getCreditSales(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getCreditSales(this.scope(filters, req));
  }

  @Get('pharmacy/payment-methods')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getSalesByPaymentMethod(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getSalesByPaymentMethod(this.scope(filters, req));
  }

  @Get('pharmacy/profitability')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getMonthlyProfitability(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getMonthlyProfitability(this.scope(filters, req));
  }

  // ─── Farmacia: PDF exports ─────────────────────────────────────────────────

  @Get('export/pdf/pharmacy-rotation')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportRotationPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getRotationReport(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateRotationPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rotacion-stock-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  @Get('export/pdf/pharmacy-margins')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportMarginsPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getProductMarginReport(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateMarginsPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="margenes-producto-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  // Antes 'export/pdf/pharmacy-daily-sales' — ver nota en GET 'daily-sales'.
  @Get('export/pdf/daily-sales')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportDailySalesPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getDailySalesSummary(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateDailySalesPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      // todayInClinicTz(), no new Date().toISOString(): el nombre del archivo
      // salía fechado un día adelante al descargarlo de noche en Bolivia.
      'Content-Disposition',
      `attachment; filename="ventas-diarias-${todayInClinicTz()}.pdf"`,
    );
    res.end(buf);
  }

  @Get('export/pdf/pharmacy-expiry-buckets')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportExpiryBucketsPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getExpiryBucketReport(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateExpiryBucketsPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="vencimientos-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  @Get('export/pdf/pharmacy-profitability')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportProfitabilityPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getMonthlyProfitability(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateProfitabilityPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rentabilidad-mensual-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  // ─── Farmacia: Excel exports ───────────────────────────────────────────────

  @Get('export/excel/pharmacy-rotation')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportRotationExcel(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getRotationReport(this.scope(filters, req));
    await this.exportService.streamExcel(
      res,
      [{ name: 'Rotación Stock', build: ws => this.exportService.buildRotationSheet(ws, data) }],
      `rotacion-stock-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  @Get('export/excel/pharmacy-margins')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportMarginsExcel(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getProductMarginReport(this.scope(filters, req));
    await this.exportService.streamExcel(
      res,
      [{ name: 'Márgenes', build: ws => this.exportService.buildMarginsSheet(ws, data) }],
      `margenes-producto-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  @Get('export/excel/pharmacy-top-selling')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportTopSellingExcel(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getTopSellingMedications(this.scope(filters, req));
    await this.exportService.streamExcel(
      res,
      [{ name: 'Top Vendidos', build: ws => this.exportService.buildTopSellingSheet(ws, data) }],
      `top-vendidos-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  @Get('export/excel/pharmacy-stock-movements')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportStockMovementsExcel(
    @Query() filters: ReportFilters & { medicationId?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.advancedReportsService.getStockMovementsReport(this.scope(filters, req) as any);
    await this.exportService.streamExcel(
      res,
      [{ name: 'Kardex', build: ws => this.exportService.buildStockMovementsSheet(ws, data) }],
      `kardex-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  // ─── A1: Ventas por farmacéutico ──────────────────────────────────────────

  @Get('pharmacy/by-pharmacist')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getSalesByPharmacist(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getSalesByPharmacist(this.scope(filters, req));
  }

  @Get('export/pdf/pharmacy-by-pharmacist')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportSalesByPharmacistPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getSalesByPharmacist(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateSalesByPharmacistPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ventas-por-farmaceutico-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  @Get('export/excel/pharmacy-by-pharmacist')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportSalesByPharmacistExcel(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getSalesByPharmacist(this.scope(filters, req));
    await this.exportService.streamExcel(
      res,
      [{ name: 'Por Farmacéutico', build: ws => this.exportService.buildSalesByPharmacistSheet(ws, data) }],
      `ventas-farmaceutico-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  // ─── A2: Encargado × Día × Medicamento ───────────────────────────────────

  @Get('pharmacy/pharmacist-medication-day')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getSalesByPharmacistMedicationDay(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getSalesByPharmacistMedicationDay(this.scope(filters, req));
  }

  @Get('export/pdf/pharmacy-pharmacist-day')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportPharmacistDayPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getSalesByPharmacistMedicationDay(this.scope(filters, req));
    const buf = await this.reportsPdfService.generatePharmacistDayMedicationPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="detalle-encargado-dia-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  @Get('export/excel/pharmacy-pharmacist-day')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportPharmacistDayExcel(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getSalesByPharmacistMedicationDay(this.scope(filters, req));
    await this.exportService.streamExcel(
      res,
      [{ name: 'Encargado×Día×Med.', build: ws => this.exportService.buildPharmacistDayMedicationSheet(ws, data) }],
      `encargado-dia-medicamento-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  // ─── D1: Corte de turno individual ────────────────────────────────────────
  // No hay roles estancos en esta clínica — "quien cobra" suele ser el mismo
  // médico haciendo de recepcionista, laboratorista, etc. Por eso el reporte
  // es por persona (userId), no por rol, y junta farmacia + punto de cobro.

  @Get('staff-shift-detail')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST, ValidRoles.PHARMACIST, ValidRoles.LABORATORY)
  getStaffShiftDetail(@Query() filters: ReportFilters & { userId?: string }, @Req() req: Request, @GetUser() user: User) {
    const scoped = this.scope(filters, req);
    return this.advancedReportsService.getStaffShiftDetail({
      ...scoped,
      userId: this.resolveStaffUserId(filters.userId, user),
    });
  }

  @Get('export/pdf/staff-shift-detail')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST, ValidRoles.PHARMACIST, ValidRoles.LABORATORY)
  async exportStaffShiftDetailPdf(
    @Query() filters: ReportFilters & { userId?: string },
    @Req() req: Request,
    @Res() res: Response,
    @GetUser() user: User,
  ) {
    const scoped = this.scope(filters, req);
    const data = await this.advancedReportsService.getStaffShiftDetail({
      ...scoped,
      userId: this.resolveStaffUserId(filters.userId, user),
    });
    const buf = await this.reportsPdfService.generateStaffShiftDetailPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="corte-turno-${todayInClinicTz()}.pdf"`,
    );
    res.end(buf);
  }

  // ─── B1: Inventario valorizado ────────────────────────────────────────────

  @Get('pharmacy/inventory-valorized')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getValorizedInventory(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getValorizedInventory(this.scope(filters, req));
  }

  @Get('export/pdf/pharmacy-inventory-valorized')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportValorizedInventoryPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getValorizedInventory(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateValorizedInventoryPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="inventario-valorizado-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  @Get('export/excel/pharmacy-inventory-valorized')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportValorizedInventoryExcel(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getValorizedInventory(this.scope(filters, req));
    await this.exportService.streamExcel(
      res,
      [{ name: 'Inventario Valorizado', build: ws => this.exportService.buildValorizedInventorySheet(ws, data) }],
      `inventario-valorizado-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  /**
   * Listado compacto para imprimir y recorrer el estante: medicamento,
   * disponible, precio y estado. Reusa los datos del valorizado —son los
   * mismos— y solo cambia cómo se presentan: el valorizado ocupa 27 hojas para
   * 488 ítems y este entra en un tercio, a dos columnas por hoja.
   */
  @Get('export/pdf/pharmacy-inventory-list')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportInventoryListPdf(
    @Query() filters: ReportFilters,
    @Query('papel') papel: 'oficio' | 'a4' = 'oficio',
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.advancedReportsService.getValorizedInventory(this.scope(filters, req));
    // Oficio por defecto: es el papel de la impresora de la clínica y permite
    // tres columnas por hoja (7 hojas en vez de 10). `?papel=a4` da la versión
    // en A4 apaisado, a dos columnas.
    const buf = await this.reportsPdfService.generateInventoryListPdf(data, papel === 'a4' ? 'a4' : 'oficio');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="listado-inventario-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  // ─── B2: Inventario por categoría ────────────────────────────────────────

  @Get('pharmacy/inventory-by-category')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getInventoryByCategory(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getInventoryByCategory(this.scope(filters, req));
  }

  @Get('export/pdf/pharmacy-inventory-by-category')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportInventoryByCategoryPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getInventoryByCategory(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateInventoryByCategoryPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="inventario-categorias-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  // ─── B3: Sin movimiento ───────────────────────────────────────────────────

  @Get('pharmacy/no-movement')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getMedicationsWithoutMovement(
    @Query() filters: ReportFilters,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: Request,
  ) {
    return this.advancedReportsService.getMedicationsWithoutMovement(this.scope(filters, req), days);
  }

  @Get('export/pdf/pharmacy-no-movement')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportNoMovementPdf(
    @Query() filters: ReportFilters,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.advancedReportsService.getMedicationsWithoutMovement(this.scope(filters, req), days);
    const buf = await this.reportsPdfService.generateNoMovementPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sin-movimiento-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  @Get('export/excel/pharmacy-no-movement')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportNoMovementExcel(
    @Query() filters: ReportFilters,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.advancedReportsService.getMedicationsWithoutMovement(this.scope(filters, req), days);
    await this.exportService.streamExcel(
      res,
      [{ name: 'Sin Movimiento', build: ws => this.exportService.buildNoMovementSheet(ws, data) }],
      `sin-movimiento-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  // ─── C1: Ventas por medicamento detalle ──────────────────────────────────

  @Get('pharmacy/medication-detail')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getSalesByMedicationDetail(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getSalesByMedicationDetail(this.scope(filters, req));
  }

  @Get('export/pdf/pharmacy-medication-detail')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportMedicationDetailPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getSalesByMedicationDetail(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateMedicationDetailPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ventas-por-medicamento-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  @Get('export/excel/pharmacy-medication-detail')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportMedicationDetailExcel(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getSalesByMedicationDetail(this.scope(filters, req));
    await this.exportService.streamExcel(
      res,
      [{ name: 'Ventas por Medicamento', build: ws => this.exportService.buildMedicationDetailSheet(ws, data) }],
      `ventas-medicamento-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  // ─── C2: Receta vs Venta libre ────────────────────────────────────────────

  @Get('pharmacy/prescription-vs-free')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getPrescriptionVsFreeSales(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getPrescriptionVsFreeSales(this.scope(filters, req));
  }

  @Get('export/pdf/pharmacy-prescription-vs-free')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportPrescriptionVsFreePdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getPrescriptionVsFreeSales(this.scope(filters, req));
    const buf = await this.reportsPdfService.generatePrescriptionVsFreePdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="receta-vs-libre-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  // ─── C3: Ventas por método de pago (detallado) ───────────────────────────

  @Get('pharmacy/sales-by-payment')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getSalesByPaymentDetailed(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getSalesByPaymentDetailed(this.scope(filters, req));
  }

  @Get('export/pdf/pharmacy-sales-by-payment')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportSalesByPaymentPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getSalesByPaymentDetailed(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateSalesByPaymentMethodPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ventas-metodo-pago-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  @Get('export/excel/pharmacy-sales-by-payment')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportSalesByPaymentExcel(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getSalesByPaymentDetailed(this.scope(filters, req));
    await this.exportService.streamExcel(
      res,
      [{ name: 'Método de Pago', build: ws => this.exportService.buildSalesByPaymentMethodSheet(ws, data) }],
      `ventas-metodo-pago-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  // ─── C6: Comparativo mensual ─────────────────────────────────────────────

  @Get('pharmacy/monthly-comparison')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  getMonthlySalesComparison(@Query() filters: ReportFilters, @Req() req: Request) {
    return this.advancedReportsService.getMonthlySalesComparison(this.scope(filters, req));
  }

  @Get('export/pdf/pharmacy-monthly-comparison')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportMonthlySalesComparisonPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getMonthlySalesComparison(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateMonthlySalesComparisonPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="comparativo-mensual-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.end(buf);
  }

  @Get('export/excel/pharmacy-monthly-comparison')
  @Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
  async exportMonthlySalesComparisonExcel(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.advancedReportsService.getMonthlySalesComparison(this.scope(filters, req));
    await this.exportService.streamExcel(
      res,
      [{ name: 'Comparativo Mensual', build: ws => this.exportService.buildMonthlySalesComparisonSheet(ws, data) }],
      `comparativo-mensual-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  // ─── Exportación a PDF con gráficos (R-P1..R-P6) ─────────────────────────

  /**
   * R-P1: Reporte financiero completo con gráficos — PDF con gráficos.
   * GET /api/reports/export/pdf/financial
   */
  @Get('export/pdf/financial')
  @Auth(ValidRoles.ADMIN)
  async exportFinancialPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
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
   * R-P2: Demografía de pacientes — PDF con gráficos.
   * GET /api/reports/export/pdf/demographics
   */
  @Get('export/pdf/demographics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  async exportDemographicsPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.reportsService.getPatientDemographicsReport(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateDemographicsPdf(data);
    const filename = `demografia-pacientes-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buf);
  }

  /**
   * R-P3: Rendimiento de médicos — PDF con gráficos.
   * GET /api/reports/export/pdf/doctor-performance
   */
  @Get('export/pdf/doctor-performance')
  @Auth(ValidRoles.ADMIN)
  async exportDoctorPerformancePdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.reportsService.getDoctorPerformanceReport(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateDoctorPerformancePdf(data);
    const filename = `rendimiento-medicos-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buf);
  }

  /**
   * R-P4: Estadísticas de citas — PDF con gráficos.
   * GET /api/reports/export/pdf/appointments
   */
  @Get('export/pdf/appointments')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  async exportAppointmentsPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.reportsService.getAppointmentStatisticsReport(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateAppointmentsPdf(data);
    const filename = `estadisticas-citas-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buf);
  }

  /**
   * R-P5: Registros médicos — PDF con gráficos.
   * GET /api/reports/export/pdf/medical-records
   */
  @Get('export/pdf/medical-records')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  async exportMedicalRecordsPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.reportsService.getMedicalRecordsReport(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateMedicalRecordsPdf(data);
    const filename = `registros-medicos-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buf);
  }

  /**
   * R-P6: Dashboard general — PDF con gráficos.
   * GET /api/reports/export/pdf/dashboard
   */
  @Get('export/pdf/dashboard')
  @Auth(ValidRoles.ADMIN)
  async exportDashboardPdf(@Query() filters: ReportFilters, @Req() req: Request, @Res() res: Response) {
    const data = await this.reportsService.getDashboardReport(this.scope(filters, req));
    const buf = await this.reportsPdfService.generateDashboardPdf(data);
    const filename = `dashboard-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buf);
  }
}
