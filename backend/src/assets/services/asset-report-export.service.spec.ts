import { Test, TestingModule } from '@nestjs/testing';
import * as ExcelJS from 'exceljs';
import { TypstCompilerService } from '../../pdf/typst-compiler.service';
import { AssetReport, ReportFormat, ReportType } from '../entities/asset-report.entity';
import { AssetReportExportService } from './asset-report-export.service';

const makeReport = (overrides: Partial<AssetReport> = {}): AssetReport =>
  Object.assign(new AssetReport(), {
    id: 'report-1',
    title: 'Estado de Activos',
    type: ReportType.STATUS,
    format: ReportFormat.CSV,
    fileName: 'estado-activos',
    recordCount: 2,
    data: [
      { assetTag: 'A-1', name: 'Ecógrafo', status: 'active', condition: 'good' },
      { assetTag: 'A-2', name: 'Camilla "grande"', status: 'maintenance', condition: 'poor' },
    ],
    ...overrides,
  });

describe('AssetReportExportService', () => {
  let service: AssetReportExportService;
  let typst: { compile: jest.Mock };

  beforeEach(async () => {
    typst = { compile: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7 fake')) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AssetReportExportService, { provide: TypstCompilerService, useValue: typst }],
    }).compile();

    service = module.get(AssetReportExportService);
  });

  // ─── formato servido ──────────────────────────────────────────────────────

  it.each([
    [ReportFormat.CSV, 'text/csv', '.csv'],
    [ReportFormat.JSON, 'application/json', '.json'],
    [ReportFormat.EXCEL, 'spreadsheetml.sheet', '.xlsx'],
    [ReportFormat.PDF, 'application/pdf', '.pdf'],
  ])('sirve %s con su propio content-type y extensión', async (format, mime, ext) => {
    const result = await service.export(makeReport({ format }));

    expect(result.contentType).toContain(mime);
    expect(result.fileName).toBe(`estado-activos${ext}`);
    expect(Buffer.isBuffer(result.content)).toBe(true);
  });

  // ─── CSV ──────────────────────────────────────────────────────────────────

  describe('CSV', () => {
    it('usa etiquetas legibles y traduce los enums de estado/condición', async () => {
      const { content } = await service.export(makeReport({ format: ReportFormat.CSV }));
      const csv = content.toString('utf8');

      expect(csv).toContain('"Código","Nombre","Estado","Condición"');
      expect(csv).toContain('"Activo","Bueno"');
      expect(csv).toContain('"En Mantenimiento","Malo"');
      // Los valores crudos en inglés no deben llegar al usuario final.
      expect(csv).not.toContain('"active"');
      expect(csv).not.toContain('"good"');
    });

    it('abre BOM UTF-8 para que Excel no corrompa los acentos', async () => {
      const { content } = await service.export(makeReport({ format: ReportFormat.CSV }));

      expect(content.toString('utf8').charCodeAt(0)).toBe(0xfeff);
    });

    it('escapa las comillas dobles del contenido', async () => {
      const { content } = await service.export(makeReport({ format: ReportFormat.CSV }));

      expect(content.toString('utf8')).toContain('"Camilla ""grande"""');
    });

    it('devuelve contenido vacío si el reporte no tiene filas', async () => {
      const { content } = await service.export(makeReport({ format: ReportFormat.CSV, data: [] }));

      expect(content.toString('utf8')).toBe('');
    });
  });

  // ─── JSON ─────────────────────────────────────────────────────────────────

  describe('JSON', () => {
    it('sirve los datos crudos sin traducir (salida para máquinas)', async () => {
      const { content } = await service.export(makeReport({ format: ReportFormat.JSON }));

      expect(JSON.parse(content.toString('utf8'))).toEqual([
        { assetTag: 'A-1', name: 'Ecógrafo', status: 'active', condition: 'good' },
        { assetTag: 'A-2', name: 'Camilla "grande"', status: 'maintenance', condition: 'poor' },
      ]);
    });
  });

  // ─── Excel ────────────────────────────────────────────────────────────────

  describe('Excel', () => {
    it('escribe encabezados legibles y una fila por registro', async () => {
      const { content } = await service.export(makeReport({ format: ReportFormat.EXCEL }));

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(content as any);
      const ws = workbook.worksheets[0];

      expect(ws.getRow(1).getCell(1).value).toBe('Código');
      expect(ws.getRow(1).getCell(3).value).toBe('Estado');
      expect(ws.getRow(2).getCell(3).value).toBe('Activo');
      expect(ws.rowCount).toBe(3); // encabezado + 2 registros
    });

    it('guarda los montos como número, no como texto, para que Excel los sume', async () => {
      const { content } = await service.export(
        makeReport({
          format: ReportFormat.EXCEL,
          data: [{ assetTag: 'A-1', purchasePrice: '3200.00' }],
        }),
      );

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(content as any);
      const cell = workbook.worksheets[0].getRow(2).getCell(2);

      expect(cell.value).toBe(3200);
      expect(cell.numFmt).toBe('#,##0.00');
    });

    it('no revienta con un reporte sin filas', async () => {
      const { content } = await service.export(makeReport({ format: ReportFormat.EXCEL, data: [] }));

      expect(content.length).toBeGreaterThan(0);
    });
  });

  // ─── PDF ──────────────────────────────────────────────────────────────────

  describe('PDF', () => {
    it('compila con Typst pasando los datos ya traducidos y formateados', async () => {
      await service.export(
        makeReport({
          format: ReportFormat.PDF,
          data: [{ assetTag: 'A-1', name: 'Ecógrafo', purchasePrice: '3200.00', status: 'active' }],
        }),
      );

      const source: string = typst.compile.mock.calls[0][0];
      expect(source).toContain('bartolomed-base.typ');
      expect(source).toContain('"Estado de Activos"');
      expect(source).toContain('"Activo"');
      expect(source).toContain('"3.200,00"');
    });

    it('emite el placeholder de sin-datos en vez de una tabla vacía', async () => {
      await service.export(makeReport({ format: ReportFormat.PDF, data: [] }));

      const source: string = typst.compile.mock.calls[0][0];
      expect(source).toContain('#noData()');
      expect(source).not.toContain('#styledTable');
    });

    it('cierra la lista de metadatos con coma final', async () => {
      // Sin la coma, un metaBar de un solo par se pasaría a Typst como
      // paréntesis de agrupación y no como array (gotcha ya conocido).
      await service.export(makeReport({ format: ReportFormat.PDF }));

      const source: string = typst.compile.mock.calls[0][0];
      expect(source).toMatch(/,\n\)\)/);
    });

    it('escapa las comillas del contenido para no romper el .typ', async () => {
      await service.export(makeReport({ format: ReportFormat.PDF, data: [{ name: 'Camilla "grande"' }] }));

      const source: string = typst.compile.mock.calls[0][0];
      expect(source).toContain('Camilla \\"grande\\"');
    });
  });
});
