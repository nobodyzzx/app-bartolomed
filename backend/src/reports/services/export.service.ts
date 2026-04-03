import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

export type ExportReportType =
  | 'pharmacy-consumption'
  | 'critical-stock'
  | 'transfer-efficiency'
  | 'prescription-audit'
  | 'doctor-performance';

@Injectable()
export class ExportService {

  // ─── PDF streaming ────────────────────────────────────────────────────────
  // El documento se escribe directamente al stream de respuesta HTTP.
  // Nunca se acumula en memoria el PDF completo.

  streamPdf(
    res: Response,
    title: string,
    buildFn: (doc: PDFKit.PDFDocument) => void,
    filename = 'report.pdf',
  ): void {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // ── Encabezado común ──
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('Bartolomé — Sistema de Gestión Clínica', { align: 'center' })
      .moveDown(0.3)
      .fontSize(13)
      .font('Helvetica')
      .text(title, { align: 'center' })
      .moveDown(0.3)
      .fontSize(9)
      .fillColor('#888888')
      .text(`Generado: ${new Date().toLocaleString('es-BO')}`, { align: 'center' })
      .fillColor('#000000')
      .moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);

    buildFn(doc);

    doc.end();
  }

  buildCriticalStockPdf(doc: PDFKit.PDFDocument, data: any): void {
    const { belowMinimum, expiringSoon, expired, summary } = data;

    doc.fontSize(10).font('Helvetica-Bold').text('Resumen');
    doc.font('Helvetica').fontSize(9)
      .text(`Bajo mínimo: ${summary.belowMinimumCount}`)
      .text(`Próximos a vencer: ${summary.expiringSoonCount}`)
      .text(`Vencidos con stock: ${summary.expiredCount}`)
      .text(`Valor en riesgo: ${summary.totalAtRiskValue.toLocaleString('es-BO')} Bs.`)
      .moveDown(1);

    this.addPdfTable(doc, 'Stock Bajo Mínimo', ['Medicamento', 'Lote', 'Disp.', 'Mínimo'],
      belowMinimum.map((s: any) => [
        s.medication?.name ?? '-',
        s.batchNumber,
        String(s.availableQuantity),
        String(s.minimumStock),
      ])
    );

    this.addPdfTable(doc, 'Próximos a Vencer', ['Medicamento', 'Lote', 'Vence', 'Unidades'],
      expiringSoon.map((s: any) => [
        s.medication?.name ?? '-',
        s.batchNumber,
        new Date(s.expiryDate).toLocaleDateString('es-BO'),
        String(s.availableQuantity),
      ])
    );

    if (expired.length > 0) {
      this.addPdfTable(doc, '⚠ Ya Vencidos (acción inmediata)', ['Medicamento', 'Lote', 'Venció', 'Unidades'],
        expired.map((s: any) => [
          s.medication?.name ?? '-',
          s.batchNumber,
          new Date(s.expiryDate).toLocaleDateString('es-BO'),
          String(s.availableQuantity),
        ])
      );
    }
  }

  buildTransferEfficiencyPdf(doc: PDFKit.PDFDocument, data: any): void {
    const { kpiByRoute, stalledTransfers, stalledCount } = data;

    if (stalledCount > 0) {
      doc.fontSize(10).fillColor('#cc0000').font('Helvetica-Bold')
        .text(`⚠ ${stalledCount} traslado(s) detenido(s) más de 48 horas`)
        .fillColor('#000000').moveDown(0.5);
    }

    this.addPdfTable(doc, 'KPI por Ruta', ['Origen', 'Destino', 'Total', 'Hrs prom.', 'P95 hrs', 'Merma'],
      kpiByRoute.map((r: any) => [
        r.source_clinic_name,
        r.target_clinic_name,
        String(r.total_completed),
        String(r.avg_total_hrs),
        String(r.p95_hrs_in_transit),
        String(r.total_discrepancy_units),
      ])
    );

    if (stalledTransfers.length > 0) {
      this.addPdfTable(doc, 'Traslados Detenidos (+48h)', ['N° Traspaso', 'Origen', 'Destino', 'Hrs esperando'],
        stalledTransfers.map((t: any) => [
          t.transferNumber,
          t.source_clinic_name,
          t.target_clinic_name,
          String(t.hrs_waiting),
        ])
      );
    }
  }

  // ─── Tabla simple para PDF ────────────────────────────────────────────────
  private addPdfTable(
    doc: PDFKit.PDFDocument,
    sectionTitle: string,
    headers: string[],
    rows: string[][],
  ): void {
    doc.fontSize(10).font('Helvetica-Bold').text(sectionTitle).moveDown(0.3);

    if (rows.length === 0) {
      doc.fontSize(9).font('Helvetica').fillColor('#888888').text('Sin datos').fillColor('#000000').moveDown(0.8);
      return;
    }

    const colWidth = 490 / headers.length;
    const startX   = 50;
    let   y        = doc.y;

    // Encabezados
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333');
    headers.forEach((h, i) => doc.text(h, startX + i * colWidth, y, { width: colWidth - 4, align: 'left' }));
    y += 14;
    doc.moveTo(startX, y).lineTo(540, y).stroke('#cccccc');
    y += 4;

    // Filas
    doc.font('Helvetica').fillColor('#000000');
    rows.forEach((row, ri) => {
      if (y > 750) { doc.addPage(); y = 50; }

      if (ri % 2 === 0) {
        doc.rect(startX - 2, y - 2, 492, 14).fill('#f9f9f9').fillColor('#000000');
      }
      row.forEach((cell, i) => {
        doc.fontSize(7.5).text(cell, startX + i * colWidth, y, { width: colWidth - 4 });
      });
      y += 14;
    });

    doc.y = y + 8;
    doc.moveDown(0.5);
  }

  // ─── Excel streaming ──────────────────────────────────────────────────────
  // ExcelJS escribe el workbook directamente al stream de respuesta.

  async streamExcel(
    res: Response,
    sheetBuilders: Array<{ name: string; build: (ws: ExcelJS.Worksheet) => void }>,
    filename = 'report.xlsx',
  ): Promise<void> {
    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bartolomé Sistema';
    workbook.created = new Date();

    for (const { name, build } of sheetBuilders) {
      const ws = workbook.addWorksheet(name);
      build(ws);
    }

    await workbook.xlsx.write(res);
    res.end();
  }

  buildCriticalStockSheet(ws: ExcelJS.Worksheet, data: any): void {
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
      border: { bottom: { style: 'thin' } },
    };

    ws.columns = [
      { header: 'Medicamento',  key: 'name',      width: 30 },
      { header: 'Genérico',     key: 'generic',   width: 24 },
      { header: 'Lote',         key: 'batch',     width: 16 },
      { header: 'Vencimiento',  key: 'expiry',    width: 14 },
      { header: 'Disponible',   key: 'available', width: 12 },
      { header: 'Mínimo',       key: 'minimum',   width: 12 },
      { header: 'Costo Unit.',  key: 'unitCost',  width: 14 },
      { header: 'Alerta',       key: 'alert',     width: 18 },
    ];

    ws.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));

    const addSection = (items: any[], alertLabel: string, rowColor: string) => {
      items.forEach(s => {
        const row = ws.addRow({
          name:      s.medication?.name ?? '-',
          generic:   s.medication?.genericName ?? '-',
          batch:     s.batchNumber,
          expiry:    s.expiryDate ? new Date(s.expiryDate).toLocaleDateString('es-BO') : '-',
          available: s.availableQuantity,
          minimum:   s.minimumStock,
          unitCost:  Number(s.unitCost),
          alert:     alertLabel,
        });
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
        });
      });
    };

    addSection(data.expired,       'VENCIDO',           'FFFECACA');
    addSection(data.belowMinimum,  'BAJO MÍNIMO',       'FFFFF3CD');
    addSection(data.expiringSoon,  'PRÓXIMO A VENCER',  'FFFEF9C3');
  }

  buildConsumptionSheet(ws: ExcelJS.Worksheet, data: any): void {
    ws.columns = [
      { header: 'Medicamento',    key: 'name',     width: 30 },
      { header: 'Genérico',       key: 'generic',  width: 24 },
      { header: 'Unidades Salida',key: 'dispensed',width: 16 },
      { header: 'Ingreso Trasp.', key: 'received', width: 16 },
      { header: 'Ingresos (Bs)',  key: 'revenue',  width: 16 },
    ];

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } },
    };
    ws.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));

    const receivedMap: Record<string, number> = {};
    (data.received ?? []).forEach((r: any) => {
      receivedMap[r.medicationId] = Number(r.totalReceived ?? 0);
    });

    (data.dispensed ?? []).forEach((d: any) => {
      ws.addRow({
        name:      d.medicationName,
        generic:   d.genericName ?? '-',
        dispensed: Number(d.totalDispensed),
        received:  receivedMap[d.medicationId] ?? 0,
        revenue:   Number(d.totalRevenue ?? 0),
      });
    });
  }
}
