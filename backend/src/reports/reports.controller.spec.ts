import { ReportsController } from './reports.controller';
import { ReportsService } from './services/reports.service';
import { RevenueReportsService } from './services/revenue-reports.service';
import { AdvancedReportsService } from './services/advanced-reports.service';
import { ExportService } from './services/export.service';
import { ReportsPdfService } from './services/reports-pdf.service';

const CLINIC_ID = 'clinic-1';
const filters = { startDate: '2026-01-01', endDate: '2026-01-31' } as any;
const scoped = { ...filters, clinicId: CLINIC_ID };

const makeReq = () => ({ headers: { 'x-clinic-id': CLINIC_ID }, params: {} }) as any;
const makeRes = () =>
  ({
    setHeader: jest.fn(),
    end: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }) as any;

const dispositionOf = (res: any) =>
  (res.setHeader as jest.Mock).mock.calls.find((c: any[]) => c[0] === 'Content-Disposition')?.[1] as string;

const mockAll = (methods: string[]) => {
  const target: any = {};
  for (const m of methods) target[m] = jest.fn().mockResolvedValue({ result: m });
  return target;
};

describe('ReportsController', () => {
  let controller: ReportsController;
  let reportsService: jest.Mocked<ReportsService>;
  let revenueReportsService: jest.Mocked<RevenueReportsService>;
  let advancedReportsService: jest.Mocked<AdvancedReportsService>;
  let exportService: jest.Mocked<ExportService>;
  let reportsPdfService: jest.Mocked<ReportsPdfService>;

  beforeEach(() => {
    reportsService = mockAll([
      'getDashboardReport',
      'getPatientDemographicsReport',
      'getAppointmentStatisticsReport',
      'getDoctorPerformanceReport',
      'getMedicalRecordsReport',
      'getFinancialSummaryReport',
      'getPaymentMethodReport',
      'getStockReport',
    ]);
    advancedReportsService = mockAll([
      'getPharmacyConsumptionReport',
      'getPatientTimeline',
      'getTransferEfficiencyReport',
      'getCriticalStockReport',
      'getPrescriptionDispensationAudit',
      'getRotationReport',
      'getTopSellingMedications',
      'getProductMarginReport',
      'getDailySalesSummary',
      'getExpiryBucketReport',
      'getPurchaseVsConsumption',
      'getSalesByCategory',
      'getStockMovementsReport',
      'getSupplierAnalysis',
      'getPrescriptionDispensingSummary',
      'getCreditSales',
      'getSalesByPaymentMethod',
      'getMonthlyProfitability',
      'getSalesByPharmacist',
      'getSalesByPharmacistMedicationDay',
      'getValorizedInventory',
      'getInventoryByCategory',
      'getMedicationsWithoutMovement',
      'getSalesByMedicationDetail',
      'getPrescriptionVsFreeSales',
      'getSalesByPaymentDetailed',
      'getMonthlySalesComparison',
    ]);
    exportService = {
      streamExcel: jest.fn().mockResolvedValue(undefined),
      buildCriticalStockSheet: jest.fn(),
      buildConsumptionSheet: jest.fn(),
      buildRotationSheet: jest.fn(),
      buildMarginsSheet: jest.fn(),
      buildTopSellingSheet: jest.fn(),
      buildStockMovementsSheet: jest.fn(),
      buildSalesByPharmacistSheet: jest.fn(),
      buildPharmacistDayMedicationSheet: jest.fn(),
      buildValorizedInventorySheet: jest.fn(),
      buildMedicationDetailSheet: jest.fn(),
      buildSalesByPaymentMethodSheet: jest.fn(),
      buildMonthlySalesComparisonSheet: jest.fn(),
      buildNoMovementSheet: jest.fn(),
    } as unknown as jest.Mocked<ExportService>;
    reportsPdfService = mockAll([
      'generateCriticalStockPdf',
      'generateTransferEfficiencyPdf',
      'generateRotationPdf',
      'generateMarginsPdf',
      'generateDailySalesPdf',
      'generateExpiryBucketsPdf',
      'generateProfitabilityPdf',
      'generateSalesByPharmacistPdf',
      'generatePharmacistDayMedicationPdf',
      'generateValorizedInventoryPdf',
      'generateInventoryByCategoryPdf',
      'generateNoMovementPdf',
      'generateMedicationDetailPdf',
      'generatePrescriptionVsFreePdf',
      'generateSalesByPaymentMethodPdf',
      'generateMonthlySalesComparisonPdf',
      'generateFinancialPdf',
      'generateDemographicsPdf',
      'generateDoctorPerformancePdf',
      'generateAppointmentsPdf',
      'generateMedicalRecordsPdf',
      'generateDashboardPdf',
    ]);
    revenueReportsService = mockAll(['getRevenueByOrigin', 'getDiscountsReport', 'getReceivables']);
    controller = new ReportsController(
      reportsService,
      revenueReportsService,
      advancedReportsService,
      exportService,
      reportsPdfService,
    );
  });

  describe('reportes JSON simples (scope() aplica clinicId resuelto del request)', () => {
    // Cada caso guarda getters (no la referencia directa al mock) porque el array
    // se evalúa antes de que beforeEach() asigne los mocks a las variables outer.
    const cases: Array<[string, () => Promise<any>, () => any]> = [
      [
        'getDashboardReport',
        () => controller.getDashboardReport(filters, makeReq()),
        () => reportsService.getDashboardReport,
      ],
      [
        'getPatientDemographicsReport',
        () => controller.getPatientDemographicsReport(filters, makeReq()),
        () => reportsService.getPatientDemographicsReport,
      ],
      [
        'getAppointmentStatisticsReport',
        () => controller.getAppointmentStatisticsReport(filters, makeReq()),
        () => reportsService.getAppointmentStatisticsReport,
      ],
      [
        'getDoctorPerformanceReport',
        () => controller.getDoctorPerformanceReport(filters, makeReq()),
        () => reportsService.getDoctorPerformanceReport,
      ],
      [
        'getMedicalRecordsReport',
        () => controller.getMedicalRecordsReport(filters, makeReq()),
        () => reportsService.getMedicalRecordsReport,
      ],
      [
        'getFinancialSummaryReport',
        () => controller.getFinancialSummaryReport(filters, makeReq()),
        () => reportsService.getFinancialSummaryReport,
      ],
      [
        'getPaymentMethodReport',
        () => controller.getPaymentMethodReport(filters, makeReq()),
        () => reportsService.getPaymentMethodReport,
      ],
      ['getStockReport', () => controller.getStockReport(filters, makeReq()), () => reportsService.getStockReport],
      [
        'getPharmacyConsumption',
        () => controller.getPharmacyConsumption(filters, makeReq()),
        () => advancedReportsService.getPharmacyConsumptionReport,
      ],
      [
        'getTransferEfficiency',
        () => controller.getTransferEfficiency(filters, makeReq()),
        () => advancedReportsService.getTransferEfficiencyReport,
      ],
      [
        'getPrescriptionAudit',
        () => controller.getPrescriptionAudit(filters, makeReq()),
        () => advancedReportsService.getPrescriptionDispensationAudit,
      ],
      [
        'getRotationReport',
        () => controller.getRotationReport(filters, makeReq()),
        () => advancedReportsService.getRotationReport,
      ],
      [
        'getTopSellingMedications',
        () => controller.getTopSellingMedications(filters, makeReq()),
        () => advancedReportsService.getTopSellingMedications,
      ],
      [
        'getProductMarginReport',
        () => controller.getProductMarginReport(filters, makeReq()),
        () => advancedReportsService.getProductMarginReport,
      ],
      [
        'getDailySalesSummary',
        () => controller.getDailySalesSummary(filters, makeReq()),
        () => advancedReportsService.getDailySalesSummary,
      ],
      [
        'getExpiryBucketReport',
        () => controller.getExpiryBucketReport(filters, makeReq()),
        () => advancedReportsService.getExpiryBucketReport,
      ],
      [
        'getPurchaseVsConsumption',
        () => controller.getPurchaseVsConsumption(filters, makeReq()),
        () => advancedReportsService.getPurchaseVsConsumption,
      ],
      [
        'getSalesByCategory',
        () => controller.getSalesByCategory(filters, makeReq()),
        () => advancedReportsService.getSalesByCategory,
      ],
      [
        'getSupplierAnalysis',
        () => controller.getSupplierAnalysis(filters, makeReq()),
        () => advancedReportsService.getSupplierAnalysis,
      ],
      [
        'getPrescriptionDispensingSummary',
        () => controller.getPrescriptionDispensingSummary(filters, makeReq()),
        () => advancedReportsService.getPrescriptionDispensingSummary,
      ],
      [
        'getCreditSales',
        () => controller.getCreditSales(filters, makeReq()),
        () => advancedReportsService.getCreditSales,
      ],
      [
        'getSalesByPaymentMethod',
        () => controller.getSalesByPaymentMethod(filters, makeReq()),
        () => advancedReportsService.getSalesByPaymentMethod,
      ],
      [
        'getMonthlyProfitability',
        () => controller.getMonthlyProfitability(filters, makeReq()),
        () => advancedReportsService.getMonthlyProfitability,
      ],
      [
        'getSalesByPharmacist',
        () => controller.getSalesByPharmacist(filters, makeReq()),
        () => advancedReportsService.getSalesByPharmacist,
      ],
      [
        'getSalesByPharmacistMedicationDay',
        () => controller.getSalesByPharmacistMedicationDay(filters, makeReq()),
        () => advancedReportsService.getSalesByPharmacistMedicationDay,
      ],
      [
        'getValorizedInventory',
        () => controller.getValorizedInventory(filters, makeReq()),
        () => advancedReportsService.getValorizedInventory,
      ],
      [
        'getInventoryByCategory',
        () => controller.getInventoryByCategory(filters, makeReq()),
        () => advancedReportsService.getInventoryByCategory,
      ],
      [
        'getSalesByMedicationDetail',
        () => controller.getSalesByMedicationDetail(filters, makeReq()),
        () => advancedReportsService.getSalesByMedicationDetail,
      ],
      [
        'getPrescriptionVsFreeSales',
        () => controller.getPrescriptionVsFreeSales(filters, makeReq()),
        () => advancedReportsService.getPrescriptionVsFreeSales,
      ],
      [
        'getSalesByPaymentDetailed',
        () => controller.getSalesByPaymentDetailed(filters, makeReq()),
        () => advancedReportsService.getSalesByPaymentDetailed,
      ],
      [
        'getMonthlySalesComparison',
        () => controller.getMonthlySalesComparison(filters, makeReq()),
        () => advancedReportsService.getMonthlySalesComparison,
      ],
    ];

    it.each(cases)('%s delega en el service correcto con clinicId inyectado', async (_name, call, getMock) => {
      const result = await call();
      expect(getMock()).toHaveBeenCalledWith(scoped);
      expect(result).toEqual({ result: expect.any(String) });
    });
  });

  it('getPatientTimeline delega patientId y clinicId (no usa scope())', async () => {
    await controller.getPatientTimeline('patient-1', makeReq());
    expect(advancedReportsService.getPatientTimeline).toHaveBeenCalledWith('patient-1', CLINIC_ID);
  });

  describe('parámetros extra con DefaultValuePipe', () => {
    it('getCriticalStock usa expiryDays=60 por defecto', async () => {
      await controller.getCriticalStock(filters, 60, makeReq());
      expect(advancedReportsService.getCriticalStockReport).toHaveBeenCalledWith(scoped, 60);
    });

    it('getCriticalStock respeta expiryDays custom', async () => {
      await controller.getCriticalStock(filters, 90, makeReq());
      expect(advancedReportsService.getCriticalStockReport).toHaveBeenCalledWith(scoped, 90);
    });

    it('getStockMovementsReport pasa el filtro con medicationId incluido', async () => {
      const f = { ...filters, medicationId: 'med-1' };
      await controller.getStockMovementsReport(f, makeReq());
      expect(advancedReportsService.getStockMovementsReport).toHaveBeenCalledWith({ ...f, clinicId: CLINIC_ID });
    });

    it('getMedicationsWithoutMovement usa days=30 por defecto', async () => {
      await controller.getMedicationsWithoutMovement(filters, 30, makeReq());
      expect(advancedReportsService.getMedicationsWithoutMovement).toHaveBeenCalledWith(scoped, 30);
    });

    it('getMedicationsWithoutMovement respeta days custom', async () => {
      await controller.getMedicationsWithoutMovement(filters, 90, makeReq());
      expect(advancedReportsService.getMedicationsWithoutMovement).toHaveBeenCalledWith(scoped, 90);
    });
  });

  describe('exports PDF simples (fetch → generate → headers → res.end)', () => {
    const cases: Array<[string, (req: any, res: any) => Promise<any>, () => any, () => any, string]> = [
      [
        'exportRotationPdf',
        (req, res) => controller.exportRotationPdf(filters, req, res),
        () => advancedReportsService.getRotationReport,
        () => reportsPdfService.generateRotationPdf,
        'rotacion-stock-',
      ],
      [
        'exportMarginsPdf',
        (req, res) => controller.exportMarginsPdf(filters, req, res),
        () => advancedReportsService.getProductMarginReport,
        () => reportsPdfService.generateMarginsPdf,
        'margenes-producto-',
      ],
      [
        'exportDailySalesPdf',
        (req, res) => controller.exportDailySalesPdf(filters, req, res),
        () => advancedReportsService.getDailySalesSummary,
        () => reportsPdfService.generateDailySalesPdf,
        'ventas-diarias-',
      ],
      [
        'exportExpiryBucketsPdf',
        (req, res) => controller.exportExpiryBucketsPdf(filters, req, res),
        () => advancedReportsService.getExpiryBucketReport,
        () => reportsPdfService.generateExpiryBucketsPdf,
        'vencimientos-',
      ],
      [
        'exportProfitabilityPdf',
        (req, res) => controller.exportProfitabilityPdf(filters, req, res),
        () => advancedReportsService.getMonthlyProfitability,
        () => reportsPdfService.generateProfitabilityPdf,
        'rentabilidad-mensual-',
      ],
      [
        'exportSalesByPharmacistPdf',
        (req, res) => controller.exportSalesByPharmacistPdf(filters, req, res),
        () => advancedReportsService.getSalesByPharmacist,
        () => reportsPdfService.generateSalesByPharmacistPdf,
        'ventas-por-farmaceutico-',
      ],
      [
        'exportPharmacistDayPdf',
        (req, res) => controller.exportPharmacistDayPdf(filters, req, res),
        () => advancedReportsService.getSalesByPharmacistMedicationDay,
        () => reportsPdfService.generatePharmacistDayMedicationPdf,
        'detalle-encargado-dia-',
      ],
      [
        'exportValorizedInventoryPdf',
        (req, res) => controller.exportValorizedInventoryPdf(filters, req, res),
        () => advancedReportsService.getValorizedInventory,
        () => reportsPdfService.generateValorizedInventoryPdf,
        'inventario-valorizado-',
      ],
      [
        'exportInventoryByCategoryPdf',
        (req, res) => controller.exportInventoryByCategoryPdf(filters, req, res),
        () => advancedReportsService.getInventoryByCategory,
        () => reportsPdfService.generateInventoryByCategoryPdf,
        'inventario-categorias-',
      ],
      [
        'exportMedicationDetailPdf',
        (req, res) => controller.exportMedicationDetailPdf(filters, req, res),
        () => advancedReportsService.getSalesByMedicationDetail,
        () => reportsPdfService.generateMedicationDetailPdf,
        'ventas-por-medicamento-',
      ],
      [
        'exportPrescriptionVsFreePdf',
        (req, res) => controller.exportPrescriptionVsFreePdf(filters, req, res),
        () => advancedReportsService.getPrescriptionVsFreeSales,
        () => reportsPdfService.generatePrescriptionVsFreePdf,
        'receta-vs-libre-',
      ],
      [
        'exportSalesByPaymentPdf',
        (req, res) => controller.exportSalesByPaymentPdf(filters, req, res),
        () => advancedReportsService.getSalesByPaymentDetailed,
        () => reportsPdfService.generateSalesByPaymentMethodPdf,
        'ventas-metodo-pago-',
      ],
      [
        'exportMonthlySalesComparisonPdf',
        (req, res) => controller.exportMonthlySalesComparisonPdf(filters, req, res),
        () => advancedReportsService.getMonthlySalesComparison,
        () => reportsPdfService.generateMonthlySalesComparisonPdf,
        'comparativo-mensual-',
      ],
      [
        'exportDemographicsPdf',
        (req, res) => controller.exportDemographicsPdf(filters, req, res),
        () => reportsService.getPatientDemographicsReport,
        () => reportsPdfService.generateDemographicsPdf,
        'demografia-pacientes-',
      ],
      [
        'exportDoctorPerformancePdf',
        (req, res) => controller.exportDoctorPerformancePdf(filters, req, res),
        () => reportsService.getDoctorPerformanceReport,
        () => reportsPdfService.generateDoctorPerformancePdf,
        'rendimiento-medicos-',
      ],
      [
        'exportAppointmentsPdf',
        (req, res) => controller.exportAppointmentsPdf(filters, req, res),
        () => reportsService.getAppointmentStatisticsReport,
        () => reportsPdfService.generateAppointmentsPdf,
        'estadisticas-citas-',
      ],
      [
        'exportMedicalRecordsPdf',
        (req, res) => controller.exportMedicalRecordsPdf(filters, req, res),
        () => reportsService.getMedicalRecordsReport,
        () => reportsPdfService.generateMedicalRecordsPdf,
        'registros-medicos-',
      ],
      [
        'exportDashboardPdf',
        (req, res) => controller.exportDashboardPdf(filters, req, res),
        () => reportsService.getDashboardReport,
        () => reportsPdfService.generateDashboardPdf,
        'dashboard-',
      ],
    ];

    it.each(cases)(
      '%s arma el PDF desde el service correcto y setea headers de descarga',
      async (_name, call, getFetchMock, getPdfMock, prefix) => {
        const req = makeReq();
        const res = makeRes();
        const data = { some: 'data' };
        const fetchMock = getFetchMock();
        const pdfMock = getPdfMock();
        fetchMock.mockResolvedValue(data);
        pdfMock.mockResolvedValue(Buffer.from('PDF-BYTES'));

        await call(req, res);

        expect(fetchMock).toHaveBeenCalledWith(scoped);
        expect(pdfMock).toHaveBeenCalledWith(data);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
        expect(dispositionOf(res)).toContain(prefix);
        expect(dispositionOf(res)).toContain('.pdf');
        expect(res.end).toHaveBeenCalledWith(Buffer.from('PDF-BYTES'));
      },
    );
  });

  describe('exports Excel (fetch → streamExcel con la hoja correcta)', () => {
    const cases: Array<[string, (req: any, res: any) => Promise<any>, () => any, string, () => any, string]> = [
      [
        'exportRotationExcel',
        (req, res) => controller.exportRotationExcel(filters, req, res),
        () => advancedReportsService.getRotationReport,
        'Rotación Stock',
        () => exportService.buildRotationSheet,
        'rotacion-stock-',
      ],
      [
        'exportMarginsExcel',
        (req, res) => controller.exportMarginsExcel(filters, req, res),
        () => advancedReportsService.getProductMarginReport,
        'Márgenes',
        () => exportService.buildMarginsSheet,
        'margenes-producto-',
      ],
      [
        'exportTopSellingExcel',
        (req, res) => controller.exportTopSellingExcel(filters, req, res),
        () => advancedReportsService.getTopSellingMedications,
        'Top Vendidos',
        () => exportService.buildTopSellingSheet,
        'top-vendidos-',
      ],
      [
        'exportSalesByPharmacistExcel',
        (req, res) => controller.exportSalesByPharmacistExcel(filters, req, res),
        () => advancedReportsService.getSalesByPharmacist,
        'Por Farmacéutico',
        () => exportService.buildSalesByPharmacistSheet,
        'ventas-farmaceutico-',
      ],
      [
        'exportPharmacistDayExcel',
        (req, res) => controller.exportPharmacistDayExcel(filters, req, res),
        () => advancedReportsService.getSalesByPharmacistMedicationDay,
        'Encargado×Día×Med.',
        () => exportService.buildPharmacistDayMedicationSheet,
        'encargado-dia-medicamento-',
      ],
      [
        'exportValorizedInventoryExcel',
        (req, res) => controller.exportValorizedInventoryExcel(filters, req, res),
        () => advancedReportsService.getValorizedInventory,
        'Inventario Valorizado',
        () => exportService.buildValorizedInventorySheet,
        'inventario-valorizado-',
      ],
      [
        'exportMedicationDetailExcel',
        (req, res) => controller.exportMedicationDetailExcel(filters, req, res),
        () => advancedReportsService.getSalesByMedicationDetail,
        'Ventas por Medicamento',
        () => exportService.buildMedicationDetailSheet,
        'ventas-medicamento-',
      ],
      [
        'exportSalesByPaymentExcel',
        (req, res) => controller.exportSalesByPaymentExcel(filters, req, res),
        () => advancedReportsService.getSalesByPaymentDetailed,
        'Método de Pago',
        () => exportService.buildSalesByPaymentMethodSheet,
        'ventas-metodo-pago-',
      ],
      [
        'exportMonthlySalesComparisonExcel',
        (req, res) => controller.exportMonthlySalesComparisonExcel(filters, req, res),
        () => advancedReportsService.getMonthlySalesComparison,
        'Comparativo Mensual',
        () => exportService.buildMonthlySalesComparisonSheet,
        'comparativo-mensual-',
      ],
      [
        'exportPharmacyConsumptionExcel',
        (req, res) => controller.exportPharmacyConsumptionExcel(filters, req, res),
        () => advancedReportsService.getPharmacyConsumptionReport,
        'Consumo',
        () => exportService.buildConsumptionSheet,
        'consumo-farmacia-',
      ],
    ];

    it.each(cases)(
      '%s obtiene los datos y arma la hoja correcta vía streamExcel',
      async (_name, call, getFetchMock, sheetName, getBuildMock, prefix) => {
        const req = makeReq();
        const res = makeRes();
        const data = { some: 'data' };
        const fetchMock = getFetchMock();
        const buildMock = getBuildMock();
        fetchMock.mockResolvedValue(data);

        await call(req, res);

        expect(fetchMock).toHaveBeenCalledWith(scoped);
        expect(exportService.streamExcel).toHaveBeenCalledWith(
          res,
          [{ name: sheetName, build: expect.any(Function) }],
          expect.stringContaining(prefix),
        );
        const lastCall = exportService.streamExcel.mock.calls[exportService.streamExcel.mock.calls.length - 1];
        const sheets = lastCall[1];
        const fakeWs = {} as any;
        sheets[0].build(fakeWs);
        expect(buildMock).toHaveBeenCalledWith(fakeWs, data);
      },
    );
  });

  describe('exports con lógica particular', () => {
    it('exportCriticalStockPdf usa expiryDays, arma el PDF y setea headers', async () => {
      const req = makeReq();
      const res = makeRes();
      const data = { belowMinimum: [] };
      advancedReportsService.getCriticalStockReport.mockResolvedValue(data as any);
      reportsPdfService.generateCriticalStockPdf.mockResolvedValue(Buffer.from('PDF'));

      await controller.exportCriticalStockPdf(filters, 45, req, res);

      expect(advancedReportsService.getCriticalStockReport).toHaveBeenCalledWith(scoped, 45);
      expect(reportsPdfService.generateCriticalStockPdf).toHaveBeenCalledWith(data);
      expect(dispositionOf(res)).toContain('stock-critico-');
      expect(res.end).toHaveBeenCalledWith(Buffer.from('PDF'));
    });

    it('exportCriticalStockPdf responde 500 y loguea si el pipeline falla', async () => {
      const req = makeReq();
      const res = makeRes();
      advancedReportsService.getCriticalStockReport.mockRejectedValue(new Error('boom'));

      await controller.exportCriticalStockPdf(filters, 60, req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error: boom' });
      expect(res.end).not.toHaveBeenCalled();
    });

    it('exportTransferEfficiencyPdf arma el PDF y setea headers', async () => {
      const req = makeReq();
      const res = makeRes();
      const data = { kpiByRoute: [] };
      advancedReportsService.getTransferEfficiencyReport.mockResolvedValue(data as any);
      reportsPdfService.generateTransferEfficiencyPdf.mockResolvedValue(Buffer.from('PDF'));

      await controller.exportTransferEfficiencyPdf(filters, req, res);

      expect(reportsPdfService.generateTransferEfficiencyPdf).toHaveBeenCalledWith(data);
      expect(dispositionOf(res)).toContain('eficiencia-traspasos-');
    });

    it('exportTransferEfficiencyPdf responde 500 y loguea si el pipeline falla', async () => {
      const req = makeReq();
      const res = makeRes();
      advancedReportsService.getTransferEfficiencyReport.mockRejectedValue(new Error('down'));

      await controller.exportTransferEfficiencyPdf(filters, req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error: down' });
    });

    it('exportCriticalStockExcel usa expiryDays y delega en streamExcel', async () => {
      const req = makeReq();
      const res = makeRes();
      const data = { belowMinimum: [] };
      advancedReportsService.getCriticalStockReport.mockResolvedValue(data as any);

      await controller.exportCriticalStockExcel(filters, 45, req, res);

      expect(advancedReportsService.getCriticalStockReport).toHaveBeenCalledWith(scoped, 45);
      expect(exportService.streamExcel).toHaveBeenCalledWith(
        res,
        [{ name: 'Stock Crítico', build: expect.any(Function) }],
        expect.stringContaining('stock-critico-'),
      );
      const fakeWs = {} as any;
      exportService.streamExcel.mock.calls[0][1][0].build(fakeWs);
      expect(exportService.buildCriticalStockSheet).toHaveBeenCalledWith(fakeWs, data);
    });

    it('exportStockMovementsExcel incluye medicationId en el filtro escalado', async () => {
      const req = makeReq();
      const res = makeRes();
      const f = { ...filters, medicationId: 'med-1' };
      const data: any[] = [];
      advancedReportsService.getStockMovementsReport.mockResolvedValue(data as any);

      await controller.exportStockMovementsExcel(f, req, res);

      expect(advancedReportsService.getStockMovementsReport).toHaveBeenCalledWith({ ...f, clinicId: CLINIC_ID });
      expect(exportService.streamExcel).toHaveBeenCalledWith(
        res,
        [{ name: 'Kardex', build: expect.any(Function) }],
        expect.stringContaining('kardex-'),
      );
      const fakeWs = {} as any;
      exportService.streamExcel.mock.calls[0][1][0].build(fakeWs);
      expect(exportService.buildStockMovementsSheet).toHaveBeenCalledWith(fakeWs, data);
    });

    it('exportNoMovementPdf usa days y arma el PDF', async () => {
      const req = makeReq();
      const res = makeRes();
      advancedReportsService.getMedicationsWithoutMovement.mockResolvedValue({ rows: [] } as any);
      reportsPdfService.generateNoMovementPdf.mockResolvedValue(Buffer.from('PDF'));

      await controller.exportNoMovementPdf(filters, 45, req, res);

      expect(advancedReportsService.getMedicationsWithoutMovement).toHaveBeenCalledWith(scoped, 45);
      expect(dispositionOf(res)).toContain('sin-movimiento-');
    });

    it('exportNoMovementExcel usa days y delega en streamExcel', async () => {
      const req = makeReq();
      const res = makeRes();
      const data = { rows: [] };
      advancedReportsService.getMedicationsWithoutMovement.mockResolvedValue(data as any);

      await controller.exportNoMovementExcel(filters, 30, req, res);

      expect(advancedReportsService.getMedicationsWithoutMovement).toHaveBeenCalledWith(scoped, 30);
      expect(exportService.streamExcel).toHaveBeenCalledWith(
        res,
        [{ name: 'Sin Movimiento', build: expect.any(Function) }],
        expect.stringContaining('sin-movimiento-'),
      );
      const fakeWs = {} as any;
      exportService.streamExcel.mock.calls[0][1][0].build(fakeWs);
      expect(exportService.buildNoMovementSheet).toHaveBeenCalledWith(fakeWs, data);
    });

    it('exportFinancialPdf combina summary + paymentMethods (Promise.all) antes de generar el PDF', async () => {
      const req = makeReq();
      const res = makeRes();
      reportsService.getFinancialSummaryReport.mockResolvedValue({ totalBilled: 1000 } as any);
      reportsService.getPaymentMethodReport.mockResolvedValue({ paymentMethods: [{ method: 'cash' }] } as any);
      reportsPdfService.generateFinancialPdf.mockResolvedValue(Buffer.from('PDF'));

      await controller.exportFinancialPdf(filters, req, res);

      expect(reportsService.getFinancialSummaryReport).toHaveBeenCalledWith(scoped);
      expect(reportsService.getPaymentMethodReport).toHaveBeenCalledWith(scoped);
      expect(reportsPdfService.generateFinancialPdf).toHaveBeenCalledWith({
        totalBilled: 1000,
        paymentMethods: [{ method: 'cash' }],
      });
      expect(dispositionOf(res)).toContain('reporte-financiero-');
    });

    it('exportFinancialPdf usa [] si getPaymentMethodReport no trae paymentMethods', async () => {
      const req = makeReq();
      const res = makeRes();
      reportsService.getFinancialSummaryReport.mockResolvedValue({ totalBilled: 500 } as any);
      reportsService.getPaymentMethodReport.mockResolvedValue([{ method: 'cash' }] as any);
      reportsPdfService.generateFinancialPdf.mockResolvedValue(Buffer.from('PDF'));

      await controller.exportFinancialPdf(filters, req, res);

      expect(reportsPdfService.generateFinancialPdf).toHaveBeenCalledWith({ totalBilled: 500, paymentMethods: [] });
    });
  });
});
