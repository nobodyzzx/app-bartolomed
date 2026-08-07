import { Injectable } from '@nestjs/common';
import { Charge, DiscountDisplay } from '../../charges/entities/charge.entity';
import { TypstCompilerService } from '../../pdf/typst-compiler.service';
import { typstString } from '../../pdf/utils/typst-escape.util';
import { Invoice } from '../entities/billing.entity';

/**
 * Recibo de cobro. La única diferencia entre los dos modos es **cómo se
 * presenta el descuento**, nunca los importes:
 *
 * - `ITEMIZED`: cada línea muestra su precio de lista y el descuento aparece
 *   como una fila al pie.
 * - `ABSORBED`: el precio unitario impreso ya viene neto y el descuento no se
 *   menciona en ninguna parte.
 *
 * En ambos casos el documento **cuadra**: las líneas suman el total impreso.
 * Ocultar el descuento omitiendo la fila pero rebajando el total daría un
 * recibo que no suma, y eso se lee como un error del sistema.
 *
 * Se dibuja a partir de los `Charge`, no de los `InvoiceItem`: el cargo guarda
 * `listPrice` y `discountAmount` por separado, así que ambas presentaciones
 * salen de datos exactos en vez de reconstruir el bruto desde el neto.
 */
@Injectable()
export class ReceiptPdfService {
  constructor(private readonly typstCompiler: TypstCompilerService) {}

  async generate(
    invoice: Invoice,
    charges: Charge[],
    display: DiscountDisplay = DiscountDisplay.ITEMIZED,
  ): Promise<Buffer> {
    return this.typstCompiler.compile(this.receiptTypst(invoice, charges, display));
  }

  private fmtBs(value: unknown): string {
    const n = Number(value ?? 0);
    return `Bs ${(isNaN(n) ? 0 : n).toLocaleString('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private receiptTypst(invoice: Invoice, charges: Charge[], display: DiscountDisplay): string {
    const discountTotal = charges.reduce((sum, c) => sum + Number(c.discountAmount ?? 0), 0);
    const itemized = display === DiscountDisplay.ITEMIZED && discountTotal > 0;

    const rows = charges.map(charge => {
      const quantity = Number(charge.quantity ?? 1);
      // Desglosado: precio de lista, y el descuento se resta al pie.
      // Absorbido: el unitario ya es el neto, y la línea cierra sola.
      const unitPrice = itemized ? Number(charge.listPrice) : Number(charge.unitPrice);
      const lineTotal = itemized ? quantity * Number(charge.listPrice) : Number(charge.total);

      return [
        typstString(charge.description ?? '-'),
        typstString(String(quantity)),
        typstString(this.fmtBs(unitPrice)),
        typstString(this.fmtBs(lineTotal)),
      ];
    });

    const tableRows = rows.length > 0 ? rows.map(cells => `(${cells.join(', ')})`).join(',\n        ') + ',' : '';

    const totals: Array<[string, string, boolean]> = [];
    if (itemized) {
      totals.push(['Subtotal', this.fmtBs(invoice.subtotal), false]);
      totals.push(['Descuento', `- ${this.fmtBs(discountTotal)}`, false]);
    }
    totals.push(['TOTAL', this.fmtBs(invoice.totalAmount), true]);
    if (Number(invoice.paidAmount ?? 0) > 0) {
      totals.push(['Pagado', this.fmtBs(invoice.paidAmount), false]);
    }
    if (Number(invoice.remainingAmount ?? 0) > 0) {
      totals.push(['Saldo pendiente', this.fmtBs(invoice.remainingAmount), true]);
    }

    const totalsTypst = totals
      .map(([label, value, strong]) => `    #totalRow(${typstString(label)}, ${typstString(value)}, strong: ${strong})`)
      .join('\n');

    const patientName =
      (invoice.patient
        ? `${invoice.patient.firstName ?? ''} ${invoice.patient.lastName ?? ''}`.trim()
        : charges.find(c => c.patientName)?.patientName) || 'Consumidor final';

    const metaFields: Array<[string, string]> = [
      ['Recibo', invoice.invoiceNumber],
      ['Fecha', new Date(invoice.issueDate).toLocaleDateString('es-BO')],
      ['Paciente', patientName],
    ];
    const metaTypst = metaFields.map(([k, v]) => `(${typstString(k)}, ${typstString(v)})`).join(',\n  ') + ',';

    return `#import "/templates/bartolomed-base.typ": bartolomedDoc, header, metaBar, section, styledTable, noData, gris-muted

#let totalRow(label, value, strong: false) = grid(
  columns: (1fr, auto),
  column-gutter: 16pt,
  align: (right, right),
  text(size: if strong { 11pt } else { 9.5pt }, weight: if strong { "bold" } else { "regular" })[#label],
  text(size: if strong { 11pt } else { 9.5pt }, weight: if strong { "bold" } else { "regular" })[#value],
)

#show: bartolomedDoc.with(title: ${typstString(`Recibo ${invoice.invoiceNumber}`)}, paper: "a4")

#header(name: "BARTOLOMED", subtitle: "Comprobante de Pago", badge: "RECIBO")
#metaBar((
  ${metaTypst}
))

#pad(x: 28pt, y: 14pt)[
  #section("Detalle")[
    ${
      rows.length === 0
        ? '#noData()'
        : `#styledTable(
      ("Descripción", "Cant.", "P. Unitario", "Importe"),
      (
        ${tableRows}
      ),
      align: (left, center, right, right),
      widths: (3fr, 0.8fr, 1.3fr, 1.3fr),
    )`
    }
  ]

  #v(14pt)
  #align(right, block(width: 55%)[
${totalsTypst}
  ])

  #v(28pt)
  #align(center, text(size: 8pt, fill: gris-muted)[Gracias por su preferencia])
]
`;
  }
}
