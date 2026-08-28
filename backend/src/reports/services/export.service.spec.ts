import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { ExportService } from './export.service';

jest.mock('pdfkit');

const makeMockDoc = () => {
  const doc: Record<string, any> = {};
  const chain = [
    'fontSize',
    'font',
    'text',
    'moveDown',
    'fillColor',
    'moveTo',
    'lineTo',
    'stroke',
    'rect',
    'fill',
    'addPage',
  ];
  chain.forEach(m => (doc[m] = jest.fn().mockReturnValue(doc)));
  doc.pipe = jest.fn().mockReturnValue(doc);
  doc.end = jest.fn();
  doc.y = 100;
  return doc as unknown as PDFKit.PDFDocument & Record<string, jest.Mock> & { y: number };
};

const makeRes = () =>
  ({
    setHeader: jest.fn(),
  }) as unknown as Response;

describe('ExportService', () => {
  let service: ExportService;
  let mockDoc: ReturnType<typeof makeMockDoc>;

  beforeEach(() => {
    service = new ExportService();
    mockDoc = makeMockDoc();
    (PDFDocument as unknown as jest.Mock).mockImplementation(() => mockDoc);
  });

  // ─── PDF ──────────────────────────────────────────────────────────────────

  describe('streamPdf', () => {
    it('setea los headers de descarga, escribe el encabezado común y llama a buildFn', () => {
      const res = makeRes();
      const buildFn = jest.fn();

      service.streamPdf(res, 'Reporte de Prueba', buildFn, 'custom.pdf');

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="custom.pdf"');
      expect(mockDoc.pipe).toHaveBeenCalledWith(res);
      expect(mockDoc.text).toHaveBeenCalledWith('Reporte de Prueba', { align: 'center' });
      expect(buildFn).toHaveBeenCalledWith(mockDoc);
      expect(mockDoc.end).toHaveBeenCalled();
    });

    it('usa "report.pdf" como filename por defecto', () => {
      const res = makeRes();

      service.streamPdf(res, 'Título', jest.fn());

      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="report.pdf"');
    });
  });

  describe('buildCriticalStockPdf', () => {
    const baseData = {
      belowMinimum: [
        { medication: { name: 'Amoxicilina' }, batchNumber: 'L1', availableQuantity: 5, minimumStock: 10 },
      ],
      expiringSoon: [
        { medication: { name: 'Ibuprofeno' }, batchNumber: 'L2', expiryDate: '2026-08-01', availableQuantity: 20 },
      ],
      expired: [],
      summary: { belowMinimumCount: 1, expiringSoonCount: 1, expiredCount: 0, totalAtRiskValue: 500 },
    };

    it('renderiza el resumen y las tablas de bajo mínimo y por vencer', () => {
      service.buildCriticalStockPdf(mockDoc, baseData);

      expect(mockDoc.text).toHaveBeenCalledWith('Bajo mínimo: 1');
      expect(mockDoc.text).toHaveBeenCalledWith('Stock Bajo Mínimo');
      expect(mockDoc.text).toHaveBeenCalledWith('Próximos a Vencer');
    });

    it('agrega la tabla de vencidos solo si expired trae elementos', () => {
      service.buildCriticalStockPdf(mockDoc, baseData);
      expect(mockDoc.text).not.toHaveBeenCalledWith('⚠ Ya Vencidos (acción inmediata)');

      jest.clearAllMocks();
      service.buildCriticalStockPdf(mockDoc, {
        ...baseData,
        expired: [
          { medication: { name: 'Paracetamol' }, batchNumber: 'L3', expiryDate: '2026-01-01', availableQuantity: 3 },
        ],
      });
      expect(mockDoc.text).toHaveBeenCalledWith('⚠ Ya Vencidos (acción inmediata)');
    });

    it('usa "-" si al item le falta el nombre del medicamento', () => {
      service.buildCriticalStockPdf(mockDoc, {
        ...baseData,
        belowMinimum: [{ medication: null, batchNumber: 'L9', availableQuantity: 1, minimumStock: 5 }],
      });
      expect(mockDoc.text).toHaveBeenCalledWith('-', expect.any(Number), expect.any(Number), expect.any(Object));
    });
  });

  describe('buildTransferEfficiencyPdf', () => {
    it('muestra la advertencia de traslados detenidos solo si stalledCount > 0', () => {
      service.buildTransferEfficiencyPdf(mockDoc, { kpiByRoute: [], stalledTransfers: [], stalledCount: 0 });
      expect(mockDoc.text).not.toHaveBeenCalledWith(expect.stringContaining('detenido(s)'));

      jest.clearAllMocks();
      service.buildTransferEfficiencyPdf(mockDoc, { kpiByRoute: [], stalledTransfers: [], stalledCount: 3 });
      expect(mockDoc.text).toHaveBeenCalledWith(expect.stringContaining('3 traslado(s) detenido(s)'));
    });

    it('agrega la tabla de traslados detenidos solo si hay elementos', () => {
      service.buildTransferEfficiencyPdf(mockDoc, {
        kpiByRoute: [
          {
            source_clinic_name: 'Norte',
            target_clinic_name: 'Sur',
            total_completed: 5,
            avg_total_hrs: 12,
            p95_hrs_in_transit: 20,
            total_discrepancy_units: 0,
          },
        ],
        stalledTransfers: [],
        stalledCount: 0,
      });
      expect(mockDoc.text).not.toHaveBeenCalledWith('Traslados Detenidos (+48h)');

      jest.clearAllMocks();
      service.buildTransferEfficiencyPdf(mockDoc, {
        kpiByRoute: [],
        stalledTransfers: [
          { transferNumber: 'TR-1', source_clinic_name: 'Norte', target_clinic_name: 'Sur', hrs_waiting: 60 },
        ],
        stalledCount: 1,
      });
      expect(mockDoc.text).toHaveBeenCalledWith('Traslados Detenidos (+48h)');
    });
  });

  describe('addPdfTable (vía los builders públicos)', () => {
    it('muestra "Sin datos" si no hay filas', () => {
      service.buildTransferEfficiencyPdf(mockDoc, { kpiByRoute: [], stalledTransfers: [], stalledCount: 0 });
      expect(mockDoc.text).toHaveBeenCalledWith('Sin datos');
    });

    it('agrega una página nueva si el cursor Y supera el límite de la hoja', () => {
      mockDoc.y = 760;
      const manyRows = Array.from({ length: 2 }, (_, i) => ({
        source_clinic_name: `Origen${i}`,
        target_clinic_name: `Destino${i}`,
        total_completed: 1,
        avg_total_hrs: 1,
        p95_hrs_in_transit: 1,
        total_discrepancy_units: 0,
      }));

      service.buildTransferEfficiencyPdf(mockDoc, { kpiByRoute: manyRows, stalledTransfers: [], stalledCount: 0 });

      expect(mockDoc.addPage).toHaveBeenCalled();
    });
  });

  // ─── Excel ────────────────────────────────────────────────────────────────

  describe('streamExcel', () => {
    it('setea headers de descarga xlsx, construye cada hoja y finaliza el stream', async () => {
      const res = { setHeader: jest.fn(), end: jest.fn() } as unknown as Response;
      const build1 = jest.fn();
      const build2 = jest.fn();

      const writeSpy = jest.spyOn(ExcelJS.Workbook.prototype.xlsx, 'write').mockResolvedValue(undefined as any);

      await service.streamExcel(
        res,
        [
          { name: 'Hoja 1', build: build1 },
          { name: 'Hoja 2', build: build2 },
        ],
        'custom.xlsx',
      );

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="custom.xlsx"');
      expect(build1).toHaveBeenCalled();
      expect(build2).toHaveBeenCalled();
      expect(writeSpy).toHaveBeenCalledWith(res);
      expect((res as any).end).toHaveBeenCalled();

      writeSpy.mockRestore();
    });
  });

  describe('buildCriticalStockSheet', () => {
    it('crea una fila por cada item de expired/belowMinimum/expiringSoon con su etiqueta de alerta', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');

      service.buildCriticalStockSheet(ws, {
        expired: [
          {
            medication: { name: 'A', genericName: 'gA' },
            batchNumber: 'L1',
            expiryDate: '2026-01-01',
            availableQuantity: 2,
            minimumStock: 5,
            unitCost: 10,
          },
        ],
        belowMinimum: [
          { medication: { name: 'B' }, batchNumber: 'L2', availableQuantity: 3, minimumStock: 10, unitCost: 5 },
        ],
        expiringSoon: [
          {
            medication: { name: 'C' },
            batchNumber: 'L3',
            expiryDate: '2026-09-01',
            availableQuantity: 8,
            minimumStock: 2,
            unitCost: 1,
          },
        ],
      });

      expect(ws.rowCount).toBe(4); // header + 3 items
      expect(ws.getRow(2).getCell('alert').value).toBe('VENCIDO');
      expect(ws.getRow(3).getCell('alert').value).toBe('BAJO MÍNIMO');
      expect(ws.getRow(4).getCell('alert').value).toBe('PRÓXIMO A VENCER');
      expect(ws.getRow(3).getCell('generic').value).toBe('-'); // sin genericName
    });
  });

  describe('buildRotationSheet', () => {
    it('muestra "Sin ventas" cuando daysRemaining >= 9999', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');

      service.buildRotationSheet(ws, [
        { medicationName: 'A', availableQty: 10, avgDailySales: 0, daysRemaining: 9999, alertLevel: 'ok' },
      ]);

      expect(ws.getRow(2).getCell('daysRemaining').value).toBe('Sin ventas');
    });

    it('usa colores distintos según alertLevel', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');

      service.buildRotationSheet(ws, [
        { medicationName: 'Crit', daysRemaining: 1, alertLevel: 'critical' },
        { medicationName: 'Warn', daysRemaining: 5, alertLevel: 'warning' },
        { medicationName: 'Ok', daysRemaining: 30, alertLevel: 'ok' },
      ]);

      const fill = (row: number) => (ws.getRow(row).getCell(1).fill as any).fgColor.argb;
      expect(fill(2)).toBe('FFFECACA');
      expect(fill(3)).toBe('FFFFF3CD');
      expect(fill(4)).toBe('FFFFFFFF');
    });
  });

  describe('buildValorizedInventorySheet', () => {
    it('acepta tanto {rows:[...]} como un array plano', () => {
      const ws1 = new ExcelJS.Workbook().addWorksheet('t1');
      service.buildValorizedInventorySheet(ws1, { rows: [{ medicationName: 'A', status: 'critico' }] });
      expect(ws1.rowCount).toBe(2);

      const ws2 = new ExcelJS.Workbook().addWorksheet('t2');
      service.buildValorizedInventorySheet(ws2, [{ medicationName: 'B', status: 'ok' }]);
      expect(ws2.rowCount).toBe(2);
    });

    it('usa el color por defecto si el status no está en el mapa', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');
      service.buildValorizedInventorySheet(ws, [{ medicationName: 'X', status: 'unknown_status' }]);
      expect((ws.getRow(2).getCell(1).fill as any).fgColor.argb).toBe('FFFFFFFF');
    });
  });

  describe('buildMedicationDetailSheet', () => {
    it('colorea la fila según el umbral de marginPct', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');

      service.buildMedicationDetailSheet(ws, [
        { medicationName: 'Alto', marginPct: 25 },
        { medicationName: 'Medio', marginPct: 12 },
        { medicationName: 'Bajo', marginPct: 5 },
      ]);

      const fill = (row: number) => (ws.getRow(row).getCell(1).fill as any).fgColor.argb;
      expect(fill(2)).toBe('FFF0FFF4');
      expect(fill(3)).toBe('FFFFF3CD');
      expect(fill(4)).toBe('FFFFFFFF');
    });
  });

  describe('buildMonthlySalesComparisonSheet', () => {
    it('colorea según signo de revenueGrowth y no colorea si es null', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');

      service.buildMonthlySalesComparisonSheet(ws, {
        rows: [
          { month: '2026-01', revenueGrowth: 10 },
          { month: '2026-02', revenueGrowth: -5 },
          { month: '2026-03', revenueGrowth: null },
        ],
      });

      expect((ws.getRow(2).getCell(1).fill as any).fgColor.argb).toBe('FFF0FFF4');
      expect((ws.getRow(3).getCell(1).fill as any).fgColor.argb).toBe('FFFEF2F2');
      expect(ws.getRow(4).getCell('revenueGrowth').value).toBeNull();
    });
  });

  describe('buildSalesByPaymentMethodSheet', () => {
    it('traduce los métodos de pago conocidos y agrega el detalle diario si viene informado', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');

      service.buildSalesByPaymentMethodSheet(ws, {
        summary: [{ method: 'qr', salesCount: 5, totalRevenue: 500, avgTicket: 100, pct: 50, totalChange: 0 }],
        daily: [{ saleDay: '2026-01-01', method: 'qr', salesCount: 2, totalRevenue: 200 }],
      });

      expect(ws.getRow(2).getCell('method').value).toBe('QR');
      expect(ws.getRow(4).getCell(1).value).toBe('Detalle Diario');
    });

    it('no agrega bloque de detalle diario si daily viene vacío', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');
      service.buildSalesByPaymentMethodSheet(ws, { summary: [], daily: [] });
      expect(ws.rowCount).toBe(1); // solo el header
    });

    /**
     * Regresión: bug corregido el 2026-08-27. `monthly` es lo que traía el
     * antiguo pharmacy/payment-methods (huérfano, sin botón en el frontend),
     * consolidado en este reporte en vez de mantener dos endpoints casi
     * idénticos.
     */
    it('agrega el bloque de tendencia mensual si monthly viene informado', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');
      service.buildSalesByPaymentMethodSheet(ws, {
        summary: [],
        daily: [],
        monthly: [{ month: '2026-01', method: 'qr', count: 3, total: 300 }],
      });
      const rows: string[] = [];
      ws.eachRow(row => rows.push(String(row.getCell(1).value ?? '')));
      expect(rows).toContain('Tendencia Mensual');
    });
  });

  describe('buildNoMovementSheet', () => {
    it('muestra "Sin ventas" si no hay lastSaleDate y formatea Date o string indistintamente', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');

      service.buildNoMovementSheet(ws, [
        { medicationName: 'A', lastSaleDate: null },
        { medicationName: 'B', lastSaleDate: new Date('2026-01-01') },
        { medicationName: 'C', lastSaleDate: '2026-02-01' },
      ]);

      expect(ws.getRow(2).getCell('lastSaleDate').value).toBe('Sin ventas');
      expect(ws.getRow(3).getCell('lastSaleDate').value).not.toBe('Sin ventas');
      expect(ws.getRow(4).getCell('lastSaleDate').value).not.toBe('Sin ventas');
    });
  });

  describe('sheets simples de mapeo directo (defaults con ?? y Number())', () => {
    it('buildStockMovementsSheet formatea la fecha si viene informada', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');
      service.buildStockMovementsSheet(ws, [{ date: '2026-01-01T10:00:00Z', type: 'in' }]);
      expect(ws.getRow(2).getCell('date').value).not.toBe('-');
    });

    it('buildConsumptionSheet cruza dispensed con received por medicationId', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');
      service.buildConsumptionSheet(ws, {
        dispensed: [{ medicationId: 'med-1', medicationName: 'A', totalDispensed: 10 }],
        received: [{ medicationId: 'med-1', totalReceived: 4 }],
      });
      expect(ws.getRow(2).getCell('received').value).toBe(4);
    });

    it('buildConsumptionSheet usa 0 en received si no hay traspaso para ese medicamento', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');
      service.buildConsumptionSheet(ws, {
        dispensed: [{ medicationId: 'med-2', medicationName: 'B', totalDispensed: 5 }],
        received: [],
      });
      expect(ws.getRow(2).getCell('received').value).toBe(0);
    });

    it('buildSalesByPharmacistSheet aplica defaults numéricos', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');
      service.buildSalesByPharmacistSheet(ws, [{ pharmacistName: 'Dra. Ruiz' }]);
      expect(ws.getRow(2).getCell('salesCount').value).toBe(0);
    });

    it('buildPharmacistDayMedicationSheet acepta {rows:[...]} o array plano', () => {
      const ws = new ExcelJS.Workbook().addWorksheet('test');
      service.buildPharmacistDayMedicationSheet(ws, { rows: [{ pharmacistName: 'Dra. Ruiz', medicationName: 'A' }] });
      expect(ws.rowCount).toBe(2);
    });
  });
});
