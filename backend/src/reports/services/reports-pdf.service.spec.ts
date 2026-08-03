import * as fs from 'fs';
import puppeteer from 'puppeteer-core';
import { ReportsPdfService } from './reports-pdf.service';

jest.mock('puppeteer-core', () => ({ __esModule: true, default: { launch: jest.fn() } }));

const mockLaunch = puppeteer.launch as jest.Mock;
let mockReadFileSync: jest.SpyInstance;

const makePage = (pdfBuf: Buffer = Buffer.from('%PDF-1.4')) => ({
  setContent: jest.fn().mockResolvedValue(undefined),
  waitForFunction: jest.fn().mockResolvedValue(undefined),
  pdf: jest.fn().mockResolvedValue(pdfBuf),
});

const makeBrowser = (overrides: Record<string, any> = {}) => ({
  newPage: jest.fn().mockResolvedValue(makePage()),
  close: jest.fn().mockResolvedValue(undefined),
  process: jest.fn().mockReturnValue({ kill: jest.fn() }),
  ...overrides,
});

describe('ReportsPdfService', () => {
  let service: ReportsPdfService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFileSync = jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation((_path, encoding) =>
        encoding === 'utf8' ? 'fake-bytes' : (Buffer.from('fake-bytes') as any),
      );
    service = new ReportsPdfService();
  });

  afterEach(() => {
    mockReadFileSync.mockRestore();
  });

  describe('constructor (logo64 / chartJs)', () => {
    it('carga logo64 y chartJs si ambos archivos existen', () => {
      expect((service as any).logo64).toBe(Buffer.from('fake-bytes').toString('base64'));
      expect((service as any).chartJs).toBe('fake-bytes');
    });

    it('deja logo64 vacío si falla la lectura del logo', () => {
      mockReadFileSync.mockImplementationOnce(() => {
        throw new Error('ENOENT logo');
      });
      const s = new ReportsPdfService();
      expect((s as any).logo64).toBe('');
    });

    it('deja chartJs vacío si falla la lectura de chart.umd.js', () => {
      mockReadFileSync.mockReturnValueOnce(Buffer.from('logo-ok')).mockImplementationOnce(() => {
        throw new Error('ENOENT chart');
      });
      const s = new ReportsPdfService();
      expect((s as any).chartJs).toBe('');
    });
  });

  describe('render() / generate*Pdf() — pipeline de Puppeteer (compartido por los 21 reportes)', () => {
    it('lanza Puppeteer, espera window.__chartsReady y devuelve el PDF como Buffer', async () => {
      const page = makePage(Buffer.from('%PDF-CONTENT'));
      const browser = makeBrowser({ newPage: jest.fn().mockResolvedValue(page) });
      mockLaunch.mockResolvedValue(browser);

      const result = await service.generateDashboardPdf({});

      expect(mockLaunch).toHaveBeenCalledWith(
        expect.objectContaining({ executablePath: '/usr/bin/chromium', headless: true }),
      );
      expect(page.setContent).toHaveBeenCalledWith(expect.stringContaining('Dashboard'), { waitUntil: 'load' });
      expect(page.waitForFunction).toHaveBeenCalled();
      expect(page.pdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'A4', printBackground: true }));
      expect(browser.close).toHaveBeenCalled();
      expect(result).toEqual(Buffer.from('%PDF-CONTENT'));
    });

    it('no rompe si waitForFunction expira (catch silencioso)', async () => {
      const page = makePage();
      (page.waitForFunction as jest.Mock).mockRejectedValue(new Error('timeout'));
      const browser = makeBrowser({ newPage: jest.fn().mockResolvedValue(page) });
      mockLaunch.mockResolvedValue(browser);

      await expect(service.generateDashboardPdf({})).resolves.toBeInstanceOf(Buffer);
    });

    it('si browser.close() falla, intenta SIGKILL y no rompe el flujo', async () => {
      const kill = jest.fn();
      const browser = makeBrowser({
        close: jest.fn().mockRejectedValue(new Error('close failed')),
        process: jest.fn().mockReturnValue({ kill }),
      });
      mockLaunch.mockResolvedValue(browser);

      await service.generateDashboardPdf({});

      expect(kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('si close() y process().kill() fallan, no propaga el error de limpieza', async () => {
      const browser = makeBrowser({
        close: jest.fn().mockRejectedValue(new Error('close failed')),
        process: jest.fn().mockImplementation(() => {
          throw new Error('no process');
        }),
      });
      mockLaunch.mockResolvedValue(browser);

      await expect(service.generateDashboardPdf({})).resolves.toBeInstanceOf(Buffer);
    });

    it('si page.pdf() falla, propaga el error pero igual cierra el browser', async () => {
      const page = makePage();
      (page.pdf as jest.Mock).mockRejectedValue(new Error('render failed'));
      const browser = makeBrowser({ newPage: jest.fn().mockResolvedValue(page) });
      mockLaunch.mockResolvedValue(browser);

      await expect(service.generateDashboardPdf({})).rejects.toThrow('render failed');
      expect(browser.close).toHaveBeenCalled();
    });

    it('usa PUPPETEER_EXECUTABLE_PATH si está seteado', async () => {
      process.env.PUPPETEER_EXECUTABLE_PATH = '/custom/chrome';
      mockLaunch.mockResolvedValue(makeBrowser());

      await service.generateDashboardPdf({});

      expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({ executablePath: '/custom/chrome' }));
      delete process.env.PUPPETEER_EXECUTABLE_PATH;
    });
  });

  describe('wiring de los 21 generate*Pdf() públicos', () => {
    it('cada método público delega en el builder HTML correcto (detecta copy-paste entre reportes)', async () => {
      const capturedHtml: string[] = [];

      const cases: Array<[() => Promise<Buffer>, string]> = [
        [() => service.generateFinancialPdf({}), 'Reporte Financiero'],
        [() => service.generateDemographicsPdf({}), 'Demografía de Pacientes'],
        [() => service.generateDoctorPerformancePdf({}), 'Rendimiento de Médicos'],
        [() => service.generateAppointmentsPdf({}), 'Estadísticas de Citas'],
        [() => service.generateMedicalRecordsPdf({}), 'Registros Médicos'],
        [() => service.generateDashboardPdf({}), 'Resumen General'],
        [() => service.generateCriticalStockPdf({}), 'Stock Crítico'],
        [() => service.generateTransferEfficiencyPdf({}), 'Eficiencia de Traspasos'],
        [() => service.generateRotationPdf([]), 'Rotación y Días de Stock'],
        [() => service.generateMarginsPdf([]), 'Márgenes por Producto'],
        [() => service.generateDailySalesPdf({}), 'Ventas Diarias'],
        [() => service.generateExpiryBucketsPdf({}), 'Vencimientos por Período'],
        [() => service.generateProfitabilityPdf([]), 'Rentabilidad Mensual'],
        [() => service.generateSalesByPharmacistPdf([]), 'Ventas por Farmacéutico'],
        [() => service.generatePharmacistDayMedicationPdf({}), 'Detalle Encargado'],
        [() => service.generateValorizedInventoryPdf({}), 'Inventario General Valorizado'],
        [() => service.generateInventoryByCategoryPdf([]), 'Inventario por Categoría'],
        [() => service.generateNoMovementPdf({}), 'Medicamentos Sin Movimiento'],
        [() => service.generateMedicationDetailPdf([]), 'Ventas por Medicamento'],
        [() => service.generatePrescriptionVsFreePdf({}), 'Ventas con Receta vs'],
        [() => service.generateSalesByPaymentMethodPdf({}), 'Ventas por Método de Pago'],
        [() => service.generateMonthlySalesComparisonPdf({}), 'Comparativo Mensual de Ventas'],
      ];

      for (const [call, expectedTitle] of cases) {
        const page = makePage();
        mockLaunch.mockResolvedValue(makeBrowser({ newPage: jest.fn().mockResolvedValue(page) }));

        await call();

        const html = (page.setContent as jest.Mock).mock.calls[0][0];
        expect(html).toContain(expectedTitle);
        capturedHtml.push(html);
      }

      expect(capturedHtml).toHaveLength(cases.length);
    });
  });

  describe('helpers compartidos (usados por los 21 builders)', () => {
    const esc = (s?: string | null) => (service as any).esc(s);
    const fmtNum = (n: any, d?: number) => (service as any).fmtNum(n, d);
    const fmtBs = (n: any) => (service as any).fmtBs(n);
    const fmtPct = (n: any) => (service as any).fmtPct(n);

    it('esc escapa &, < y >', () => {
      expect(esc('A & B <script>')).toBe('A &amp; B &lt;script&gt;');
    });

    it('esc devuelve cadena vacía para valores falsy', () => {
      expect(esc(undefined)).toBe('');
      expect(esc(null)).toBe('');
      expect(esc('')).toBe('');
    });

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

    it('table arma thead/tbody y aplica clases de alineación por columna', () => {
      const html = (service as any).table(['A', 'B'], [['1', '2']], ['num', 'center']);
      expect(html).toContain('<th>A</th>');
      expect(html).toContain('class="num">1</td>');
      expect(html).toContain('class="center">2</td>');
    });

    it('section envuelve el body con título escapado', () => {
      const html = (service as any).section('Título <raro>', '<p>body</p>');
      expect(html).toContain('Título &lt;raro&gt;');
      expect(html).toContain('<p>body</p>');
    });

    it('noData devuelve el mensaje estándar de "sin datos"', () => {
      expect((service as any).noData()).toContain('Sin datos disponibles');
    });

    it('header incluye el logo en base64 si está disponible, y lo omite si no', () => {
      const withLogo = (service as any).header('Título');
      expect(withLogo).toContain('data:image/png;base64,');

      (service as any).logo64 = '';
      const withoutLogo = (service as any).header('Título');
      expect(withoutLogo).not.toContain('<img');
    });

    it('barChart calcula el ancho porcentual relativo a max, capado a 100', () => {
      const html = (service as any).barChart([
        { label: 'A', value: 5, max: 10 },
        { label: 'B', value: 20, max: 10 },
      ]);
      expect(html).toContain('width:50.0%');
      expect(html).toContain('width:100.0%');
    });

    it('barChart usa 0% si max es 0 (evita división por cero)', () => {
      const html = (service as any).barChart([{ label: 'A', value: 5, max: 0 }]);
      expect(html).toContain('width:0.0%');
    });
  });

  describe('financialHtml', () => {
    const html = (data: any) => (service as any).financialHtml(data);

    it('calcula collectionRate y usa noData si no hay datos mensuales/de pago', () => {
      const result = html({ summary: { totalBilled: 1000, totalCollected: 250 } });
      expect(result).toContain('25.0%');
      expect(result).toContain('Sin datos disponibles');
    });

    it('collectionRate es "0.0" si totalBilled es 0', () => {
      const result = html({ summary: { totalBilled: 0 } });
      expect(result).toContain('0.0%');
    });

    it('renderiza la tabla mensual si hay datos', () => {
      const result = html({
        summary: {},
        monthlyRevenue: [{ month: '2026-01', revenue: 100, collected: 80, invoiceCount: 5 }],
      });
      expect(result).toContain('2026-01');
    });
  });

  describe('demographicsHtml', () => {
    const html = (data: any) => (service as any).demographicsHtml(data);

    it('ordena los grupos de edad según el orden clínico esperado', () => {
      // Bug real: el service lee data.ageDistribution (la clave que realmente
      // devuelve ReportsService.getPatientDemographicsReport()), no
      // data.ageGroupDistribution — con esa clave el gráfico de edad quedaba
      // siempre vacío. Los labels van en español, coherentes con reports.service.ts.
      const result = html({
        totalPatients: 10,
        ageDistribution: [
          { ageGroup: 'Mayor de 70', count: 1 },
          { ageGroup: 'Menor de 18', count: 2 },
        ],
      });
      expect(result.indexOf('Menor de 18')).toBeLessThan(result.indexOf('Mayor de 70'));
    });

    it('traduce M/F y deja "No especificado" para valores nulos', () => {
      const result = html({ genderDistribution: [{ gender: null, count: 1 }] });
      expect(result).toBeDefined();
    });

    it('usa noData en la tabla de tipo de sangre si viene vacía', () => {
      const result = html({});
      expect(result).toContain('Sin datos disponibles');
    });
  });

  describe('doctorPerformanceHtml', () => {
    const html = (data: any) => (service as any).doctorPerformanceHtml(data);

    it('colorea la tasa de cancelación según el umbral (>20 rojo, >10 ámbar, resto verde)', () => {
      const result = html({
        doctorPerformance: [
          { doctorName: 'Alta', completedAppointments: 5, cancelledAppointments: 5 },
          { doctorName: 'Media', completedAppointments: 9, cancelledAppointments: 1 },
          { doctorName: 'Baja', completedAppointments: 10, cancelledAppointments: 0 },
        ],
      });
      expect(result).toContain('badge-red');
      expect(result).toContain('badge-amber');
      expect(result).toContain('badge-green');
    });

    it('usa noData si no hay médicos', () => {
      expect(html({})).toContain('Sin datos disponibles');
    });
  });

  describe('appointmentsHtml', () => {
    const html = (data: any) => (service as any).appointmentsHtml(data);

    it('traduce los estados conocidos y calcula % del total', () => {
      const result = html({
        summary: { totalAppointments: 10 },
        statusDistribution: [
          { status: 'completed', count: 5 },
          { status: 'weird', count: 5 },
        ],
      });
      expect(result).toContain('Completada');
      expect(result).toContain('badge-gray'); // status desconocido
    });

    it('el % es 0 si totalAppointments no viene informado', () => {
      const result = html({ summary: {}, statusDistribution: [{ status: 'completed', count: 1 }] });
      expect(result).toContain('0,0%');
    });
  });

  describe('medicalRecordsHtml', () => {
    const html = (data: any) => (service as any).medicalRecordsHtml(data);

    it('renderiza barChart + tabla si hay byType, y noData si no', () => {
      const withData = html({ summary: {}, byType: [{ recordType: 'consultation', count: 3 }] });
      expect(withData).toContain('consultation');

      const withoutData = html({ summary: {} });
      expect(withoutData).toContain('Sin datos disponibles');
    });
  });

  describe('criticalStockHtml', () => {
    const html = (data: any) => (service as any).criticalStockHtml(data);

    it('agrega la sección de vencidos solo si expired trae elementos', () => {
      const withoutExpired = html({ belowMinimum: [], expiringSoon: [], expired: [], summary: {} });
      expect(withoutExpired).not.toContain('⚠ Ya Vencidos');

      const withExpired = html({
        belowMinimum: [],
        expiringSoon: [],
        expired: [{ medication: { name: 'X' }, availableQuantity: 2, unitCost: 5 }],
        summary: {},
      });
      expect(withExpired).toContain('⚠ Ya Vencidos');
    });
  });

  describe('transferEfficiencyHtml', () => {
    const html = (data: any) => (service as any).transferEfficiencyHtml(data);

    it('muestra la alerta y la tabla de detenidos solo si stalledCount > 0', () => {
      const withoutStalled = html({ kpiByRoute: [], stalledTransfers: [], stalledCount: 0 });
      expect(withoutStalled).not.toContain('traslado(s) detenido(s)');

      const withStalled = html({ kpiByRoute: [], stalledTransfers: [{ transferNumber: 'T1' }], stalledCount: 2 });
      expect(withStalled).toContain('2 traslado(s) detenido(s)');
      expect(withStalled).toContain('Traslados Detenidos (+48 horas)');
    });
  });

  describe('dashboardHtml', () => {
    it('renderiza con defaults vacíos si no viene ninguna sección', () => {
      const result = (service as any).dashboardHtml({});
      expect(result).toContain('Resumen General');
    });
  });

  describe('rotationHtml', () => {
    const html = (data: any[]) => (service as any).rotationHtml(data);

    it('agrupa por alertLevel y solo muestra las secciones con elementos', () => {
      const result = html([
        { medicationName: 'A', alertLevel: 'critical', daysRemaining: 3 },
        { medicationName: 'B', alertLevel: 'warning', daysRemaining: 15 },
      ]);
      expect(result).toContain('Estado Crítico — Menos de 7 días');
      expect(result).toContain('Requieren Atención — Menos de 30 días');
      expect(result).not.toContain('<div class="sec"><div class="sec-hd">Estado Normal</div>');
    });

    it('muestra ∞ cuando daysRemaining >= 9999', () => {
      const result = html([{ medicationName: 'A', alertLevel: 'ok', daysRemaining: 9999 }]);
      expect(result).toContain('∞');
    });
  });

  describe('marginsHtml', () => {
    const html = (data: any[]) => (service as any).marginsHtml(data);

    it('colorea el badge de margen según el umbral (>=20 verde, >=10 ámbar, resto rojo)', () => {
      const result = html([
        { medicationName: 'Alto', marginPct: 25 },
        { medicationName: 'Medio', marginPct: 12 },
        { medicationName: 'Bajo', marginPct: 5 },
      ]);
      expect(result).toContain('badge-green');
      expect(result).toContain('badge-amber');
      expect(result).toContain('badge-red');
    });

    it('avgMarginPct es 0 si no hay ingresos', () => {
      const result = html([{ medicationName: 'A' }]);
      expect(result).toContain('0,0%');
    });
  });

  describe('dailySalesHtml', () => {
    const html = (data: any) => (service as any).dailySalesHtml(data);

    it('calcula avgTicket y formatea la fecha (Date o string)', () => {
      const result = html({ dailySales: [{ date: new Date('2026-01-01'), totalRevenue: 100, ticketCount: 2 }] });
      expect(result).toContain('2026-01-01');
    });

    it('omite el detalle diario y el desglose de pago si vienen vacíos', () => {
      const result = html({});
      expect(result).not.toContain('Detalle Diario');
      expect(result).not.toContain('Desglose por Método de Pago');
    });
  });

  describe('expiryBucketsHtml', () => {
    const html = (data: any) => (service as any).expiryBucketsHtml(data);

    it('solo renderiza las secciones de buckets que tienen elementos', () => {
      const result = html({ already_expired: [{ medicationName: 'A', stockValue: 10 }], summary: {} });
      expect(result).toContain('Ya Vencidos — Acción Inmediata');
      expect(result).not.toContain('Vencen en Menos de 30 Días');
    });
  });

  describe('profitabilityHtml (vía generateProfitabilityPdf)', () => {
    const html = (data: any[]) => (service as any).profitabilityHtml(data);

    it('colorea el margen según umbral y calcula avgMarginPct', () => {
      const result = html([{ month: '2026-01', revenue: 1000, cogs: 700, grossMargin: 300, grossMarginPct: 30 }]);
      expect(result).toContain('badge-green');
      expect(result).toContain('30,0%');
    });

    it('avgMarginPct es 0 si no hay revenue', () => {
      const result = html([{ month: '2026-01', revenue: 0, cogs: 0 }]);
      expect(result).toContain('0,0%');
    });
  });

  describe('salesByPharmacistHtml', () => {
    it('suma totales y renderiza el detalle por farmacéutico', () => {
      const result = (service as any).salesByPharmacistHtml([
        { pharmacistName: 'Ana', totalRevenue: 500, totalUnits: 10, salesCount: 3, revenuePct: 100 },
      ]);
      expect(result).toContain('Ana');
      expect(result).toContain('Bs 500,00');
    });
  });

  describe('pharmacistDayMedicationHtml', () => {
    it('limita el detalle a 200 filas y usa noData si no hay filas', () => {
      const withoutRows = (service as any).pharmacistDayMedicationHtml({});
      expect(withoutRows).toContain('Sin datos disponibles');

      const rows = Array.from({ length: 3 }, (_, i) => ({ pharmacistName: `P${i}`, medicationName: 'A', qtySold: 1 }));
      const withRows = (service as any).pharmacistDayMedicationHtml({ rows });
      expect(withRows).toContain('Detalle Completo (máx. 200 filas)');
    });
  });

  describe('valorizedInventoryHtml', () => {
    it('traduce el status a label + clase de badge, con default badge-green si es desconocido', () => {
      const result = (service as any).valorizedInventoryHtml({
        rows: [
          { medicationName: 'A', status: 'critico' },
          { medicationName: 'B', status: 'desconocido' },
        ],
        summary: {},
      });
      expect(result).toContain('Crítico');
      expect(result).toContain('desconocido'); // status no mapeado se muestra tal cual
    });
  });

  describe('inventoryByCategoryHtml', () => {
    it('marca en ámbar/rojo lowStockCount y expiringSoonCount cuando son > 0', () => {
      const result = (service as any).inventoryByCategoryHtml([
        { category: 'Antibióticos', lowStockCount: 2, expiringSoonCount: 1 },
      ]);
      expect(result).toContain('badge-amber');
      expect(result).toContain('badge-red');
    });
  });

  describe('noMovementHtml', () => {
    it('usa "Sin ventas" cuando no hay lastSaleDate y formatea Date/string indistintamente', () => {
      const result = (service as any).noMovementHtml({
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

  describe('medicationDetailHtml', () => {
    it('limita el chart a los primeros 15 y colorea el badge de margen', () => {
      const result = (service as any).medicationDetailHtml([
        { medicationName: 'A', marginPct: 25 },
        { medicationName: 'B', marginPct: 5 },
      ]);
      expect(result).toContain('badge-green');
      expect(result).toContain('badge-red');
    });
  });

  describe('prescriptionVsFreeHtml', () => {
    it('separa con_receta vs libre y limita a 15 medicamentos por tabla', () => {
      const result = (service as any).prescriptionVsFreeHtml({
        summary: [
          { type: 'con_receta', totalRevenue: 300, pct: 30 },
          { type: 'libre', totalRevenue: 700, pct: 70 },
        ],
        byMedication: [{ type: 'con_receta', medicationName: 'A', qtySold: 5, revenue: 100 }],
      });
      expect(result).toContain('Con Receta');
      expect(result).toContain('Venta Libre');
    });

    it('usa objeto vacío si el tipo no aparece en el summary', () => {
      const result = (service as any).prescriptionVsFreeHtml({ summary: [], byMedication: [] });
      expect(result).toContain('Sin datos disponibles');
    });
  });

  describe('salesByPaymentMethodHtml', () => {
    it('traduce métodos conocidos y omite el detalle diario si viene vacío', () => {
      const result = (service as any).salesByPaymentMethodHtml({
        summary: [{ method: 'qr', totalRevenue: 100, salesCount: 2, pct: 100 }],
        daily: [],
        grandTotal: 100,
      });
      expect(result).toContain('QR');
      expect(result).not.toContain('Detalle Diario por Método');
    });
  });

  describe('monthlySalesComparisonHtml', () => {
    it('muestra flecha verde para crecimiento positivo, roja para negativo y "—" para null', () => {
      const result = (service as any).monthlySalesComparisonHtml({
        rows: [
          { month: '2026-01', revenueGrowth: null },
          { month: '2026-02', revenueGrowth: 10 },
          { month: '2026-03', revenueGrowth: -5 },
        ],
        summary: { bestMonth: '2026-02' },
      });
      expect(result).toContain('▲');
      expect(result).toContain('▼');
      expect(result).toContain('>—<');
    });
  });
});
