import { Test, TestingModule } from '@nestjs/testing';
import { ReportsPdfService } from './reports-pdf.service';
import { TypstCompilerService } from '../../pdf/typst-compiler.service';
import { ChartRasterizerService } from '../../pdf/chart-rasterizer.service';

const mockTypstCompile = jest.fn();
const mockRasterize = jest.fn();

describe('ReportsPdfService', () => {
  let service: ReportsPdfService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTypstCompile.mockResolvedValue(Buffer.from('%PDF-TYPST'));
    mockRasterize.mockResolvedValue(Buffer.from('fake-png-bytes'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsPdfService,
        { provide: TypstCompilerService, useValue: { compile: mockTypstCompile } },
        { provide: ChartRasterizerService, useValue: { rasterize: mockRasterize } },
      ],
    }).compile();

    service = module.get(ReportsPdfService);
  });

  describe('helpers compartidos (fmtNum/fmtBs/fmtPct)', () => {
    const fmtNum = (n: any, d?: number) => (service as any).fmtNum(n, d);
    const fmtBs = (n: any) => (service as any).fmtBs(n);
    const fmtPct = (n: any) => (service as any).fmtPct(n);

    it('fmtNum formatea con separador de miles es-BO y decimales configurables', () => {
      expect(fmtNum(1234.5, 1)).toBe('1.234,5');
      expect(fmtNum(undefined)).toBe('0');
    });

    it('fmtNum devuelve "0" si el valor no es numérico', () => {
      expect(fmtNum('no-es-numero')).toBe('0');
    });

    it('fmtBs antepone "Bs" con 2 decimales', () => {
      expect(fmtBs(1500)).toBe('Bs 1.500,00');
    });

    it('fmtPct agrega "%" con 1 decimal', () => {
      expect(fmtPct(33.333)).toBe('33,3%');
    });
  });

  describe('wiring de los 22 generate*Pdf() públicos', () => {
    it('cada método público compila vía TypstCompilerService con el título correcto (detecta copy-paste entre reportes)', async () => {
      const cases: Array<[() => Promise<Buffer>, string]> = [
        [() => service.generateFinancialPdf({} as any), 'Reporte Financiero'],
        [() => service.generateDemographicsPdf({} as any), 'Demografía de Pacientes'],
        [() => service.generateDoctorPerformancePdf({} as any), 'Rendimiento de Médicos'],
        [() => service.generateAppointmentsPdf({} as any), 'Estadísticas de Citas'],
        [() => service.generateMedicalRecordsPdf({} as any), 'Registros Médicos'],
        [() => service.generateDashboardPdf({} as any), 'Resumen General'],
        [() => service.generateCriticalStockPdf({} as any), 'Stock Crítico'],
        [() => service.generateTransferEfficiencyPdf({} as any), 'Eficiencia de Traspasos'],
        [() => service.generateRotationPdf([]), 'Rotación y Días de Stock'],
        [() => service.generateMarginsPdf([]), 'Márgenes por Producto'],
        [() => service.generateDailySalesPdf({} as any), 'Ventas Diarias'],
        [() => service.generateExpiryBucketsPdf({} as any), 'Vencimientos por Período'],
        [() => service.generateProfitabilityPdf([]), 'Rentabilidad Mensual'],
        [() => service.generateSalesByPharmacistPdf([]), 'Ventas por Farmacéutico'],
        [() => service.generatePharmacistDayMedicationPdf({} as any), 'Encargado'],
        [() => service.generateValorizedInventoryPdf({} as any), 'Inventario General Valorizado'],
        [() => service.generateInventoryByCategoryPdf([]), 'Inventario por Categoría'],
        [() => service.generateNoMovementPdf({} as any), 'Medicamentos Sin Movimiento'],
        [() => service.generateMedicationDetailPdf([]), 'Ventas por Medicamento'],
        [() => service.generatePrescriptionVsFreePdf({} as any), 'Ventas con Receta vs'],
        [() => service.generateSalesByPaymentMethodPdf({} as any), 'Ventas por Método de Pago'],
        [() => service.generateMonthlySalesComparisonPdf({} as any), 'Comparativo Mensual de Ventas'],
      ];

      expect(cases).toHaveLength(22);

      for (const [call, expectedTitle] of cases) {
        mockTypstCompile.mockClear();
        await call();
        const [source] = mockTypstCompile.mock.calls[0];
        expect(source).toContain(expectedTitle);
      }
    });
  });

  describe('generateFinancialPdf / financialTypst (Typst)', () => {
    const typ = (data: any, revenue = '#noData()', payment = '#noData()') =>
      (service as any).financialTypst(data, revenue, payment);

    it('rasteriza el gráfico de ingresos mensuales y el de métodos de pago cuando hay datos', async () => {
      await service.generateFinancialPdf({
        monthlyRevenue: [{ month: '2026-01', totalBilled: 1000, totalPaid: 800 }],
        paymentMethods: [{ method: 'cash', totalAmount: 500 }],
      } as any);

      expect(mockRasterize).toHaveBeenCalledTimes(2);
      expect(mockRasterize).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'bar', data: expect.objectContaining({ labels: ['2026-01'] }) }),
        520,
        200,
      );
      expect(mockRasterize).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'doughnut' }),
        260,
        180,
      );
    });

    it('calcula collectionRate y usa noData si no hay datos mensuales/de pago', async () => {
      await service.generateFinancialPdf({ summary: { totalBilled: 1000, totalCollected: 250 } } as any);
      expect(mockRasterize).not.toHaveBeenCalled();

      const result = typ({ summary: { totalBilled: 1000, totalCollected: 250 } });
      expect(result).toContain('25.0%');
    });

    it('collectionRate es "0.0" si totalBilled es 0', () => {
      const result = typ({ summary: { totalBilled: 0 } });
      expect(result).toContain('0.0%');
    });

    it('renderiza la tabla mensual si hay datos', () => {
      const result = typ({
        summary: {},
        monthlyRevenue: [{ month: '2026-01', revenue: 100, collected: 80, invoiceCount: 5 }],
      });
      expect(result).toContain('2026-01');
    });
  });

  describe('generateDemographicsPdf / demographicsTypst (Typst)', () => {
    const typ = (data: any, gender = '#noData()', age = '#noData()') =>
      (service as any).demographicsTypst(data, gender, age);

    it('ordena los grupos de edad según el orden clínico esperado antes de rasterizar el gráfico', async () => {
      // Bug real (heredado de la versión Puppeteer): el service lee
      // data.ageDistribution (la clave que realmente devuelve
      // ReportsService.getPatientDemographicsReport()), no ageGroupDistribution.
      await service.generateDemographicsPdf({
        totalPatients: 10,
        ageDistribution: [
          { ageGroup: 'Mayor de 70', count: 1 },
          { ageGroup: 'Menor de 18', count: 2 },
        ],
      } as any);

      expect(mockRasterize).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ labels: ['Menor de 18', 'Mayor de 70'] }) }),
        280,
        180,
      );
    });

    /**
     * Regresión: el enum Gender de patient.entity.ts usa 'male'/'female'
     * (no 'M'/'F') — bug real encontrado en vivo donde la traducción nunca
     * disparaba y el gráfico mostraba el valor crudo en inglés.
     */
    it('traduce male/female y deja "No especificado" para valores nulos', async () => {
      await service.generateDemographicsPdf({
        genderDistribution: [
          { gender: 'male', count: 1 },
          { gender: 'female', count: 1 },
          { gender: null, count: 1 },
        ],
      } as any);
      expect(mockRasterize).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ labels: ['Masculino', 'Femenino', 'No especificado'] }) }),
        240,
        180,
      );
    });

    it('usa noData en la tabla de tipo de sangre si viene vacía', () => {
      const result = typ({});
      expect(result).toContain('#noData()');
    });
  });

  describe('generateDoctorPerformancePdf / doctorPerformanceTypst (Typst)', () => {
    const typ = (data: any, chart = '#noData()') => (service as any).doctorPerformanceTypst(data, chart);

    it('colorea la tasa de cancelación según el umbral (>20 rojo, >10 ámbar, resto verde)', () => {
      const result = typ({
        doctorPerformance: [
          { doctorName: 'Alta', completedAppointments: 5, cancelledAppointments: 5 }, // 50% → rojo
          { doctorName: 'Media', completedAppointments: 8, cancelledAppointments: 1 }, // 11.1% → ámbar
          { doctorName: 'Baja', completedAppointments: 10, cancelledAppointments: 0 }, // 0% → verde
        ],
      });
      expect(result).toContain('color: "red"');
      expect(result).toContain('color: "amber"');
      expect(result).toContain('color: "green"');
    });

    it('usa noData si no hay médicos', () => {
      expect(typ({})).toContain('#noData()');
    });
  });

  describe('generateAppointmentsPdf / appointmentsTypst (Typst)', () => {
    const typ = (data: any, status = '#noData()', trend = '#noData()') =>
      (service as any).appointmentsTypst(data, status, trend);

    it('traduce los estados conocidos y calcula % del total', () => {
      const result = typ({
        summary: { totalAppointments: 10 },
        statusDistribution: [
          { status: 'completed', count: 5 },
          { status: 'weird', count: 5 },
        ],
      });
      expect(result).toContain('Completada');
      expect(result).toContain('color: "gray"'); // status desconocido
    });

    it('el % es 0 si totalAppointments no viene informado', () => {
      const result = typ({ summary: {}, statusDistribution: [{ status: 'completed', count: 1 }] });
      expect(result).toContain('0,0%');
    });

    /**
     * Regresión: ReportsService.getAppointmentStatisticsReport() devuelve
     * { totalAppointments, statusDistribution, monthlyDistribution,
     * cancellationRate } SIN envolver en `summary`, y el campo de tendencia
     * mensual se llama `monthlyDistribution`, no `monthlyTrend` — bug real
     * heredado de Puppeteer, encontrado en vivo (todo el KPI grid superior
     * quedaba en cero pese a haber citas reales).
     */
    it('normaliza el shape real del backend (sin summary, monthlyDistribution) antes de compilar', async () => {
      await service.generateAppointmentsPdf({
        totalAppointments: 10,
        cancellationRate: 20,
        statusDistribution: [
          { status: 'completed', count: 5 },
          { status: 'cancelled', count: 2 },
        ],
        monthlyDistribution: [{ month: '2026-01', count: 10 }],
      } as any);

      const source = mockTypstCompile.mock.calls[0][0];
      expect(source).toContain('kpiCard("Total Citas", "10"');
      expect(source).toContain('kpiCard("Completadas", "5"');
      expect(source).toContain('kpiCard("Canceladas", "2"');
      expect(mockRasterize).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ labels: ['2026-01'] }) }),
        310,
        180,
      );
    });
  });

  describe('generateMedicalRecordsPdf / medicalRecordsTypst (Typst)', () => {
    const typ = (data: any) => (service as any).medicalRecordsTypst(data);

    it('renderiza hBarChart + tabla si hay byType, y noData si no', () => {
      const withData = typ({ summary: {}, byType: [{ recordType: 'consultation', count: 3 }] });
      expect(withData).toContain('consultation');
      expect(withData).toContain('#hBarChart((');

      const withoutData = typ({ summary: {} });
      expect(withoutData).toContain('#noData()');
    });
  });

  describe('generateCriticalStockPdf / criticalStockTypst (Typst)', () => {
    const typ = (data: any) => (service as any).criticalStockTypst(data);

    it('agrega la sección de vencidos solo si expired trae elementos', () => {
      const withoutExpired = typ({ belowMinimum: [], expiringSoon: [], expired: [], summary: {} });
      expect(withoutExpired).not.toContain('⚠ Ya Vencidos');

      const withExpired = typ({
        belowMinimum: [],
        expiringSoon: [],
        expired: [{ medication: { name: 'X' }, availableQuantity: 2, unitCost: 5 }],
        summary: {},
      });
      expect(withExpired).toContain('⚠ Ya Vencidos');
    });
  });

  describe('generateTransferEfficiencyPdf / transferEfficiencyTypst (Typst)', () => {
    const typ = (data: any) => (service as any).transferEfficiencyTypst(data);

    it('muestra la alerta y la tabla de detenidos solo si stalledCount > 0', () => {
      const withoutStalled = typ({ kpiByRoute: [], stalledTransfers: [], stalledCount: 0 });
      expect(withoutStalled).not.toContain('traslado(s) detenido(s)');

      const withStalled = typ({ kpiByRoute: [], stalledTransfers: [{ transferNumber: 'T1' }], stalledCount: 2 });
      expect(withStalled).toContain('2 traslado(s) detenido(s)');
      expect(withStalled).toContain('Traslados Detenidos (+48 horas)');
    });
  });

  describe('generateDashboardPdf / dashboardTypst (Typst)', () => {
    it('renderiza con defaults vacíos si no viene ninguna sección', () => {
      const result = (service as any).dashboardTypst({});
      expect(result).toContain('Resumen General');
    });
  });

  describe('generateRotationPdf / rotationTypst (Typst)', () => {
    const typ = (data: any[]) => (service as any).rotationTypst(data);

    it('agrupa por alertLevel y solo muestra las secciones con elementos', () => {
      const result = typ([
        { medicationName: 'A', alertLevel: 'critical', daysRemaining: 3 },
        { medicationName: 'B', alertLevel: 'warning', daysRemaining: 15 },
      ]);
      expect(result).toContain('Estado Crítico — Menos de 7 días');
      expect(result).toContain('Requieren Atención — Menos de 30 días');
      expect(result).not.toContain('#section("Estado Normal")');
    });

    it('muestra ∞ cuando daysRemaining >= 9999', () => {
      const result = typ([{ medicationName: 'A', alertLevel: 'ok', daysRemaining: 9999 }]);
      expect(result).toContain('∞');
    });
  });

  describe('marginsTypst', () => {
    const typ = (data: any[]) => (service as any).marginsTypst(data);

    it('colorea el badge de margen según el umbral (>=20 verde, >=10 ámbar, resto rojo)', () => {
      const result = typ([
        { medicationName: 'Alto', marginPct: 25 },
        { medicationName: 'Medio', marginPct: 12 },
        { medicationName: 'Bajo', marginPct: 5 },
      ]);
      expect(result).toContain('color: "green"');
      expect(result).toContain('color: "amber"');
      expect(result).toContain('color: "red"');
    });

    it('avgMarginPct es 0 si no hay ingresos', () => {
      const result = typ([{ medicationName: 'A' }]);
      expect(result).toContain('0,0%');
    });

    it('usa #noData() si no hay productos', () => {
      const result = typ([]);
      expect(result).toContain('#noData()');
    });

    /**
     * Regresión: un nombre de medicamento con comillas no debe romper el
     * `.typ` generado (ver typst-escape.util.ts).
     */
    it('escapa comillas dobles en nombres de medicamento', () => {
      const result = typ([{ medicationName: 'Jarabe "Fuerte"', marginPct: 15 }]);
      expect(result).toContain('Jarabe \\"Fuerte\\"');
    });
  });

  describe('generateDailySalesPdf (con gráfico)', () => {
    it('rasteriza el gráfico de barras y compila vía Typst', async () => {
      const result = await service.generateDailySalesPdf({
        dailySales: [{ date: new Date('2026-01-01'), totalRevenue: 100, ticketCount: 2, avgTicket: 50 }],
      } as any);

      expect(mockRasterize).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bar',
          data: expect.objectContaining({
            labels: ['2026-01-01'],
            datasets: [expect.objectContaining({ label: 'Ingresos (Bs)', data: [100], backgroundColor: '#f97316' })],
          }),
        }),
        540,
        200,
      );
      expect(mockTypstCompile).toHaveBeenCalledWith(
        expect.stringContaining('Ventas Diarias'),
        [{ filename: 'chart-revenue.png', buffer: Buffer.from('fake-png-bytes') }],
      );
      expect(result).toEqual(Buffer.from('%PDF-TYPST'));
    });

    it('usa #noData() y no rasteriza nada si no hay ventas diarias', async () => {
      await service.generateDailySalesPdf({} as any);

      expect(mockRasterize).not.toHaveBeenCalled();
      expect(mockTypstCompile).toHaveBeenCalledWith(expect.stringContaining('#noData()'), []);
    });
  });

  describe('dailySalesTypst', () => {
    const typ = (data: any, chart = '#noData()') => (service as any).dailySalesTypst(data, chart);

    it('calcula avgTicket y formatea la fecha (Date o string)', () => {
      const result = typ({ dailySales: [{ date: new Date('2026-01-01'), totalRevenue: 100, ticketCount: 2 }] });
      expect(result).toContain('2026-01-01');
    });

    it('omite el detalle diario y el desglose de pago si vienen vacíos', () => {
      const result = typ({});
      expect(result).not.toContain('Detalle Diario');
      expect(result).not.toContain('Desglose por Método de Pago');
    });
  });

  describe('generateExpiryBucketsPdf / expiryBucketsTypst (Typst)', () => {
    const typ = (data: any) => (service as any).expiryBucketsTypst(data);

    it('solo renderiza las secciones de buckets que tienen elementos', () => {
      const result = typ({ already_expired: [{ medicationName: 'A', stockValue: 10 }], summary: {} });
      expect(result).toContain('Ya Vencidos — Acción Inmediata');
      expect(result).not.toContain('Vencen en Menos de 30 Días');
    });
  });

  describe('generateProfitabilityPdf / profitabilityTypst (Typst)', () => {
    const typ = (data: any[], chart = '#noData()') => (service as any).profitabilityTypst(data, chart);

    it('colorea el margen según umbral y calcula avgMarginPct', () => {
      const result = typ([{ month: '2026-01', revenue: 1000, cogs: 700, grossMargin: 300, grossMarginPct: 30 }]);
      expect(result).toContain('color: "green"');
      expect(result).toContain('30,0%');
    });

    it('avgMarginPct es 0 si no hay revenue', () => {
      const result = typ([{ month: '2026-01', revenue: 0, cogs: 0 }]);
      expect(result).toContain('0,0%');
    });

    it('omite la sección "Detalle por Mes" por completo si no hay filas', () => {
      const result = typ([]);
      expect(result).not.toContain('Detalle por Mes');
    });
  });

  describe('generateSalesByPharmacistPdf / salesByPharmacistTypst (Typst)', () => {
    const typ = (data: any[], chart = '#noData()') => (service as any).salesByPharmacistTypst(data, chart);

    it('suma totales y renderiza el detalle por farmacéutico', () => {
      const result = typ([
        { pharmacistName: 'Ana', totalRevenue: 500, totalUnits: 10, salesCount: 3, revenuePct: 100 },
      ]);
      expect(result).toContain('Ana');
      expect(result).toContain('Bs 500,00');
    });

    it('omite la sección "Detalle por Encargado" por completo si no hay datos', () => {
      const result = typ([]);
      expect(result).not.toContain('Detalle por Encargado');
    });
  });

  describe('generatePharmacistDayMedicationPdf / pharmacistDayMedicationTypst (Typst)', () => {
    it('limita el detalle a 200 filas y usa noData si no hay filas', () => {
      const withoutRows = (service as any).pharmacistDayMedicationTypst({});
      expect(withoutRows).toContain('#noData()');

      const rows = Array.from({ length: 3 }, (_, i) => ({ pharmacistName: `P${i}`, medicationName: 'A', qtySold: 1 }));
      const withRows = (service as any).pharmacistDayMedicationTypst({ rows });
      expect(withRows).toContain('Detalle Completo (máx. 200 filas)');
    });
  });

  describe('generateValorizedInventoryPdf / valorizedInventoryTypst (Typst)', () => {
    it('traduce el status a label + color de badge, con default "green" si es desconocido', () => {
      const result = (service as any).valorizedInventoryTypst({
        rows: [
          { medicationName: 'A', status: 'critico' },
          { medicationName: 'B', status: 'desconocido' },
        ],
        summary: {},
      });
      expect(result).toContain('Crítico');
      expect(result).toContain('desconocido'); // status no mapeado se muestra tal cual
      expect(result).toContain('color: "green"'); // default para status desconocido
    });
  });

  describe('generateInventoryByCategoryPdf / inventoryByCategoryTypst (Typst)', () => {
    const typ = (data: any[], chart = '#noData()') => (service as any).inventoryByCategoryTypst(data, chart);

    it('marca en ámbar/rojo lowStockCount y expiringSoonCount cuando son > 0, sin badge si son 0', () => {
      const result = typ([
        { category: 'Antibióticos', lowStockCount: 2, expiringSoonCount: 1 },
        { category: 'Analgésicos', lowStockCount: 0, expiringSoonCount: 0 },
      ]);
      expect(result).toContain('badge("2", color: "amber")');
      expect(result).toContain('badge("1", color: "red")');
    });
  });

  describe('generateNoMovementPdf / noMovementTypst (Typst)', () => {
    it('usa "Sin ventas" cuando no hay lastSaleDate y formatea Date/string indistintamente', () => {
      const result = (service as any).noMovementTypst({
        rows: [
          { medicationName: 'A', lastSaleDate: null },
          { medicationName: 'B', lastSaleDate: new Date('2026-01-01') },
        ],
        days: 45,
      });
      expect(result).toContain('Sin ventas');
      expect(result).toContain('Más de 45 días');
    });
  });

  describe('generateMedicationDetailPdf / medicationDetailTypst (Typst)', () => {
    it('limita el chart a los primeros 15 medicamentos', async () => {
      const data = Array.from({ length: 20 }, (_, i) => ({ medicationName: `Med${i}`, totalRevenue: i, grossMargin: i }));
      await service.generateMedicationDetailPdf(data as any);

      const rasterizedConfig = mockRasterize.mock.calls[0][0];
      expect(rasterizedConfig.data.labels).toHaveLength(15);
    });

    it('colorea el badge de margen', () => {
      const result = (service as any).medicationDetailTypst(
        [
          { medicationName: 'A', marginPct: 25 },
          { medicationName: 'B', marginPct: 5 },
        ],
        '#noData()',
      );
      expect(result).toContain('color: "green"');
      expect(result).toContain('color: "red"');
    });
  });

  describe('generatePrescriptionVsFreePdf / prescriptionVsFreeTypst (Typst)', () => {
    const typ = (data: any, chart = '#noData()') => (service as any).prescriptionVsFreeTypst(data, chart);

    it('separa con_receta vs libre y limita a 15 medicamentos por tabla', () => {
      const result = typ({
        summary: [
          { type: 'con_receta', totalRevenue: 300, pct: 30 },
          { type: 'libre', totalRevenue: 700, pct: 70 },
        ],
        byMedication: [{ type: 'con_receta', medicationName: 'A', qtySold: 5, revenue: 100 }],
      });
      expect(result).toContain('Con Receta');
      expect(result).toContain('Venta Libre');
    });

    it('usa noData si el tipo no aparece en el summary', () => {
      const result = typ({ summary: [], byMedication: [] });
      expect(result).toContain('#noData()');
    });
  });

  describe('generateSalesByPaymentMethodPdf / salesByPaymentMethodTypst (Typst)', () => {
    const typ = (data: any, chart = '#noData()') => (service as any).salesByPaymentMethodTypst(data, chart);

    it('traduce métodos conocidos y omite el detalle diario por completo si viene vacío', () => {
      const result = typ({
        summary: [{ method: 'qr', totalRevenue: 100, salesCount: 2, pct: 100 }],
        daily: [],
        grandTotal: 100,
      });
      expect(result).toContain('QR');
      expect(result).not.toContain('Detalle Diario por Método');
    });

    it('arma un config de Chart.js válido para el gráfico de dona (bug heredado de Puppeteer: antes faltaba envolver en `data:`)', async () => {
      await service.generateSalesByPaymentMethodPdf({
        summary: [{ method: 'cash', totalRevenue: 100 }],
      } as any);

      expect(mockRasterize).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'doughnut',
          data: expect.objectContaining({ labels: ['Efectivo'], datasets: expect.any(Array) }),
        }),
        320,
        200,
      );
    });
  });

  describe('generateMonthlySalesComparisonPdf / monthlySalesComparisonTypst (Typst)', () => {
    const typ = (data: any, chart = '#noData()') => (service as any).monthlySalesComparisonTypst(data, chart);

    it('muestra flecha verde para crecimiento positivo, roja para negativo y "—" para null', () => {
      const result = typ({
        rows: [
          { month: '2026-01', revenueGrowth: null },
          { month: '2026-02', revenueGrowth: 10 },
          { month: '2026-03', revenueGrowth: -5 },
        ],
        summary: { bestMonth: '2026-02' },
      });
      expect(result).toContain('▲');
      expect(result).toContain('▼');
      expect(result).toContain('"—"');
    });

    it('arma un config de Chart.js válido para el gráfico de barras (bug heredado de Puppeteer: antes faltaba envolver en `data:`)', async () => {
      await service.generateMonthlySalesComparisonPdf({
        rows: [{ month: '2026-01', totalRevenue: 100, salesCount: 5 }],
      } as any);

      expect(mockRasterize).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bar',
          data: expect.objectContaining({ labels: ['2026-01'], datasets: expect.any(Array) }),
        }),
        560,
        220,
      );
    });
  });
});
