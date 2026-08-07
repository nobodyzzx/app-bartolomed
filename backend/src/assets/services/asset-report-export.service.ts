import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { TypstCompilerService } from '../../pdf/typst-compiler.service';
import { typstString } from '../../pdf/utils/typst-escape.util';
import { AssetReport, ReportFormat } from '../entities/asset-report.entity';

export interface ExportedAssetReport {
  fileName: string;
  contentType: string;
  content: Buffer;
}

/**
 * Serializa un `AssetReport` ya generado al formato que el usuario eligió.
 *
 * Antes `AssetsService.downloadReport()` servía CSV siempre, ignorando el
 * `format` guardado: pedir un reporte "PDF" bajaba un `.csv`. La justificación
 * en el código era que no había motor de render en el backend — dejó de ser
 * cierto con `TypstCompilerService` (migración Puppeteer→Typst), y `exceljs`
 * ya estaba en el proyecto para los reportes de farmacia.
 */
@Injectable()
export class AssetReportExportService {
  constructor(private readonly typstCompiler: TypstCompilerService) {}

  /** Etiquetas legibles para las claves que emite `AssetsService.buildReportData()`. */
  private readonly columnLabels: Record<string, string> = {
    assetTag: 'Código',
    name: 'Nombre',
    assetName: 'Activo',
    location: 'Ubicación',
    room: 'Ambiente',
    status: 'Estado',
    condition: 'Condición',
    type: 'Tipo',
    scheduledDate: 'Fecha Programada',
    actualCost: 'Costo Real (Bs)',
    purchasePrice: 'Precio de Compra (Bs)',
    currentValue: 'Valor Actual (Bs)',
    accumulatedDepreciation: 'Depreciación Acumulada (Bs)',
    purchaseDate: 'Fecha de Compra',
    totalMaintenanceCost: 'Costo Mantenimiento (Bs)',
  };

  /**
   * `AssetStatus`/`AssetCondition` se persisten en inglés; sin esto el usuario
   * final ve "active"/"good" crudos en el reporte — mismo defecto que ya se
   * corrigió en el reporte de demografía ("male"/"female"). Las etiquetas
   * replican las de `asset-reports.component.ts`.
   */
  private readonly valueLabels: Record<string, string> = {
    active: 'Activo',
    inactive: 'Inactivo',
    maintenance: 'En Mantenimiento',
    retired: 'Retirado',
    sold: 'Vendido',
    lost: 'Perdido',
    damaged: 'Dañado',
    excellent: 'Excelente',
    good: 'Bueno',
    fair: 'Regular',
    poor: 'Malo',
    critical: 'Crítico',
  };

  private readonly numericColumns = new Set([
    'actualCost',
    'purchasePrice',
    'currentValue',
    'accumulatedDepreciation',
    'totalMaintenanceCost',
  ]);

  private readonly dateColumns = new Set(['scheduledDate', 'purchaseDate']);

  /**
   * Columnas de texto libre, que reciben el doble de ancho en el PDF. Con
   * ancho uniforme los nombres de activo se parten con guiones a mitad de
   * palabra ("Computadora far-/macia") mientras las columnas de montos sobra
   * espacio.
   */
  private readonly wideColumns = new Set(['name', 'assetName', 'location']);

  async export(report: AssetReport): Promise<ExportedAssetReport> {
    const rows: Record<string, any>[] = Array.isArray(report.data) ? report.data : [];
    const base = report.fileName || 'reporte';

    switch (report.format) {
      case ReportFormat.JSON:
        return {
          fileName: `${base}.json`,
          contentType: 'application/json; charset=utf-8',
          // Salida para máquinas: se sirven los datos crudos, sin traducir ni
          // formatear, a diferencia de los otros tres formatos.
          content: Buffer.from(JSON.stringify(rows, null, 2), 'utf8'),
        };

      case ReportFormat.EXCEL:
        return {
          fileName: `${base}.xlsx`,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          content: await this.toExcel(report, rows),
        };

      case ReportFormat.PDF:
        return {
          fileName: `${base}.pdf`,
          contentType: 'application/pdf',
          content: await this.typstCompiler.compile(this.toTypst(report, rows)),
        };

      case ReportFormat.CSV:
      default:
        return {
          fileName: `${base}.csv`,
          contentType: 'text/csv; charset=utf-8',
          content: Buffer.from(this.toCsv(rows), 'utf8'),
        };
    }
  }

  // ─── Helpers de presentación ──────────────────────────────────────────────

  private labelFor(key: string): string {
    return this.columnLabels[key] ?? key;
  }

  /** Valor para CSV/Excel: montos y fechas quedan procesables, enums traducidos. */
  private rawValue(key: string, value: any): string | number | null {
    if (value === null || value === undefined || value === '') return null;
    if (this.numericColumns.has(key)) {
      const n = Number(value);
      return isNaN(n) ? null : n;
    }
    if (this.dateColumns.has(key)) return new Date(value).toLocaleDateString('es-BO');
    return this.valueLabels[String(value)] ?? String(value);
  }

  /** Valor para PDF: igual que `rawValue` pero con los montos ya formateados. */
  private displayValue(key: string, value: any): string {
    const raw = this.rawValue(key, value);
    if (raw === null) return '-';
    if (typeof raw === 'number') {
      return raw.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return raw;
  }

  // ─── CSV ──────────────────────────────────────────────────────────────────

  private toCsv(rows: Record<string, any>[]): string {
    if (rows.length === 0) return '';
    const keys = Object.keys(rows[0]);
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      keys.map(k => escape(this.labelFor(k))).join(','),
      ...rows.map(r => keys.map(k => escape(this.rawValue(k, r[k]) ?? '')).join(',')),
    ];
    // BOM UTF-8: sin él Excel abre el CSV en la codificación local y los
    // acentos de "Depreciación"/"Ubicación" salen corruptos.
    return `﻿${lines.join('\n')}`;
  }

  // ─── Excel ────────────────────────────────────────────────────────────────

  private async toExcel(report: AssetReport, rows: Record<string, any>[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bartolomed';
    workbook.created = new Date();
    const ws = workbook.addWorksheet(report.type.slice(0, 31) || 'Reporte');

    const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
    if (keys.length === 0) {
      ws.addRow(['Sin datos disponibles para el período seleccionado']);
    } else {
      ws.columns = keys.map(k => ({
        header: this.labelFor(k),
        key: k,
        width: this.numericColumns.has(k) ? 18 : Math.max(14, this.labelFor(k).length + 4),
      }));

      ws.getRow(1).eachCell(cell =>
        Object.assign(cell, {
          font: { bold: true, color: { argb: 'FFFFFFFF' } },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } },
        } as Partial<ExcelJS.Style>),
      );

      for (const r of rows) {
        const row = ws.addRow(Object.fromEntries(keys.map(k => [k, this.rawValue(k, r[k])])));
        for (const k of keys) {
          if (this.numericColumns.has(k)) row.getCell(k).numFmt = '#,##0.00';
        }
      }
    }

    // `xlsx.writeBuffer()` devuelve un ArrayBuffer-like de ExcelJS; el
    // controller hace `res.send()`, que necesita un Buffer de Node.
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  // ─── PDF (Typst) ──────────────────────────────────────────────────────────

  private toTypst(report: AssetReport, rows: Record<string, any>[]): string {
    const keys = rows.length > 0 ? Object.keys(rows[0]) : [];

    const body =
      keys.length === 0
        ? `#section(${typstString(report.type)})[#noData()]`
        : `#section(${typstString(report.type)})[
    #styledTable(
      (${keys.map(k => typstString(this.labelFor(k))).join(', ')}),
      (
        ${this.typstRows(rows, keys)}
      ),
      align: (${keys.map(k => (this.numericColumns.has(k) ? 'right' : this.dateColumns.has(k) ? 'center' : 'left')).join(', ')}),
      widths: (${keys.map(k => (this.wideColumns.has(k) ? '2fr' : '1fr')).join(', ')}),
    )
  ]`;

    const metaFields: Array<[string, string]> = [
      ['Generado', new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })],
      ['Clínica', report.clinic?.name ?? '-'],
      ['Registros', String(report.recordCount ?? rows.length)],
    ];
    if (report.description) metaFields.push(['Descripción', report.description]);
    if (report.dateFrom || report.dateTo) {
      const desde = report.dateFrom ? new Date(report.dateFrom).toLocaleDateString('es-BO') : '—';
      const hasta = report.dateTo ? new Date(report.dateTo).toLocaleDateString('es-BO') : '—';
      metaFields.push(['Período', `${desde} a ${hasta}`]);
    }

    // Coma final obligatoria: sin ella un `metaBar` de un solo par se pasaría
    // como paréntesis de agrupación y no como array (gotcha de Typst ya
    // documentado en reports-pdf.service.ts).
    const metaTypst = metaFields.map(([k, v]) => `(${typstString(k)}, ${typstString(v)})`).join(',\n  ') + ',';

    return `#import "/templates/bartolomed-base.typ": bartolomedDoc, header, metaBar, section, styledTable, noData

#show: bartolomedDoc.with(title: ${typstString(report.title)}, paper: "a4")

#header(name: "BARTOLOMED", subtitle: "Control de Activos", badge: ${typstString(report.type)})
#metaBar((
  ${metaTypst}
))

#pad(x: 28pt, y: 12pt)[
#block(below: 10pt)[#text(size: 13pt, weight: "bold")[#${typstString(report.title)}]]
${body}
]
`;
  }

  private typstRows(rows: Record<string, any>[], keys: string[]): string {
    return (
      rows.map(r => `(${keys.map(k => typstString(this.displayValue(k, r[k]))).join(', ')})`).join(',\n        ') + ','
    );
  }
}
